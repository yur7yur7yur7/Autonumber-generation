// ============================================================
// Панель шрифтов: добавляет текстбокс с выбранным шрифтом. Шрифты
// берутся из fonts/backpanel/manifest.json (генерируется
// update-fonts.py), @font-face инжектятся динамически в <head>.
// Чтобы добавить новый шрифт:
//   1) положить файл в fonts/backpanel/ (или подпапку);
//   2) запустить `python update-fonts.py`;
//   3) перезагрузить страницу.
// На мобильных — bottom sheet за гамбургер-кнопкой #font-toggle,
// свайп вниз закрывает.
// ============================================================

const SWIPE_DOWN_DISMISS_PX = 80;
const SWIPE_DOWN_MAX_LAT = 24;
const FONTS_DIR = 'fonts/backpanel';
const FONT_MANIFEST_URL = `${FONTS_DIR}/manifest.json`;

// Загруженный манифест (кешируется после первого запроса). До завершения
// loadFontManifest() экспорт ниже содержит пустой массив — вызовы из
// других модулей (back-boot) должны ждать initFontPanel().
let _cachedManifest = null;

export const SIGNATURE_TEXT = 'Ваша красивая подпись';

/**
 * Возвращает текущий список шрифтов. До загрузки манифеста — пустой массив.
 * Синхронный геттер для обратной совместимости со старым кодом, который
 * ожидал немедленный FONT_OPTIONS. После initFontPanel() массив заполнен.
 */
export function getFontOptions() {
    return _cachedManifest || [];
}

/**
 * Загружает манифест шрифтов и инжектит @font-face в <head>.
 * Возвращает массив { name, family, format, file, src }.
 * При ошибке загрузки манифеста — падает (инициализация панели невозможна).
 */
export async function loadFontManifest() {
    if (_cachedManifest) return _cachedManifest;
    const resp = await fetch(FONT_MANIFEST_URL);
    if (!resp.ok) {
        throw new Error(`Манифест шрифтов не найден: ${FONT_MANIFEST_URL}`);
    }
    const data = await resp.json();
    const fonts = Array.isArray(data.fonts) ? data.fonts : [];
    injectFontFaces(fonts);
    _cachedManifest = fonts;
    return fonts;
}

function injectFontFaces(fonts) {
    // Стили задней стороны больше не задаются статически в back.html —
    // собираем их здесь из манифеста. Чистим старые правила, чтобы при
    // повторной инициализации (HMR, ошибка fetch и retry) манифест
    // не накапливался в DOM.
    const sheet = ensureFontFaceSheet();
    while (sheet.cssRules.length > 0) sheet.deleteRule(0);
    for (const font of fonts) {
        const url = `${FONTS_DIR}/${font.src}`;
        const rule = `@font-face { font-family: '${font.family}'; ` +
            `src: url('${url}') format('${font.format}'); ` +
            `font-display: swap; }`;
        sheet.insertRule(rule, sheet.cssRules.length);
    }
}

let _fontFaceSheet = null;
function ensureFontFaceSheet() {
    if (_fontFaceSheet) return _fontFaceSheet;
    let el = document.getElementById('panel-fonts-faces');
    if (!el) {
        el = document.createElement('style');
        el.id = 'panel-fonts-faces';
        document.head.appendChild(el);
    }
    _fontFaceSheet = el.sheet;
    return _fontFaceSheet;
}

function stackLogosBelowTextboxes(canvas, frontRect) {
    const objs = canvas.getObjects().slice();
    const isTextbox = (o) => o && o.type === 'textbox';
    const textboxes = objs.filter(isTextbox);
    const middle = objs.filter((o) => !isTextbox(o) && o !== frontRect);
    const bottom = frontRect && objs.includes(frontRect) ? [frontRect] : [];
    const ordered = [...bottom, ...middle, ...textboxes];
    ordered.forEach((o, i) => canvas.moveTo(o, i));
    canvas.requestRenderAll();
}

