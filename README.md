# 🚗 Autonumber Generation

A lightweight static web app for generating printable keychain (brelok) mockups of Russian-style license plates. Pick **Номер РФ** on the landing screen to open the editor, tweak the number, region, fonts, logos and back-side text, then send the finished design to Telegram (PNG + JSON config).

> Лёгкое статическое веб-приложение для генерации печатных макетов брелоков с российскими автомобильными номерами. На стартовом экране выбери **Номер РФ**, настрой номер, регион, шрифты и логотипы, затем отправь готовый макет в Telegram (PNG + JSON-конфиг).

---

## ✨ Features

- 🇷🇺 **Российский номер** — передняя сторона (номер + регион + RUS/флаг) и задняя (текст + логотипы брендов) в одном редакторе
- 🖼️ **Библиотека логотипов** — встроенный каталог из 100+ брендов (значки и надписи) в `images/logos/`
- 🔤 **Кастомные шрифты** — системные плюс Noto, Inter, Montserrat, Oswald, Caveat и др.
- ⚙️ **Расширенные настройки** — слайдеры для отступов, скруглений, ширин зон, тоглы показа флага и точек по бокам, размер и положение логотипов
- 📤 **Отправка в Telegram** — готовое изделие прилетает в чат оператора двумя файлами: PNG-превью и `.brelok-config.json`
- 🧩 **Импорт/экспорт конфига** — производитель может прислать готовый `.json`, и редактор восстановит брелок (слайдеры, тоглы, номер, регион, текст и логотипы)
- 🆕 **Онбординг** — кнопка «?» в header'е показывает 7-шаговую инструкцию по работе с редактором. Автоматически открывается при первом заходе.
- 🌗 **Светлая и тёмная темы** — автопереключение по `prefers-color-scheme`
- 📱 **Mobile-friendly** — адаптивная вёрстка, hit-area ≥48px, тап-анимации, отдельные фоны для мобильных разрешений

---

## 🚀 Quick start

Без билда, без зависимостей. Двойной клик по `index.html` — и работает.

```bash
# Clone
git clone https://github.com/yur7yur7yur7/Autonumber-generation.git
cd Autonumber-generation

# Option A — открыть файл в браузере
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows

# Option B — поднять локальный сервер (для теста на телефоне)
python -m http.server 8000
# затем открыть http://localhost:8000
```

---

## 🗂️ Project structure

```
.
├── index.html                  # Лендинг: две карточки — «Номер РФ» и «Загрузить макет»
├── back.html                   # Редактор брелка (fabric + canvas, обе стороны)
├── css/
│   ├── landing.css             # Стили лендинга (темы, рамки номера, анимация карточек)
│   ├── main.css                # Токены светлой темы для редактора
│   ├── dark-theme.css          # Переопределения тёмной темы (prefers-color-scheme: dark)
│   ├── responsive.css          # Брейкпоинты (≤768, ≤480, ≤360)
│   ├── preview-overlay.css     # DOM-overlay hit-зон поверх canvas
│   ├── preview.css             # Область превью
│   ├── settings-panel.css      # Панель «Расширенные настройки»
│   ├── result-preview.css      # Модалка предпросмотра перед отправкой в Telegram
│   ├── emoji-panel.css         # Стили emoji / логотипов
│   └── landing.css             # Стили лендинга (см. выше)
├── js/
│   ├── config.js               # Константы, defaults, список шрифтов, URL Telegram-релея
│   ├── brelok-config.js        # Серилизация/десериализация .brelok-config.json
│   ├── onboarding.js           # 7-шаговый гайд по редактору (overlay + spotlight)
│   ├── drawing-front.js        # Рисует переднюю сторону (номер)
│   ├── drawing-back.js         # Рисует заднюю сторону (текст + логотипы)
│   ├── drawing-utils.js        # Скруглённые рамки, фон, тени
│   ├── side-toggle.js          # Переключатель «Передняя / Задняя сторона»
│   ├── logos.js                # Загрузка и отрисовка логотипов на canvas
│   ├── emojis.js               # Категории эмодзи для текста на задней стороне
│   ├── font-loader.js          # Подгрузка шрифтов через FontFace API
│   ├── transliteration.js      # Транслитерация кириллицы (RUS → RUS/лат)
│   ├── validation.js           # Валидация инпутов и тосты
│   ├── preview-overlay.js      # DOM-overlay hit-зон поверх fabric-canvas
│   ├── result-preview.js       # Модалка «Посмотреть результат» перед отправкой
│   ├── order-form.js           # Форма заказа (имя, контакт, комментарий)
│   ├── thanks-modal.js         # Модалка «Спасибо» после успешной отправки
│   ├── contacts.js             # Контакты производителя в модалке «Спасибо»
│   ├── download.js             # Сборка SVG + PNG, отправка в Telegram-релей
│   └── settings-panel.js       # Панель настроек (UI-плейт тоглов)
├── images/
│   ├── back.png                # Фон лендинга (десктоп)
│   ├── back-mobile.png         # Фон лендинга (≤768px)
│   ├── back-mobile-small.png   # Фон лендинга (≤480px)
│   ├── template.png            # Шаблон модалки предпросмотра
│   ├── flagRu.png              # Триколор для передней стороны
│   ├── plate-ru.png            # Превью карточки «Номер РФ»
│   ├── settings/               # Иконки слайдеров расширенных настроек
│   └── logos/                  # ~100 PNG/JPG/SVG логотипов + manifest.json
├── fonts/
│   ├── frontpanel/             # Gibdd TTF/OTF — для официального вида номера на canvas
│   └── backpanel/              # WOFF2 веб-шрифты для текста на задней стороне
└── worker/
    └── src/index.js            # Cloudflare Worker — Telegram-relay (см. ниже)
```

