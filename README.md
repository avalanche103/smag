# Сайт журнала "Строительство: Экономика, учет, право"

Собственная CMS на Node.js + TypeScript для публичного сайта и административной панели.

## Возможности

- публичные страницы журнала и выпусков;
- скачивание счета-фактуры в один клик;
- импорт перечней опубликованного из Excel;
- админ-панель для редактирования текстов, контактов, выпусков и файлов;
- хранение данных в JSON и файлов в локальном управляемом хранилище;
- форма обратной связи с защитой от спама и отправкой на email.

## Быстрый старт

1. Скопируйте `.env.example` в `.env`.
2. Укажите SMTP-доступ для отправки писем с формы (`SMTP_*`, `MAIL_FROM`, `MAIL_TO`).
3. Установите зависимости: `npm install`.
4. Запустите начальное наполнение: `npm run db:seed`.
5. Запустите приложение: `npm run dev`.
6. Откройте `http://localhost:3000`.
7. Админ-панель: `http://localhost:3000/admin`.

## Основные команды

- `npm run dev` — режим разработки.
- `npm run build` — сборка TypeScript.
- `npm start` — запуск собранного приложения.
- `npm run db:seed` — создание и наполнение базы начальными данными.
- `npm run backup` — резервное копирование базы и загруженных файлов.
- `npm run lint` — типовая проверка TypeScript.

## Деплой на Render

1. Подключите репозиторий как Web Service (Node).
2. **Build command:** `npm ci && npm run build`
3. **Start command:** `npm start`
4. Обязательно задайте в **Environment**:
   - `SESSION_SECRET` — случайная строка ≥32 символов (`openssl rand -base64 32`)
   - `SITE_URL` — URL сервиса на Render (например `https://smag.onrender.com`)
   - `ADMIN_PASSWORD`, `ADMIN_USER_PASSWORD` — пароли админки
   - `SMTP_*`, `MAIL_FROM`, `MAIL_TO` — для формы обратной связи
5. Либо используйте [`render.yaml`](render.yaml) — `SESSION_SECRET` сгенерируется автоматически.

Без `SESSION_SECRET` приложение не стартует в production (это намеренная защита).

## Деплой на hoster.by (ISPmanager)

Хостинг: [vh134.hoster.by:1500](https://vh134.hoster.by:1500/), пользователь `h215910`, SSH `vh134.hoster.by:22`.

### 1. Сайт в панели

1. **Сайты** → создать или выбрать домен.
2. Обработчик: **Node.js**, версия LTS (20 или 22).
3. Стартовый файл: `dist/server.js`, режим: **порт** (панель задаёт `PORT`).
4. При необходимости включить SSL и редирект HTTP → HTTPS.

### 2. Секреты и production-переменные

```powershell
copy .env.deploy.example .env.deploy
copy .env.production.example .env.production
```

Заполните:

- **`.env.deploy`** — `DEPLOY_DOMAIN` (ваш домен), при необходимости пароль SSH.
- **`.env.production`** — `SESSION_SECRET` (≥32 символа), `SITE_URL` (`https://ваш-домен`), пароли админки, `SMTP_PASS`.

Файлы `.env.deploy` и `.env.production` в `.gitignore`, в репозиторий не попадают.

SSH-ключ (удобнее пароля):

```powershell
ssh-copy-id -p 22 h215910@vh134.hoster.by
```

### 3. Выгрузка

```powershell
npm run deploy
```

Скрипт упакует проект, загрузит по SSH, выполнит `npm ci`, `npm run build` на сервере и скопирует `.env.production`.

### 4. Первый запуск

После деплоя в ISPmanager: **Сайты** → домен → **Изменить** → **Сохранить** (перезапуск Node.js).

Если каталог `data/` пустой:

```bash
cd ~/www/ВАШ-ДОМЕН
npm run db:seed
```

Проверка: открыть сайт и `/admin`.
