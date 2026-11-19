# Наш Адвент 🎄

Приватний адвент-календар для двох: 24 вікна (1–24 грудня), у кожному — подарунок, пригода для двох і спільна активність.
Фронтенд — статика (Render), бекенд — Google Apps Script (безкоштовно, працює незалежно від ваших серверів).

## Як влаштовано приватність
- Вхід тільки через Google, бекенд перевіряє токен і пускає **лише дві пошти** зі списку.
- Весь контент (300+ ідей) лежить у бекенді, а не у браузері. Розклад складається один раз, коли обоє заповнили анкети, і зберігається в Script Properties — **не в таблиці**, щоб не було спойлерів.
- Сервер віддає тільки вікна, час яких уже настав (о 07:00 за Києвом).
- Подарунок «від тебе до неї» бачиш тільки ти; пригода й активність — спільні.

## Налаштування (≈15 хвилин)

### 1. Google OAuth Client ID
1. https://console.cloud.google.com → створіть проєкт → **APIs & Services → OAuth consent screen** (External, додайте ваші 2 пошти як Test users).
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. У **Authorized JavaScript origins** додайте адресу вашого сайту на Render (напр. `https://nash-advent.onrender.com`) і `http://localhost:8787` для тестів.
4. Скопіюйте Client ID.

### 2. Бекенд (Apps Script)
1. https://script.google.com → **New project**.
2. Створіть три файли й вставте вміст із `backend/`: `Content.gs`, `Logic.gs`, `Code.gs` (старий `Code.gs` замініть).
3. **Project Settings → Script properties** додайте:
   - `CLIENT_ID` = ваш Client ID
   - `ALLOWED_EMAILS` = `ваша@пошта.com,її@пошта.com`
   - (необов’язково) `YEAR`=2026, `UNLOCK_HOUR`=7
4. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone**. Скопіюйте URL `.../exec`.
   (Доступ «Anyone» — це лише транспорт; без токена з дозволеної пошти бекенд нічого не віддає.)

### 3. Фронтенд (Render)
1. Впишіть URL бекенду та Client ID у `frontend/config.js`.
2. Запуште репозиторій на GitHub → Render → **New → Static Site**, publish directory `frontend` (або Blueprint із `render.yaml`).
3. Додайте домен Render до Authorized origins (крок 1.3).

## Тести перед стартом
- Тестовий режим: у Script Properties задайте `TEST_DAY=5`, щоб побачити перші 5 вікон. **Перед 1 грудня видаліть `TEST_DAY`, а також запустіть `resetAll()`, щоб стерти тестові анкети й розклад.**
- Локально: `node dev/server.js` → http://localhost:8787 (емулює бекенд, вхід кнопками). `node dev/test.js` — автотести логіки.

## Редагування контенту
Усі ідеї — у `backend/Content.gs` (формат у шапці файлу). Посилання на магазини — пошукові запити (Rozetka, Prom, Yakaboo, Makeup, Епіцентр), заклади — пошук на Google Maps «… Ужгород», тож нічого не «протухає», але години роботи варто перевіряти. Додавайте свої улюблені місця. **Не змінюйте порядок/кількість вже існуючих пунктів після складання розкладу** (розклад зберігає номери).