---

## 🎨 How it works

### Лендинг (`index.html`)

- Две карточки, обе ведут в редактор:
  - **«Номер РФ»** — обычный запуск: открывается `back.html` с пустым брелком.
  - **«Загрузить макет»** — сначала диалог выбора `.brelok-config.json` (на самом лендинге), затем `back.html` с уже подтянутыми параметрами и объектами.
- Клик по карточке на мобиле — лёгкий `scale(0.96)` для тактильного фидбэка.

### Редактор (`back.html`)

- Внутри один fabric.Canvas (`1224 × 252 px`), на нём рисуется как задняя сторона (текст + логотипы), так и передняя — через `<canvas>`-сестру с тоглом «Передняя / Задняя сторона».
- Тяни текст и логотипы прямо на canvas; панель **Шрифты** — выбор шрифта из каталога.
- Тогл «📦 Макет» открывает модалку предпросмотра, по подтверждению — отправляет готовый PNG и (если был загружен макет) `.config.json` вторым вложением в Telegram.
- Отладочная кнопка **«🧪 Скачать PNG»** появляется, если в консоли набрать `debug`. Рядом — **«⬇ Скачать конфиг»** (тоже debug-only): сохраняет текущий дизайн в `.json` для офлайн-правки.
- При первом открытии `back.html` показывается 7-шаговая инструкция (`js/onboarding.js`) — подсвечивает ключевые элементы интерфейса (поле ввода, тоглы, расширенные настройки, переключатель сторон, заднюю сторону, конфиг, отправку). Закрытие фиксируется в `localStorage["brelok-onboarding-seen"]`, повторно автоматически не показывается. Ручной запуск — кнопка «?» в header'е. Esc / тап мимо / «Пропустить» / «Готово» — закрывают.

### Подсказки по карточкам (сводка)

- «Номер РФ» — личные легковые, грузовики и прицепы. Не для спецсерий и мото.
- «Загрузить макет» — ранее сохранённый в этом же редакторе брелок.

### Поведение на мобиле

- Visual Viewport API отслеживает появление экранной клавиатуры и приподнимает превью над ней.
- Canvas «липнет» к верху — результат всегда виден при наборе номера.
- Слайдеры имеют кастомные touch-обработчики: горизонтальный жест не конфликтует с вертикальным скроллом.

---

## 🛠️ Stack

- Чистый HTML + CSS + ES-modules JS. Без бандлера, без фреймворков.
- Canvas 2D для передней стороны, fabric.js 5.3.0 (CDN) для задней.
- `sessionStorage` используется только как транзит для передачи выбранного JSON при импорте с лендинга в редактор; долгосрочных пользовательских данных в браузере не хранится.
- Telegram-шлюз — Cloudflare Worker (`worker/src/index.js`), без секретов в репо.

