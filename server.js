// ============================================================
//  MYGAME — сервер сайта (Node.js + Express + SQLite)
//  Запуск: npm install, затем node server.js
// ============================================================
const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- база данных ----------
const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS screenshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

// ---------- аккаунт основателя ----------
// Пароль можно задать переменной окружения FOUNDER_PASSWORD перед первым запуском.
const founderExists = db.prepare('SELECT id FROM users WHERE role = ?').get('founder');
if (!founderExists) {
  const salt = crypto.randomBytes(16).toString('hex');
  const pw = process.env.FOUNDER_PASSWORD || 'founder123';
  db.prepare('INSERT INTO users (username, salt, pass_hash, role) VALUES (?, ?, ?, ?)')
    .run('founder', salt, hashPassword(pw, salt), 'founder');
  console.log('Создан аккаунт основателя: founder / ' + pw);
}

// ---------- ссылка на скачивание по умолчанию ----------
if (!db.prepare('SELECT value FROM settings WHERE key = ?').get('download_url')) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
    .run('download_url', 'https://example.com/mygame-setup.exe');
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- авторизация ----------
function auth(level) {
  return (req, res, next) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const session = token ? db.prepare('SELECT * FROM sessions WHERE token = ?').get(token) : null;
    req.user = session ? db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) : null;
    if (level && !req.user) return res.status(401).json({ error: 'Требуется вход' });
    if (level === 'admin' && !['admin', 'founder'].includes(req.user.role))
      return res.status(403).json({ error: 'Недостаточно прав' });
    if (level === 'founder' && req.user.role !== 'founder')
      return res.status(403).json({ error: 'Доступно только основателю' });
    next();
  };
}

// ---------- открытые эндпоинты ----------
app.get('/api/ping', (req, res) => res.json({ ok: true }));

app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || String(username).length < 3 || String(password).length < 4)
    return res.status(400).json({ error: 'Логин от 3 символов, пароль от 4 символов' });
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username))
    return res.status(400).json({ error: 'Такой логин уже занят' });
  const salt = crypto.randomBytes(16).toString('hex');
  const info = db.prepare('INSERT INTO users (username, salt, pass_hash, role) VALUES (?, ?, ?, ?)')
    .run(username, salt, hashPassword(password, salt), 'participant'); // роль выдаётся автоматически
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, info.lastInsertRowid);
  res.json({ token, user: { username, role: 'participant' } });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || ''));
  if (!user || hashPassword(String(password || ''), user.salt) !== user.pass_hash)
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
  res.json({ token, user: { username: user.username, role: user.role } });
});

app.get('/api/me', auth(true), (req, res) => {
  res.json({ user: { username: req.user.username, role: req.user.role } });
});

app.post('/api/logout', auth(true), (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.json({ ok: true });
});

app.get('/api/content', (req, res) => {
  res.json({
    news: db.prepare('SELECT * FROM news ORDER BY id DESC').all(),
    screenshots: db.prepare('SELECT * FROM screenshots ORDER BY id DESC').all(),
    download: (db.prepare('SELECT value FROM settings WHERE key = ?').get('download_url') || {}).value || ''
  });
});

// ---------- управление контентом (админ и основатель) ----------
app.post('/api/news', auth('admin'), (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'Заполните заголовок и текст' });
  const info = db.prepare('INSERT INTO news (title, body) VALUES (?, ?)').run(String(title), String(body));
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.delete('/api/news/:id', auth('admin'), (req, res) => {
  db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/screenshots', auth('admin'), (req, res) => {
  const { url, caption } = req.body || {};
  if (!url || !/^https?:\/\//.test(url))
    return res.status(400).json({ error: 'Укажите корректную ссылку на картинку (http/https)' });
  const info = db.prepare('INSERT INTO screenshots (url, caption) VALUES (?, ?)').run(String(url), String(caption || ''));
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.delete('/api/screenshots/:id', auth('admin'), (req, res) => {
  db.prepare('DELETE FROM screenshots WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- только основатель ----------
app.put('/api/settings/download', auth('founder'), (req, res) => {
  const { url } = req.body || {};
  if (!url || !/^https?:\/\//.test(url))
    return res.status(400).json({ error: 'Ссылка должна начинаться с http:// или https://' });
  db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run('download_url', String(url));
  res.json({ ok: true });
});

app.get('/api/users', auth('founder'), (req, res) => {
  res.json({ users: db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all() });
});

app.post('/api/users/role', auth('founder'), (req, res) => {
  const { username, role } = req.body || {};
  if (!['admin', 'participant'].includes(role))
    return res.status(400).json({ error: 'Недопустимая роль' });
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || ''));
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  if (user.role === 'founder') return res.status(400).json({ error: 'Роль основателя изменить нельзя' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
  res.json({ ok: true });
});

// ---------- всё остальное отдаём как сайт ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('MYGAME запущен: http://localhost:' + PORT);
});
