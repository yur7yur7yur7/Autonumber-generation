# 🚗 Autonumber Generation

A lightweight static web app for generating printable keychain (brelok) mockups of Russian-style license plates. Pick a plate format on the landing screen, tweak the number, region, fonts, logos and back-side text, then export as an SVG ready to send to print.

> Лёгкое статическое веб-приложение для генерации печатных макетов брелоков с российскими автомобильными номерами. Выбери формат номера на стартовом экране, настрой номер, регион, шрифты и логотипы, затем выгрузи готовый SVG.

---

## ✨ Features

- 🇷🇺 **Russian plate format** — front (number + region + RUS flag) and back (custom text + brand logos)
- 🖼️ **Logo library** — built-in manifest of 100+ car-brand logos (badges and wordmarks) in `images/logos/`
- 🔤 **Custom fonts** — system fonts plus Noto, Inter, Montserrat, Oswald, Caveat and others
- ⚙️ **Deep settings** — sliders for borders, paddings, alignment, side dots, flag position and more
- 📐 **Vector export** — download both sides as a single SVG with the correct physical size (5.18 × 1.07 cm)
- 🌗 **Light & dark themes** — auto-switches via `prefers-color-scheme`
- 📱 **Mobile-friendly** — responsive layout, mobile hit-areas ≥48px, tap animations, dedicated mobile backgrounds

---

## 🚀 Quick start

No build step. No dependencies. Just open the file.

```bash
# Clone
git clone https://github.com/yur7yur7yur7/Autonumber-generation.git
cd Autonumber-generation

# Option A — open in your browser directly
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows

# Option B — serve locally (recommended for mobile testing)
python -m http.server 8000
# then open http://localhost:8000
```

> Без билда, без зависимостей. Двойной клик по `index.html` — и работает. Для теста на мобильном используй `python -m http.server 8000` и зайди на `http://<твой-IP>:8000` с телефона.

---

## 🗂️ Project structure

```
.
├── index.html              # Landing screen — pick a plate format
├── editor.html             # Front-side generator (canvas, settings, Telegram send)
├── back.html               # Back-side designer (fabric canvas, logos, fonts, snap)
│                            # also hosts the side-toggle module for the front preview
├── css/
│   ├── landing.css         # Landing-page styles (themes, animations, plate frame)
│   ├── main.css            # Light-mode tokens for the editor
│   ├── dark-theme.css      # Dark-mode overrides (prefers-color-scheme: dark)
│   ├── tabs.css            # Side-tab styling
│   ├── emoji-panel.css     # Emoji / logo grid styling
│   ├── settings-panel.css  # Detailed settings panel
│   ├── preview.css         # Canvas preview area
│   └── responsive.css      # Mobile breakpoints (≤768, ≤480, ≤360)
├── js/
│   ├── main.js             # Entry point — wires canvas, settings, tabs, keyboard
│   ├── drawing-front.js    # Renders the front (number) side on canvas
│   ├── drawing-back.js     # Renders the back (text + logos) side on canvas
│   ├── drawing-utils.js    # Rounded rects, shadows, background helpers
│   ├── side-toggle.js      # Front/back side toggle for back.html (front-side preview)
│   ├── settings-panel.js   # Settings panel DOM and event wiring
│   ├── validation.js       # Input filters and toast messages
│   ├── transliteration.js  # Russian ↔ Latin plate chars
│   ├── download.js         # SVG export
│   ├── logos.js            # Logo manifest loader and panel
│   ├── emojis.js           # Emoji categories for the back-side text
│   ├── font-loader.js      # FontFace API loader
│   └── config.js           # Constants, defaults, font list
├── images/
│   ├── back.png            # Landing backdrop (desktop)
│   ├── back-mobile.png     # Landing backdrop (≤768px)
│   ├── back-mobile-small.png  # Landing backdrop (≤480px)
│   ├── plate-ru.png        # Russian plate preview card
│   └── logos/              # ~100 PNG/JPG/SVG brand logos + manifest.json
├── fonts/
│   ├── frontpanel/         # Gibdd TTF/OTF — for the official plate look
│   └── backpanel/          # WOFF2 webfonts for the back-side text
└── update-logos.py         # Regenerates images/logos/manifest.json from filenames
```

---

## 🎨 How it works

### Landing screen (`index.html`)
- Background: project photo (`images/back.png`).
- One card per plate format. Click to open the generator.
- Tapping a card on mobile shrinks it (`scale(0.96)`) for tactile feedback.
- New formats = new `<a class="format-card">` blocks — no JS, no routing.

### Generator (`editor.html`)
- Canvas at 1224 × 252 px renders both plate sides.
- Switch between front and back with the side tabs.
- Pick a logo from the searchable grid → click to insert into the back-side text.
- Tweak everything in **Показать настройки** (🔧 Detailed settings): borders, paddings, side dots, flag position, font, text alignment.
- Hit **⬇⬇ Скачать макет** to download both sides as one SVG.