---

## 📦 Scripts

Единственный вспомогательный скрипт — регенерация манифеста логотипов при добавлении или удалении файлов в `images/logos/`:

```bash
npm run update-logos
# или без Node:
python update-logos.py
```

Скрипт парсит имена файлов (`<brand>[_<variant>]_<type>[_<color>].<ext>`) и пишет `images/logos/manifest.json`.

---

## 🧩 Config import/export (для производителей)

Производитель может править мелочи в дизайне брелка без пересборки макета с нуля:

1. На `index.html` нажать «**Загрузить макет**», выбрать `.brelok-config.json` в диалоге. index.html кладёт JSON в `sessionStorage` и перенаправляет на `back.html?config=<key>&type=ru`, где содержимое сразу подхватывается.
2. В редакторе подтянутся слайдеры расширенных настроек, тоглы, номер/регион, текст и логотипы задней стороны.
3. Нажать «📦 Макет» — оператору в Telegram прилетит **PNG + `.config.json`** вторым вложением.

Для отладки: набрать `debug` в консоли `back.html` — появится кнопка «⬇ Скачать конфиг», сохраняющая текущий дизайн в JSON. Удобно для воспроизводимой отладки (правка координаты в JSON вместо пересборки в UI).

Формат файла:

- `version: 1` — если в будущем меняется, старые конфиги отклоняются.
- `brelokType: "ru"` — единственный тип на сегодня. Если будут другие форматы (мото, дипломат, …), каждый редактор будет сверять это поле и отвергать чужие макеты.
- `frontSide: { number, region, showFlag, showSideDots, rusX, rusY, flagX, flagY, numberX, numberY, numberAreaWidth, numberPadding, regionX, regionY, regionAreaWidth }`
- `backSide: { elements: [...] }` — JSON fabric.Canvas (текст, изображения, линии).

---

## 📤 Telegram auto-send (optional)

Кнопка «📦 Макет» в редакторе пересылает готовое изделие в Telegram-чат (PNG + `.config.json`), чтобы оператору не приходилось вылавливать файл в личке. Для этого нужен небольшой serverless-relay — сам редактор остаётся статикой, релей видит только JSON-payload с PNG/SVG.

**Архитектура:** `js/download.js#sendMaketToTelegram` POST-ит JSON на Cloudflare Worker. Worker вызывает Telegram `sendDocument` (для итогового PNG) и (если `body.config` непустой) `sendDocument` второй раз для `.config.json`. Секреты (`TG_BOT_TOKEN`, `TG_CHAT_IDS`) живут в переменных окружения воркера, не в репо.

### Поднять релей

1. Установить Wrangler: `npm i -g wrangler`.
2. `cd worker && wrangler login` (разово, откроется браузер).
3. `wrangler secret put TG_BOT_TOKEN` — вставить токен от @BotFather.
4. `wrangler secret put TG_CHAT_IDS` — id чатов через запятую.
5. `wrangler deploy` — wrangler выведет `*.workers.dev` URL.
6. В `js/config.js` вписать этот URL в `TELEGRAM_RELAY_URL` и задеплоить статику (запушить в `main`).

Если `TELEGRAM_RELAY_URL` пустой — кнопка «📦 Макет» остаётся рабочей (открывает модалку предпросмотра и итоговый PNG), но без отправки. Релей opt-in.

### Приватность

Воркер видит только PNG/SVG-байты и (если есть) текст конфига. Никакой телеметрии по номерам, никакой аналитики, никакого логирования IP сверх стандартного Cloudflare-лога. Endpoint принимает POSTs с любого origin (`Access-Control-Allow-Origin: *`). Если нужно закрыть — поменяйте заголовок в `worker/src/index.js` и заведите shared secret в теле запроса.

---

## 📩 Order / contact

Чтобы заказать готовый брелок, скачай макет из генератора и пришли его автору:

<p align="left">
  <a href="https://t.me/dukas666" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/Telegram-@dukas666-2AABEE?style=for-the-badge&logo=telegram&logoColor=white&labelColor=1e1e2f" alt="Telegram @dukas666">
  </a>
</p>

---

## 📄 License

Private project. All rights reserved.