export async function addTextWithFont(canvas, frontRect, font, options = {}) {
    const PLATE_WIDTH = 1224;
    const PLATE_HEIGHT = 252;
    // Однострочная подпись ориентируется по ширине, не по высоте.
    // Целевая ширина рамки выделения — 70% от длины канваса: текст
    // почти вписан, но с запасом, чтобы Fabric bbox не вылезал за плашку.
    const TARGET_W_FRACTION = 0.7;
    const fontSize = options.fontSize || Math.round(PLATE_HEIGHT * 0.7);
    const width = options.width || Math.round(PLATE_WIDTH * 0.9);
    await document.fonts.load(`${fontSize}px "${font.family}"`, SIGNATURE_TEXT);
    const textbox = new fabric.Textbox(SIGNATURE_TEXT, {
        left: PLATE_WIDTH / 2,
        top: PLATE_HEIGHT / 2,
        originX: 'center',
        originY: 'center',
        width,
        fontSize,
        fontFamily: font.family,
        fill: '#111111',
        textAlign: 'center'
    });
    canvas.add(textbox);
    // Подгоняем масштаб так, чтобы on-screen ширина bbox текстбокса
    // (≈ ширина рамки выделения Fabric) была близка к целевой доле от
    // длины канваса. У однострочной подписи высота bbox ≈ fontSize * lineHeight,
    // поэтому уменьшение scale по ширине автоматически уменьшает и видимую
    // высоту глифов — текст остаётся пропорциональным.
    const targetW = PLATE_WIDTH * TARGET_W_FRACTION;
    const bboxW = textbox.width * textbox.scaleX;
    if (bboxW > targetW) {
        const k = targetW / bboxW;
        textbox.set({ scaleX: textbox.scaleX * k, scaleY: textbox.scaleY * k });
        textbox.setCoords();
    } else if (bboxW < targetW * 0.6) {
        const targetScale = targetW / bboxW;
        const currentScale = Math.max(textbox.scaleX, textbox.scaleY);
        if (currentScale < targetScale) {
            const k = targetScale / currentScale;
            textbox.set({ scaleX: textbox.scaleX * k, scaleY: textbox.scaleY * k });
            textbox.setCoords();
        }
    }
    stackLogosBelowTextboxes(canvas, frontRect);
    canvas.setActiveObject(textbox);
    canvas.requestRenderAll();
}

function attachSwipeDownToDismiss(panelEl, headerSelector, openClass, onDismiss) {
    const header = panelEl.querySelector(headerSelector);
    if (!header) return;
    let startY = 0;
    let startX = 0;
    let activePointer = null;
    let dismissed = false;

    header.addEventListener('pointerdown', (e) => {
        if (e.pointerType && e.pointerType === 'mouse') return;
        if (!panelEl.classList.contains(openClass)) return;
        activePointer = e.pointerId;
        startY = e.clientY;
        startX = e.clientX;
        dismissed = false;
        // Блокируем pull-to-refresh / navigation gesture браузера.
        if (typeof e.preventDefault === 'function') e.preventDefault();
    });
    header.addEventListener('pointermove', (e) => {
        if (activePointer === null || e.pointerId !== activePointer) return;
        if (dismissed) return;
        const dy = e.clientY - startY;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > SWIPE_DOWN_MAX_LAT) {
            activePointer = null;
            return;
        }
        if (dy > SWIPE_DOWN_DISMISS_PX) {
            dismissed = true;
            activePointer = null;
            onDismiss();
        }
    });
    const cancel = () => { activePointer = null; dismissed = false; };
    header.addEventListener('pointerup', cancel);
    header.addEventListener('pointercancel', cancel);
    header.addEventListener('pointerleave', cancel);
}

export async function initFontPanel(canvas, frontRect) {
    // Загружаем манифест шрифтов и инжектим @font-face стили до того,
    // как начнём прогревать кеш document.fonts.
    const fonts = await loadFontManifest();
    await Promise.all(fonts.map((font) =>
        document.fonts.load(`22px "${font.family}"`, SIGNATURE_TEXT)
    ));

    const fontPanel = document.createElement('div');
    fontPanel.id = 'font-panel';
    fontPanel.innerHTML = `
        <div class="fp-header">Текст и шрифты</div>
        <div class="fp-list"></div>
    `;
    document.body.appendChild(fontPanel);
    window.__sideToggle?.syncChromeVisibility?.();

    const fontToggleBtn = document.createElement('button');
    fontToggleBtn.id = 'font-toggle';
    fontToggleBtn.textContent = '✎ Текст';
    document.body.appendChild(fontToggleBtn);
    window.__sideToggle?.syncChromeVisibility?.();

    const list = fontPanel.querySelector('.fp-list');
    fonts.forEach((font) => {
        const button = document.createElement('button');
        button.className = 'fp-font-btn';
        button.type = 'button';
        button.setAttribute('aria-label', `${font.name}: ${SIGNATURE_TEXT}`);
        button.innerHTML = `
            <span class="fp-preview" style="font-family: '${font.family}', cursive">${SIGNATURE_TEXT}</span>
            <span class="fp-name">${font.name}</span>
        `;
        button.addEventListener('click', async () => {
            await addTextWithFont(canvas, frontRect, font);
            fontPanel.classList.remove('fp-open');
            fontToggleBtn.textContent = '✎ Текст';
        });
        list.appendChild(button);
    });

    fontToggleBtn.addEventListener('click', () => {
        fontPanel.classList.toggle('fp-open');
        fontToggleBtn.textContent = fontPanel.classList.contains('fp-open') ? '✕ Закрыть' : '✎ Текст';
    });

    document.addEventListener('click', (event) => {
        if (!fontPanel.classList.contains('fp-open')) return;
        if (fontPanel.contains(event.target) || fontToggleBtn.contains(event.target)) return;
        fontPanel.classList.remove('fp-open');
        fontToggleBtn.textContent = '✎ Текст';
    });

    attachSwipeDownToDismiss(fontPanel, '.fp-header', 'fp-open', () => {
        fontPanel.classList.remove('fp-open');
        fontToggleBtn.textContent = '✎ Текст';
    });
}