### Mobile behaviour
- Visual Viewport API tracks the soft keyboard and slides the preview above it when you focus the logo search.
- The canvas stays sticky so the result is always visible while typing.
- Custom touch handlers on sliders let you drag horizontally without fighting the vertical scroll.

---

## 🛠️ Stack

- Plain HTML + CSS + ES-module JS. No bundler, no framework.
- Canvas 2D rendering (no WebGL, no SVG manipulation at runtime).
- `localStorage` for persisting settings between visits.

---

## 📦 Scripts

The only npm script is for regenerating the logo manifest when you add or remove files in `images/logos/`:

```bash
npm run update-logos
# or, if you don't have Node:
python update-logos.py
```

The script parses filenames (`<brand>[_<variant>]_<type>[_<color>].<ext>`) and writes `images/logos/manifest.json`.

---

## 📝 Notes

- The fonts in `fonts/frontpanel/` (`gibdd-font.*`, `RoadNumbers.otf`) are used only to render the official-looking plate text on canvas. They are not loaded as webfonts.
- All settings persist in `localStorage` under the key `plateGeneratorSettings`.

---

## 📤 Telegram auto-send (optional)

The "⬇⬇ Скачать макет" button can also forward the generated SVG to a
Telegram chat (so users don't have to find the downloaded file and
re-send it manually). This requires a small serverless relay — the
editor itself stays a static site, the relay only sees the SVG bytes.

**Architecture:** `js/download.js` POSTs the SVG to a Cloudflare Worker
endpoint. The Worker (running on Cloudflare's free tier) calls
Telegram's `sendDocument` API and forwards the file. Secrets (bot
token, chat id) live in the Worker's environment variables, not in
the repo.

### Deploy the relay

1. Install the Wrangler CLI: `npm i -g wrangler`.
2. `cd worker && wrangler login` (one-time, opens a browser).
3. `wrangler secret put TG_BOT_TOKEN` — paste the token from @BotFather
   when prompted.
4. `wrangler secret put TG_CHAT_ID` — paste your numeric chat id
   (get it from @userinfobot or @RawDataBot).
5. `wrangler deploy` — Wrangler prints a `*.workers.dev` URL.
6. In `js/config.js`, set `TELEGRAM_RELAY_URL` to that URL and redeploy
   the static site (push to `main` on GitHub).

When `TELEGRAM_RELAY_URL` is empty, the button behaves as before (local
download only). The relay is opt-in.

### Privacy

The Worker only sees the SVG bytes — no plate-number telemetry, no
analytics, no IP logging beyond Cloudflare's standard request log. The
endpoint accepts POSTs from any origin (`Access-Control-Allow-Origin: *`).
If you want it locked down, change that header in `worker/src/index.js`
and verify a shared secret in the request body.

---

## 🧩 Config import/export (для производителей)

Производитель может править мелочи в дизайне брелка без пересборки макета с нуля:

1. На `index.html` нажать «**Загрузить макет**», выбрать `.brelok-config.json` в диалоге. index.html кладёт JSON в `sessionStorage`, перенаправляет на `back.html?config=<key>&type=ru`, где содержимое сразу подхватывается и применяется.
2. Выбрать `.brelok-config.json` (версия схемы `1`).
3. В `back.html` подтянутся слайдеры расширенных настроек, тоглы, номер/регион, текст и логотипы задней стороны.
4. Нажать «📦 Макет» — оператору в Telegram прилетит **PNG + `.config.json`** вторым вложением.

Для отладки: набрать `debug` в консоли `back.html` — появится кнопка «⬇ Скачать конфиг», сохраняющая текущий дизайн в JSON. Удобно для воспроизводимой отладки (правка одной координаты в JSON вместо пересборки в UI).

Схема файла — см. `docs/compose/specs/2026-07-18-brelok-config-import-export-design.md` (раздел §S4).

---

## 📩 Order / contact

To order a finished keychain, download the SVG from the generator and send it to:

<p align="left">
  <a href="https://t.me/dukas666" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/Telegram-@dukas666-2AABEE?style=for-the-badge&logo=telegram&logoColor=white&labelColor=1e1e2f" alt="Telegram @dukas666">
  </a>
</p>

> Чтобы заказать готовый брелок, скачай макет из генератора и пришли его автору:

<p align="left">
  <a href="https://t.me/dukas666" target="_blank" rel="noopener noreferrer">
    <img src="https://img.shields.io/badge/Telegram-@dukas666-2AABEE?style=for-the-badge&logo=telegram&logoColor=white&labelColor=1e1e2f" alt="Telegram @dukas666">
  </a>
</p>

---

## 📄 License

Private project. All rights reserved.