MYGAME — сайт с сервером и базой данных
========================================

СОСТАВ
  public/index.html — сайт (дизайн 2060 года, адаптив)
  server.js         — сервер: API, аккаунты, база SQLite
  package.json      — список зависимостей
  data.db           — создаётся автоматически при первом запуске

РОЛИ
  Основатель (логин: founder, пароль: founder123):
    - всё, что умеет админ (новости, скриншоты)
    - вкладка «Пользователи»: выдать/снять роль админа
    - вкладка «Настройки»: изменить ссылку на файл игры для скачивания
  Админ (назначает основатель):
    - добавлять и удалять новости и скриншоты
  Участник (выдаётся автоматически после регистрации):
    - смотреть сайт, скачивать игру

ЗАПУСК НА СВОЁМ КОМПЬЮТЕРЕ
  1. Установите Node.js с https://nodejs.org (версия 18 или новее).
  2. В папке проекта выполните в терминале:
       npm install
       node server.js
  3. Откройте http://localhost:3000

Важно: поменяйте пароль основателя! Перед первым запуском задайте
переменную окружения FOUNDER_PASSWORD, например:
       Windows (cmd):      set FOUNDER_PASSWORD=мойНовыйПароль123
       Windows (PowerShell): $env:FOUNDER_PASSWORD="мойНовыйПароль123"
       Linux/macOS:        FOUNDER_PASSWORD=мойНовыйПароль123 node server.js
Пароль применяется при создании аккаунта — если аккаунт уже создан,
удалите файл data.db и запустите сервер заново.

ЗАГРУЗКА НА ХОСТИНГ — БЕСПЛАТНО (Render.com)
  1. Зарегистрируйтесь на render.com и создайте репозиторий на GitHub,
     загрузите туда файлы проекта (public/, server.js, package.json).
  2. На Render нажмите New → Web Service, подключите репозиторий.
  3. Build command: npm install
     Start command: node server.js
  4. В Environment добавьте FOUNDER_PASSWORD с вашим паролем.
  5. Нажмите Create Web Service — сайт получит адрес вида https://ваш-сайт.onrender.com
  Минус бесплатного тарифа: база data.db живёт на диске, который
  периодически очищается. Для постоянного хранения подключите в Render
  бесплатную PostgreSQL-базу (это потребует доработки server.js) или
  возьмите диск Persistent Disk (платно).

ЗАГРУЗКА НА VPS (Reg.ru, Timeweb и т. п.)
  1. Арендуйте VPS с Ubuntu, подключитесь по SSH.
  2. Установите Node.js:
       curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
       sudo apt install -y nodejs
  3. Загрузите файлы проекта (например, через SFTP) в /home/mygame
  4. Выполните:
       cd /home/mygame && npm install
       sudo FOUNDER_PASSWORD=пароль node server.js
  5. Для автозапуска используйте pm2:
       sudo npm install -g pm2
       FOUNDER_PASSWORD=пароль pm2 start server.js --name mygame
       pm2 save
  6. Привяжите домен и включите HTTPS через nginx + certbot.

ЗАМЕТКИ
  - Если открыть index.html двойным кликом (без сервера), сайт работает
    в демо-режиме: всё хранится в localStorage только вашего браузера.
  - Пароли на сервере хранятся в виде scrypt-хэшей, не открытым текстом.
  - Резервную копию базы легко сделать: скопировать файл data.db.
