# Paparazzi Fashion — Wholesale Site

Профессиональный B2B сайт-визитка для оптовой продажи женской одежды бренда Paparazzi Fashion из Стамбула.

## ✨ Что внутри

- **Многоязычность:** TR / EN / RU (переключатель в шапке)
- **Адаптивный дизайн:** мобильная, планшетная, десктопная версии
- **SEO:** Open Graph, Schema.org, sitemap.xml, robots.txt, canonical, hreflang
- **Производительность:** ленивая загрузка изображений, минимум JS
- **CTA:** WhatsApp, Telegram, Instagram, MAX — все по одному клику
- **Структурные данные:** WholesaleStore с адресом и контактами для Google
- **Без зависимостей** (кроме Lucide icons и Google Fonts через CDN)

## 📁 Структура

```
paparazzi-fashion-site/
├── index.html              # главная страница
├── robots.txt              # для поисковиков
├── sitemap.xml             # карта сайта
├── README.md               # эта документация
└── assets/
    ├── css/style.css       # стили
    ├── js/i18n.js          # переводы TR/EN/RU
    ├── js/main.js          # интерактивность
    └── img/                # папка для твоих фото (пока пуста)
```

## 🚀 Локальный просмотр

Открой `index.html` в браузере. Или для быстрого превью:

```powershell
# Из этой папки
python -m http.server 8000
# Затем открой http://localhost:8000
```

## 🌐 Бесплатный хостинг (3 варианта)

### Вариант 1: GitHub Pages (рекомендую)

1. Зарегистрируйся на https://github.com (если ещё нет)
2. Создай репозиторий `paparazzi-fashion-site` (публичный)
3. Загрузи туда содержимое этой папки
4. В Settings → Pages → Source: `main` branch, `/ (root)`
5. Через 1-2 минуты сайт будет доступен на `https://username.github.io/paparazzi-fashion-site`
6. Подключи свой домен (см. ниже)

### Вариант 2: Netlify Drop (самый быстрый)

1. Открой https://app.netlify.com/drop
2. Перетащи всю папку `paparazzi-fashion-site` на страницу
3. Сайт сразу доступен на `https://random-name.netlify.app`
4. Можно переименовать и подключить свой домен

### Вариант 3: Vercel

1. https://vercel.com → Sign Up
2. New Project → Import (или CLI: `npx vercel`)
3. Готово

## 🔗 Подключение собственного домена

Сначала зарегистрируй домен (в идеале:
- `paparazzifashion.tr` (если свободен — через турецкого регистратора)
- `paparazzifashionwholesale.com`
- `paparazzifashion.global`
- `paparazzi-fashion-istanbul.com`

Регистраторы:
- https://www.namecheap.com (~$10-15/год)
- https://www.godaddy.com
- https://www.cloudflare.com (продажа доменов по себестоимости)

После регистрации:
- В DNS добавь CNAME запись на `username.github.io` (для GitHub Pages)
- Или A-запись на IP Netlify/Vercel (см. их инструкции)

## 📝 Что заменить под себя

### 1. Адрес (если в HTML опечатка)

Поищи в `index.html` слово `Aizmkar` и замени на правильное название улицы.

### 2. Год основания

В `assets/js/i18n.js` найди `Since 2017` / `2017'den Beri` / `С 2017 года` — поменяй на свой реальный год.

### 3. Фото

Замени Unsplash-ссылки в `index.html` на свои реальные фотографии. Сохрани свои фото в `assets/img/` и используй пути типа `assets/img/dress-1.jpg`.

Совет: оптимизируй фото перед загрузкой:
- Размер: ширина 800-1200px достаточно
- Формат: WebP или JPEG (качество 80%)
- Инструмент: https://squoosh.app (бесплатно)

### 4. Тексты

Все тексты вынесены в `assets/js/i18n.js`. Меняй там, и они автоматически обновятся в HTML.

### 5. Реальные цифры

Найди и поменяй в i18n.js:
- `28K+` (followers) — текущая цифра подписчиков
- `10K+` (B2B Orders) — реальное число клиентов
- `80+` (Countries) — стран куда отправлял

## 📊 SEO чек-лист после запуска

После того как сайт онлайн:

1. **Google Search Console** (https://search.google.com/search-console)
   - Добавь сайт → Verify → Submit sitemap.xml
2. **Yandex Webmaster** (https://webmaster.yandex.com)
   - Тоже добавь и подтверди
3. **Bing Webmaster Tools** (https://www.bing.com/webmasters)
4. **Google Business Profile** (https://business.google.com)
   - Создай бизнес-профиль с адресом Laleli — появишься в Google Maps
5. **Yandex.Бизнес** (https://yandex.ru/sprav)
6. **Internal links from your social media:**
   - Bio Instagram @paparazzifashion.tr → ссылка на сайт
   - Описание YouTube канала
   - LinkedIn Company Page
   - Threads / TikTok / Pinterest
7. **Запроси backlink с paparazzifashion.pl** — это даст самый сильный SEO-сигнал
8. **B2B директории:**
   - Alibaba Verified Supplier
   - Made-in-Turkey.com
   - Faire.com (для бутиков EU/US)
   - LinkedIn Company Page

## 🛡 Защита от сайта-мошенника

Если `paparazzifashion.com.tr` действительно мошенник:

1. **WHOIS lookup:** https://whois.domaintools.com/paparazzifashion.com.tr — узнаёшь регистратора
2. **Жалоба регистратору** на trademark abuse
3. **Google Safe Browsing report:** https://safebrowsing.google.com/safebrowsing/report_phish/
4. **BTK (Турция):** https://internet.btk.gov.tr — жалоба на phishing
5. **Trademark complaint Instagram/Meta** — через Polish HQ paparazzifashion.pl
6. **Trustpilot:** оставь negative review для предупреждения других

## 📞 Контакты в коде

Все контакты собраны в одном месте — `index.html`. Поиском замени старые на новые, если нужно:

- Phone: `+905393909958` (8 раз в файле)
- Address: `Aizmkar No 63, Laleli, Fatih, Istanbul`
- Instagram: `@paparazzifashion.tr`

## 📜 Лицензия

Этот сайт сделан персонально для @paparazzifashion.tr. Используй как хочешь.
Изображения с Unsplash — используются по их бесплатной лицензии для прототипа,
**замени на свои фотографии перед публикацией продакшн-версии.**
