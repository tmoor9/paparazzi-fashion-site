# Автосинхронизация — пошаговая настройка

Этот сайт настроен автоматически обновляться каждый день из
`paparazzifashion.com.tr`. Один раз настраиваешь — и забываешь.

## Что уже сделано в коде

| Файл | Что делает |
|------|------------|
| `tools/scrape.js` | Качает каталог + фото с paparazzifashion.com.tr, пишет `assets/products.json` |
| `tools/generate_og_cover.js` | Делает картинку для соцсетей (превью при шаринге) |
| `.github/workflows/sync.yml` | Расписание GitHub Actions: каждый день в 03:00 UTC |
| `package.json` | Зависимости (Playwright) |
| `netlify.toml` | Конфиг Netlify (статика + кэш-заголовки) |

## Что нужно сделать (один раз, ~10 минут)

### 1. Создать аккаунт GitHub

1. Перейти на https://github.com/signup
2. Логин: что угодно (например, `paparazzi-fashion-tr`)
3. Email: твой
4. Подтвердить email

### 2. Создать репозиторий

1. https://github.com/new
2. Repository name: `paparazzi-fashion-site`
3. **Private** (приватный — никто не увидит код кроме тебя)
4. **Не** ставить галочки "Add README" / "Add .gitignore" (у нас уже есть)
5. Create repository

GitHub покажет команды для пуша. Запомни URL вида
`https://github.com/<твой-логин>/paparazzi-fashion-site.git`

### 3. Загрузить код

В терминале (PowerShell, в папке проекта):

```powershell
git init
git add .
git commit -m "initial: Paparazzi Fashion B2B site"
git branch -M main
git remote add origin https://github.com/<ТВОЙ-ЛОГИН>/paparazzi-fashion-site.git
git push -u origin main
```

GitHub попросит логин/пароль (или Personal Access Token — это вместо пароля,
делается на https://github.com/settings/tokens).

### 4. Создать аккаунт Netlify

1. https://www.netlify.com/ → "Sign up"
2. Войти **через GitHub** (это привяжет аккаунты)

### 5. Подключить репозиторий к Netlify

1. На главной Netlify → "Add new site" → "Import an existing project"
2. "Deploy with GitHub" → авторизовать
3. Выбрать репозиторий `paparazzi-fashion-site`
4. Branch: `main`
5. Build command: оставить пустым (статика, ничего собирать не надо)
6. Publish directory: `.` (точка)
7. "Deploy site"

Через ~30 секунд Netlify покажет URL вида
`https://random-name-12345.netlify.app`

### 6. Поменять имя поддомена (опционально)

1. На странице сайта в Netlify → Site configuration → "Change site name"
2. Ввести: `paparazzi-fashion-tr` (или что хочешь)
3. Готово — сайт доступен на `https://paparazzi-fashion-tr.netlify.app`

## После настройки — что будет происходить

- **Каждый день в 03:00 UTC** GitHub Actions запустит `tools/scrape.js`
- Если нашёл новые товары / удалённые товары → сделает commit и push
- Netlify увидит push → автоматически пересоберёт и задеплоит сайт
- Через ~1 минуту — твой сайт обновлён

## Проверить что всё работает

1. На GitHub в репо → вкладка "Actions" → видно последний запуск синхронизации
2. На Netlify в проекте → вкладка "Deploys" → видно последний деплой

## Запустить синхронизацию вручную (без ожидания 24 часов)

GitHub → твой репо → Actions → "Sync from paparazzifashion.com.tr" →
кнопка "Run workflow" → "Run workflow"

## Стоимость

| Сервис | Лимит бесплатного плана | Наш расход |
|--------|------------------------|-----------|
| GitHub Actions | 2000 минут/месяц | ~150 мин/мес |
| Netlify Bandwidth | 100 GB/месяц | < 1 GB/мес |
| Netlify Builds | 300 минут/месяц | ~30 мин/мес |

**Запас в 10× по всем метрикам. Ничего не платишь.**

## Поменять расписание

В `.github/workflows/sync.yml` строка `cron: '0 3 * * *'`:

| Расписание | Cron-строка |
|------------|-------------|
| Каждые 6 часов | `'0 */6 * * *'` |
| Каждый час | `'0 * * * *'` |
| Каждый день 09:00 (Стамбул) | `'0 6 * * *'` (UTC = Istanbul - 3) |
| Раз в неделю в воскресенье | `'0 3 * * 0'` |

После правки — `git push`, и расписание поменяется.
