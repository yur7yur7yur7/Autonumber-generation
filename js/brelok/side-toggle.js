// ============================================================
// Иконка «закрыть» для гамбургер-кнопок с toggleIconSvg. Меняет местами
// иконку в открытом состоянии, чтобы пользователь видел аффорданс закрытия.
const CLOSE_ICON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>';

// ============================================================
// Тоггл «Передняя / Задняя сторона» для back.html (бывший test.html).
// Клик по лейблу #canvas-label переключает между:
//   - задней стороной (fabric-канва с user-объектами: текст, логотипы, линии)
//   - передней стороной (нативный <canvas> с готовым номером, RUS и флагом —
//     рисуется той же логикой, что и в editor.html, через
//     js/drawing-front.js + js/drawing-utils.js).
// При показе передней: прячутся все панели/кнопки задней стороны, user-объекты
// ткани переводятся в visible=false (состояние сохраняется). При возврате —
// наоборот.
//
// Под передним канвасом — <input id="frontPlateInput">, где первые 6 символов
// это номер (любая кириллица/латиница из ALLOWED_CHARS, кириллица
// транслитерируется в латиницу), остаток — только цифры (код региона, 2-3
// знака). Валидация — по правилам editor.html (ALLOWED_CHARS + digits, maxlength=10),
// тосты через showTemporaryMessage.
//
// Зависимости, передаваемые из back.html через initSideToggle():
//   - canvas: fabric.Canvas
//   - sideLabel: HTMLElement (кликабельный лейбл)
//   - frontCanvas: HTMLCanvasElement (нативный)
//   - frontCanvasWrap: HTMLElement (обёртка над нативным)
//   - frontPlateInput: HTMLInputElement (опц., управляет номером/регионом)
//   - getFrontRect: () => fabric.Rect (для исключения из user-объектов)
//   - fitCanvasToViewport: () => void (вызываем на каждом переключении)
// ============================================================

let currentSide = 'back';
let frontDepsPromise = null;
let cachedDeps = null;
let teardown = null;
// Текущие значения для передней стороны — обновляются через input. Используются
// при показе передней стороны, чтобы канва отражала то, что ввёл пользователь.
let currentNumber = '';
let currentRegion = '';
import { ALLOWED_CHARS, RUS_TO_LAT, DEFAULT_SETTINGS } from '../shared/config.js';
import { showTemporaryMessage } from '../shared/validation.js';

// Настройки передней стороны. Управляются четырьмя панелями в setSide('front'):
//   - «Общие настройки» (тоглы): showFlag, showSideDots.
//   - «Флаг и RUS» (слайдеры): flagX, flagY, rusX, rusY.
//   - «Номер» (слайдеры): numberY, numberX, numberAreaWidth, numberPadding.
//   - «Код региона» (слайдеры): regionY, regionX, regionAreaWidth.
// Слайдер-панели заменяют ранее хардкоженные значения внутри
// renderFrontOnNativeCanvas; теперь они читаются отсюда. showSideDots по-
// прежнему переопределяет numberPadding и regionX внутри render, чтобы
// хватало места под боковые точки (см. старую логику editor.html).
const frontSettings = {
    showFlag: DEFAULT_SETTINGS.showFlag,
    showSideDots: DEFAULT_SETTINGS.showSideDots,
    flagX: DEFAULT_SETTINGS.flagX,
    flagY: DEFAULT_SETTINGS.flagY,
    rusX: DEFAULT_SETTINGS.rusX,
    rusY: DEFAULT_SETTINGS.rusY,
    numberY: DEFAULT_SETTINGS.numberY,
    numberX: DEFAULT_SETTINGS.numberX,
    numberAreaWidth: DEFAULT_SETTINGS.numberAreaWidth,
    numberPadding: DEFAULT_SETTINGS.numberPadding,
    regionY: DEFAULT_SETTINGS.regionY,
    regionX: DEFAULT_SETTINGS.regionX,
    regionAreaWidth: DEFAULT_SETTINGS.regionAreaWidth
};

const FRONT_HIDE_SELECTORS = [
    '#font-toggle', '#logo-toggle', '#snap-toggle',
    '#font-panel', '#logo-panel', '#snap-panel', '#ctx-menu',
    '#rotate-hint'
];

export function getCurrentSide() {
    return currentSide;
}

function getFrontDeps() {
    if (cachedDeps) return Promise.resolve(cachedDeps);
    if (!frontDepsPromise) {
        frontDepsPromise = Promise.all([
            import('../shared/drawing-front.js'),
            import('../shared/drawing-utils.js')
        ]).then(([front, utils]) => {
            cachedDeps = { front, utils };
            return cachedDeps;
        });
    }
    return frontDepsPromise;
}

// Парсит value инпута на (number, region):
//   - убирает пробелы (в т.ч. автопробел после 6-го символа);
//   - первые 6 символов — номер (всё, что угодно, фильтруется внутри getDisplayNumber);
//   - остаток — только цифры, обрезается до 3 знаков.
function parsePlateInput(value) {
    const v = (value || '').toUpperCase().replace(/\s+/g, '');
    const number = v.slice(0, 6);
    const region = v.slice(6).replace(/\D/g, '').slice(0, 3);
    return { number, region };
}

async function renderFrontOnNativeCanvas(ctx, number, region) {
    const { front, utils } = await getFrontDeps();
    const W = ctx.canvas.width;   // 1224
    const H = ctx.canvas.height;  // 252
    const SF = W / 720;
    // Все позиционные/размерные поля читаются из frontSettings, который
    // редактируется четырьмя панелями (Общие настройки, Флаг и RUS, Номер,
    // Код региона). Не задаваемые UI-поля (margin, borderThickness, скругления)
    // берутся из DEFAULT_SETTINGS как было.
    const settings = {
        margin: DEFAULT_SETTINGS.margin,
        numberY: frontSettings.numberY,
        regionY: frontSettings.regionY,
        rusX: frontSettings.rusX,
        rusY: frontSettings.rusY,
        flagX: frontSettings.flagX,
        flagY: frontSettings.flagY,
        numberAreaWidth: frontSettings.numberAreaWidth,
        regionAreaWidth: frontSettings.regionAreaWidth,
        innerBorderRadius: DEFAULT_SETTINGS.innerBorderRadius,
        numberPadding: frontSettings.numberPadding,
        numberX: frontSettings.numberX,
        regionX: frontSettings.regionX,
        showSideDots: frontSettings.showSideDots,
        showFlag: frontSettings.showFlag,
        mainBorderRadius: DEFAULT_SETTINGS.mainBorderRadius,
        borderThickness: DEFAULT_SETTINGS.borderThickness
    };
    // Если точки по бокам включены — сдвигаем номер и регион, чтобы хватило
    // места под боковые точки (старая логика editor.html).
    if (settings.showSideDots) {
        settings.numberPadding = 0;
        settings.regionX = 23;
    }

    ctx.clearRect(0, 0, W, H);
    utils.setDrawingContext(ctx);
    utils.drawBackground(W, H, SF, settings.mainBorderRadius);
    utils.drawInnerBackground(W, H, SF, settings.mainBorderRadius);
    utils.drawRoundedRect(0, 0, W, H, settings.mainBorderRadius * SF, '#000000');
    if (settings.borderThickness > 0) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 5 * SF;
        ctx.shadowOffsetY = 2 * SF;
        utils.drawRoundedRect(
            2 * SF, 2 * SF,
            W - 4 * SF, H - 4 * SF,
            (settings.mainBorderRadius * SF) - (2 * SF),
            null, '#333333', settings.borderThickness * SF
        );
        ctx.restore();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
    }
    front.setFrontContext(ctx, settings);
    // Номер: кириллица/латиница — drawFrontSide внутри вызовет getDisplayNumber,
    // который отфильтрует по ALLOWED_CHARS и транслитерирует кириллицу в латиницу.
    // Регион: передаём как есть; пустая строка даст дефолт '777' внутри (см. drawing-front.js).
    front.drawFrontSide(number, region, W, H);
    utils.drawSideDots(ctx, W, H, settings, SF);
}

function setUserObjectsVisible(canvas, getFrontRect, visible) {
    const frontRect = getFrontRect();
    const userObjects = canvas.getObjects().filter((o) => o !== frontRect);
    userObjects.forEach((o) => { o.visible = visible; });
    canvas.discardActiveObject();
    canvas.requestRenderAll();
}

function hideBackChrome() {
    FRONT_HIDE_SELECTORS.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
            el.dataset._prevDisplay = el.dataset._prevDisplay ?? el.style.display ?? '';
            el.style.display = 'none';
        });
    });
}

function restoreBackChrome() {
    FRONT_HIDE_SELECTORS.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
            el.style.display = el.dataset._prevDisplay || '';
            delete el.dataset._prevDisplay;
        });
    });
}

/**
 * Валидация композитного инпута номера+региона — повторяет правила editor.html
 * (RUS_TO_LAT lookup + цифры), но без обрезки до 6 символов: maxlength=9 уже
 * ограничивает длину в HTML, оставшиеся цифры трактуются как регион.
 * При попытке ввести невалидный символ — тост через showTemporaryMessage.
 *
 * @param {HTMLInputElement} input
 * @param {() => void} onUpdate — колбэк при валидном вводе
 * @returns {() => void} teardown
 */
export function setupPlateInputValidation(input, onUpdate) {
    if (!input) return () => {};
    // ALLOWED_CHARS и RUS_TO_LAT импортированы статически наверху модуля.
    const allowedSet = new Set(ALLOWED_CHARS);
    // Позиции в номере (0..5) принимают латиницу/кириллицу/цифры из ALLOWED_CHARS.
    // Позиция 6 — всегда пробел-разделитель (или пусто).
    // Позиции 7..9 — только цифры (код региона).
    const NUMBER_LEN = 6;
    const SPACE_POS = 6;
    const REGION_LEN = 3;
    const MAX_LEN = NUMBER_LEN + 1 + REGION_LEN; // 10

    /**
     * Позиционная фильтрация. Принимает строку (любого регистра, с пробелами или без),
     * возвращает отфильтрованную строку длиной ≤ MAX_LEN в формате "номер(6) пробел регион(≤3)".
     *  - позиции 0..5: кириллица → транслитерация; латиница/цифра из ALLOWED_CHARS — оставляем.
     *  - позиция 6: пробел → оставляем как разделитель; всё прочее — отбрасываем.
     *  - позиции 7..9: только цифры 0..9. Буквы (кириллица или латиница) — отбрасываем,
     *    чтобы юзер не мог случайно добавить "лишнюю" букву в хвост ("м777мм 777м" → "M777MM 777").
     */
    function filter(value) {
        const src = value || '';
        let out = '';
        for (let i = 0; i < src.length && out.length < MAX_LEN; i++) {
            const ch = src[i];
            const outPos = out.length;
            if (outPos < NUMBER_LEN) {
                // Номер: 0..5 — кириллица (транслитерация), латиница или цифра из ALLOWED_CHARS.
                if (RUS_TO_LAT[ch]) {
                    out += RUS_TO_LAT[ch];
                } else if (allowedSet.has(ch.toUpperCase())) {
                    out += ch.toUpperCase();
                }
            } else if (outPos === SPACE_POS) {
                // Разделитель — пробел.
                if (ch === ' ') out += ch;
            } else {
                // Регион: 7..9 — только цифры. Буквы отбрасываем, чтобы юзер не мог
                // добавить лишнюю букву в хвост (напр. "M777MM 777М" → "M777MM 777").
                if (/[0-9]/.test(ch)) out += ch;
            }
        }
        return out;
    }

    // Вставляет автопробел на позиции 6, если в строке больше 6 символов
    // и в позиции 6 ещё не пробел. Вызывается ДО filter, чтобы filter не отбросил
    // начало региона. Защиты от стирания пробела юзером нет: если он стирает
    // пробел в позиции 6, formatWithSpace вставит его обратно при следующем input.
    function formatWithSpace(value) {
        if (value.length <= 6) return value;
        if (value[6] === ' ') return value;
        return value.slice(0, 6) + ' ' + value.slice(6);
    }

    function applyFormatted(newValue, cursorBefore) {
        const oldValue = input.value;
        if (newValue === oldValue) return;
        input.value = newValue;
        // Корректируем позицию курсора, если была вставка пробела после 6-го символа.
        if (typeof cursorBefore === 'number' && input.setSelectionRange) {
            const spaceInsertedAt6 =
                newValue.length > oldValue.length &&
                newValue[6] === ' ' &&
                oldValue[6] !== ' ';
            const newCursor = spaceInsertedAt6 && cursorBefore >= 7
                ? cursorBefore + 1
                : cursorBefore;
            try { input.setSelectionRange(newCursor, newCursor); } catch (_) {}
        }
    }

    function onInput() {
        const cursorBefore = input.selectionStart;
        const original = input.value;
        const withSpace = formatWithSpace(original);
        const filtered = filter(withSpace);
        applyFormatted(filtered, cursorBefore);
        if (onUpdate) onUpdate();
    }

    function onPaste(e) {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const withSpace = formatWithSpace(pasted);
        const filtered = filter(withSpace);
        input.value = filtered;
        if (input.setSelectionRange) {
            try { input.setSelectionRange(filtered.length, filtered.length); } catch (_) {}
        }
        if (onUpdate) onUpdate();
    }

    input.addEventListener('input', onInput);
    input.addEventListener('paste', onPaste);

    return () => {
        input.removeEventListener('input', onInput);
        input.removeEventListener('paste', onPaste);
    };
}

// ============================================================
// SWIPE-DOWN-TO-DISMISS: pointer-события на header'е панели; если палец
// уехал вниз больше порога — закрывает панель. Скролл внутри панели
// не блокируется, потому что pointer-события слушаются только на header.
// Скопировано из back.html (snap-панель), чтобы front-панель не зависела
// от наличия этого хелпера в back.html.
// ============================================================
function attachSwipeDownToDismiss(panelEl, headerSelector, openClass, onDismiss) {
    const header = panelEl.querySelector(headerSelector);
    if (!header) return;
    const SWIPE_DOWN_DISMISS_PX = 80;
    const SWIPE_DOWN_MAX_LAT = 24;
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
    const cancel = () => {
        activePointer = null;
        dismissed = false;
    };
    header.addEventListener('pointerup', cancel);
    header.addEventListener('pointercancel', cancel);
    header.addEventListener('pointerleave', cancel);
}

/**
 * Создаёт панель «Общие настройки» для передней стороны с двумя тоглами:
 *   - Показывать флаг (frontSettings.showFlag)
 *   - Точки по бокам (frontSettings.showSideDots)
 * По структуре и поведению — аналог snap-панели: постоянно видна на десктопе,
 * снизу drawer на мобильных с гамбургер-кнопкой #front-toggle.
 * @param {Object} deps
 * @param {() => void} deps.onChange — вызывается при любом изменении тогла.
 *        Хост должен перерисовать канву (renderFrontOnNativeCanvas).
 * @returns {{ panel: HTMLElement, toggleBtn: HTMLButtonElement, teardown: () => void }}
 */
export function createFrontPanel(deps) {
    const onChange = deps?.onChange || (() => {});

    const panel = document.createElement('div');
    panel.id = 'front-panel';

    // Иконки для тоглов. SVG — inline, цвет через currentColor, чтобы
    // «checked» подсветил иконку в акцентный синий. Для флага используем
    // готовый PNG-триколор (images/flagRu.png) — у него собственный цвет,
    // его не тонируем.
    const FRONT_ICONS = {
        // Триколор РФ — PNG, размер подгоняет CSS.
        showFlag: '<img src="images/flagRu.png" alt="" draggable="false">',
        // Две точки рядом по центру — буквально «точки по бокам».
        showSideDots: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="8" cy="12" r="2.6"/><circle cx="16" cy="12" r="2.6"/></svg>'
    };

    function rowTemplate(label, key, hint) {
        const id = `front-${key}`;
        const on = frontSettings[key];
        const icon = FRONT_ICONS[key] || '';
        return `
            <label class="sp-row" for="${id}">
                <span class="sp-icon" aria-hidden="true">${icon}</span>
                <span class="sp-label">
                    <b>${label}</b>
                    <small>${hint}</small>
                </span>
                <span class="sp-toggle">
                    <input type="checkbox" id="${id}" ${on ? 'checked' : ''}/>
                    <span class="sp-bg"></span>
                    <span class="sp-knob"></span>
                </span>
            </label>
        `;
    }

    panel.innerHTML = `
        <div class="sp-header">⚙ Общие настройки</div>
        <div class="sp-body">
            ${rowTemplate('Показывать флаг', 'showFlag', 'триколор в правой части номера')}
            ${rowTemplate('Точки по бокам', 'showSideDots', 'как на настоящем номере РФ')}
        </div>
    `;
    document.body.appendChild(panel);

    // Swipe-down на мобильном — закрыть drawer.
    attachSwipeDownToDismiss(panel, '.sp-header', 'fp-open', () => {
        panel.classList.remove('fp-open');
        toggleBtn.classList.remove('is-open');
        toggleBtn.textContent = '⚙ Настройки';
        toggleBtn.setAttribute('aria-label', 'Открыть настройки передней стороны');
    });

    // Гамбургер-кнопка — мобильный toggle (CSS прячет на десктопе).
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'front-toggle';
    toggleBtn.innerHTML = '⚙ Настройки';
    toggleBtn.setAttribute('aria-label', 'Открыть настройки передней стороны');
    document.body.appendChild(toggleBtn);
    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('fp-open');
        const isOpen = panel.classList.contains('fp-open');
        toggleBtn.classList.toggle('is-open', isOpen);
        toggleBtn.textContent = isOpen ? '✕ Закрыть' : '⚙ Настройки';
        toggleBtn.setAttribute('aria-label', isOpen
            ? 'Закрыть настройки передней стороны'
            : 'Открыть настройки передней стороны');
    });

    // Клик вне панели на мобильных — закрыть drawer.
    const onDocClick = (e) => {
        if (!window.matchMedia('(max-width: 768px), (orientation: landscape) and (max-height: 600px)').matches) return;
        if (!panel.classList.contains('fp-open')) return;
        if (panel.contains(e.target)) return;
        if (toggleBtn.contains(e.target)) return;
        panel.classList.remove('fp-open');
        toggleBtn.classList.remove('is-open');
        toggleBtn.textContent = '⚙ Настройки';
        toggleBtn.setAttribute('aria-label', 'Открыть настройки передней стороны');
    };
    document.addEventListener('click', onDocClick);

    // Listeners на тоглы.
    document.getElementById('front-showFlag').addEventListener('change', (e) => {
        frontSettings.showFlag = e.target.checked;
        // Поведение как в editor (updateFlagSettings в js/settings-panel.js):
        // при включённом флаге rusX=14, при выключенном rusX=48 (RUS уходит
        // на место флага). Слайдер flagX при выключенном флаге становится
        // неактивным (opacity 0.5, disabled) — визуально дублирует editor.
        const newRusX = e.target.checked ? 14 : 48;
        frontSettings.rusX = newRusX;
        const advPanel = document.getElementById('front-advanced-panel');
        if (advPanel) {
            const rusInput = advPanel.querySelector('[data-slider-key="rusX"]');
            const rusValue = advPanel.querySelector('.sp-slider-value[data-value-for="rusX"]');
            if (rusInput) rusInput.value = String(newRusX);
            if (rusValue) rusValue.textContent = String(newRusX);
            const flagInput = advPanel.querySelector('[data-slider-key="flagX"]');
            if (flagInput) flagInput.disabled = !e.target.checked;
            // Меняем opacity через style на самом ряду слайдера, чтобы
            // совпадало с поведением editor (.setting-item style.opacity).
            const flagRow = flagInput?.closest('.sp-slider-row');
            if (flagRow) flagRow.style.opacity = e.target.checked ? '1' : '0.5';
        }
        onChange();
    });
    document.getElementById('front-showSideDots').addEventListener('change', (e) => {
        frontSettings.showSideDots = e.target.checked;
        onChange();
    });

    const teardown = () => {
        document.getElementById('front-showFlag')?.removeEventListener('change', arguments[0]);
        document.removeEventListener('click', onDocClick);
        panel.remove();
        toggleBtn.remove();
    };
    return { panel, toggleBtn, teardown };
}

/**
 * Создаёт панель со слайдерами для передней стороны. По структуре и
 * поведению — аналог snap/front-panel: на десктопе постоянно видна, на
 * мобильном — bottom-sheet с гамбургер-кнопкой. Каждый слайдер пишет в
 * frontSettings[key] и зовёт onChange.
 *
 * @param {Object} deps
 * @param {string} deps.id — уникальный id панели (например, 'front-flag').
 *        CSS-селекторы будут `#${id}-panel` и `#${id}-toggle`.
 * @param {string} deps.title — заголовок в шапке панели.
 * @param {string} deps.toggleLabel — короткий текст на гамбургер-кнопке
 *        (используется как aria-label, если задан toggleIconSvg).
 * @param {string} deps.iconSvg — inline SVG для шапки (опц.).
 * @param {string} deps.toggleIconSvg — inline SVG для гамбургер-кнопки
 *        (опц.). Если задан — кнопка рендерит только иконку, без текста.
 * @param {Array<{key,label,min,max,step?,value}>} deps.sliders
 * @param {() => void} deps.onChange — вызывается при любом input.
 * @returns {{ panel: HTMLElement, toggleBtn: HTMLButtonElement, teardown: () => void }}
 */
export function createFrontSliderPanel(deps) {
    const { id, title, toggleLabel, iconSvg = '', toggleIconSvg = '', sliders, onChange, resetButtonLabel, onReset, layout = 'inline' } = deps;
    const fireChange = typeof onChange === 'function' ? onChange : () => {};
    const fireReset = typeof onReset === 'function' ? onReset : null;
    // layout: 'inline' — старый горизонтальный (label+value сверху, slider снизу).
    // layout: 'vertical' — для каждого слайдера: название → картинка → слайдер → значение,
    //                    плюс визуальный разделитель между строками.
    const vertical = layout === 'vertical';

    const panel = document.createElement('div');
    panel.id = `${id}-panel`;
    if (vertical) panel.classList.add('sp-panel-vertical');

    const rowsHtml = sliders.map((s, idx) => {
        const stepAttr = s.step != null ? `step="${s.step}"` : '';
        const safeLabel = String(s.label);
        const safeKey = String(s.key);
        const safeId = `${id}-${safeKey}`;
        // Ориентация картинки: явное поле s.orientation (опц.) или авто по key.
        // Авто: всё, что заканчивается на "Y" — вертикальная (rusY, flagY,
        // numberY, regionY); остальные — горизонтальная (X, AreaWidth, Padding).
        const orientation = s.orientation
            || (/Y$/.test(safeKey) ? 'v' : 'h');
        const iconHtml = s.icon
            ? `<img class="sp-slider-icon sp-slider-icon-${orientation}" src="${String(s.icon)}" alt="" draggable="false" aria-hidden="true">`
            : '';
        const dividerHtml = (vertical && idx < sliders.length - 1)
            ? `<hr class="sp-row-divider" aria-hidden="true">`
            : '';
        if (vertical) {
            return `
                <div class="sp-row sp-slider-row">
                    <div class="sp-name"><b>${safeLabel}</b></div>
                    ${iconHtml}
                    <input type="range" class="sp-slider" id="${safeId}"
                           data-slider-key="${safeKey}"
                           min="${s.min}" max="${s.max}" ${stepAttr}
                           value="${s.value}"
                           aria-label="${safeLabel}">
                    <div class="sp-slider-value" data-value-for="${safeKey}">${s.value}</div>
                </div>
                ${dividerHtml}
            `;
        }
        return `
            <div class="sp-row sp-slider-row">
                <span class="sp-label">
                    <span class="sp-label-name">${iconHtml}<b>${safeLabel}</b></span>
                    <small class="sp-slider-value" data-value-for="${safeKey}">${s.value}</small>
                </span>
                <input type="range" class="sp-slider" id="${safeId}"
                       data-slider-key="${safeKey}"
                       min="${s.min}" max="${s.max}" ${stepAttr}
                       value="${s.value}"
                       aria-label="${safeLabel}">
            </div>
        `;
    }).join('');

    panel.innerHTML = `
        <div class="sp-header">
            ${iconSvg ? `<span class="sp-header-icon" aria-hidden="true">${iconSvg}</span>` : ''}
            ${title}
        </div>
        <div class="sp-body">${rowsHtml}${fireReset ? `<button type="button" class="sp-reset-btn">${resetButtonLabel || '↺ Сбросить'}</button>` : ''}</div>
    `;
    document.body.appendChild(panel);

    if (fireReset) {
        const resetBtn = panel.querySelector('.sp-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                // Хост сам решает, что сбрасывать (фронт/бэк/что-то ещё).
                // После onReset хост должен вернуть панель в актуальное состояние —
                // мы просто зовём onChange на случай, если onReset его не зовёт.
                fireReset();
                fireChange();
            });
        }
    }

    attachSwipeDownToDismiss(panel, '.sp-header', 'fp-open', () => {
        panel.classList.remove('fp-open');
        renderToggle(toggleBtn, false);
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.id = `${id}-toggle`;
    toggleBtn.type = 'button';
    if (toggleLabel) toggleBtn.setAttribute('aria-label', toggleLabel);
    renderToggle(toggleBtn, false);
    document.body.appendChild(toggleBtn);
    toggleBtn.addEventListener('click', () => {
        const willOpen = !panel.classList.contains('fp-open');
        panel.classList.toggle('fp-open', willOpen);
        renderToggle(toggleBtn, willOpen);
    });

    function renderToggle(btn, isOpen) {
        if (toggleIconSvg) {
            // Иконочная кнопка: в открытом состоянии меняем SVG на «закрыть»,
            // в закрытом — возвращаем исходную иконку. Текст не рендерим.
            if (isOpen) {
                btn.innerHTML = '<span class="tg-icon" aria-hidden="true">' + CLOSE_ICON_SVG + '</span>';
            } else {
                btn.innerHTML = '<span class="tg-icon" aria-hidden="true">' + toggleIconSvg + '</span>';
            }
        } else {
            btn.textContent = isOpen ? '✕ Закрыть' : toggleLabel;
        }
    }

    const onDocClick = (e) => {
        if (!window.matchMedia('(max-width: 768px), (orientation: landscape) and (max-height: 600px)').matches) return;
        if (!panel.classList.contains('fp-open')) return;
        if (panel.contains(e.target)) return;
        if (toggleBtn.contains(e.target)) return;
        panel.classList.remove('fp-open');
        renderToggle(toggleBtn, false);
    };
    document.addEventListener('click', onDocClick);

    // Listener'ы на каждый слайдер: input → пишем в frontSettings, обновляем
    // value-метку, зовём onChange. Используем 'input' (не 'change'), чтобы
    // обновление было live — пользователь видит результат сразу при движении.
    const onSliderInput = (e) => {
        const target = e.target;
        const key = target.dataset.sliderKey;
        if (!key) return;
        const num = parseFloat(target.value);
        frontSettings[key] = num;
        const valueEl = panel.querySelector(`.sp-slider-value[data-value-for="${key}"]`);
        if (valueEl) valueEl.textContent = num;
        fireChange();
    };
    panel.addEventListener('input', onSliderInput);

    const teardown = () => {
        panel.removeEventListener('input', onSliderInput);
        document.removeEventListener('click', onDocClick);
        panel.remove();
        toggleBtn.remove();
    };
    return { panel, toggleBtn, teardown };
}

/**
 * Устанавливает обработчик тоггла. Возвращает функцию, отключающую его.
 * @param {Object} deps
 * @param {fabric.Canvas} deps.canvas
 * @param {HTMLElement} deps.sideLabel
 * @param {HTMLCanvasElement} deps.frontCanvas
 * @param {HTMLElement} deps.frontCanvasWrap
 * @param {HTMLInputElement} [deps.frontPlateInput] — опц., управляет номером/регионом
 * @param {() => fabric.Rect} deps.getFrontRect
 * @param {() => void} deps.fitCanvasToViewport
 */
export function initSideToggle(deps) {
    const {
        canvas,
        sideLabel,
        frontCanvas,
        frontCanvasWrap,
        frontPlateInput,
        getFrontRect,
        fitCanvasToViewport
    } = deps;
    // Размеры виртуальной сцены fabric-канвы (для снимков). По
    // умолчанию 1224×252 — это размеры задней стороны брелка в
    // back.html. Если передано явно (например, в js/main.js для
    // legacy editor.html) — используется переданное.
    const PLATE_WIDTH = deps.PLATE_WIDTH || 1224;
    const PLATE_HEIGHT = deps.PLATE_HEIGHT || 252;

    const frontCtx = frontCanvas?.getContext('2d');

    function redrawFront() {
        if (frontCtx) {
            renderFrontOnNativeCanvas(frontCtx, currentNumber, currentRegion);
        }
    }

    // Снимок задней стороны в ПОЛНОМ scene-размере (1224×252 по умолчанию).
    // Без этой обёртки canvas.toDataURL() снимает DOM-канвас, у которого
    // backing-store уменьшен через setDimensions({cssOnly:false}) и
    // setZoom(fitCanvasToViewport) под размер viewport'а — на мобиле в
    // portrait-ориентации это крошечные ~360×74 пикселя, и итоговый PNG
    // мыльный. Эта функция временно возвращает fabric.Canvas в
    // полноразмерный режим, снимает снимок, восстанавливает обратно,
    // чтобы экран не мигнул.
    //
    // Используется в getRearSnapshot и доступно через window.__sideToggle
    // (см. ниже) — back.html через BroadcastChannel('brelok-rear') тоже
    // вызывает, чтобы картинка была резкой при отправке в «Посмотреть результат».
    async function takeHighResRearSnapshot() {
        // Сохраняем текущее визуальное состояние, чтобы после снимка
        // вернуть канвас в точно тот же вид (тот же zoom, те же
        // DOM-размеры) — если этого не сделать, экран прыгнет в
        // scene-размер и пользователь увидит мигание.
        const prevW = canvas.getWidth();
        const prevH = canvas.getHeight();
        const prevZoom = canvas.getZoom();

        // Переключаем канвас в полноразмерный режим сцены.
        // setDimensions с cssOnly:false пересоздаёт backing-store под
        // новый размер — это критично, иначе toDataURL вернёт
        // сохранённый прежний (маленький) буфер. setZoom(1) — без
        // масштабирования; 1 unit сцены = 1 пиксель канвы.
        canvas.setZoom(1);
        canvas.setDimensions(
            {width: PLATE_WIDTH, height: PLATE_HEIGHT},
            {cssOnly: false}
        );
        canvas.renderAll();

        // requestAnimationFrame — между изменением размеров и toDataURL
        // нужен гот-кадр, иначе на некоторых браузерах (iOS Safari)
        // toDataURL может снять пустой буфер, потому что растровый
        // backing-store рисуется асинхронно после setDimensions.
        await new Promise((r) => requestAnimationFrame(r));

        const lower = canvas.lowerCanvasEl;
        const dataURL = lower
            ? lower.toDataURL('image/png')
            : canvas.toDataURL('image/png');

        // Восстанавливаем прежние DOM-размеры и zoom. cssOnly:false,
        // чтобы backing-store тоже схлопнулся обратно к displayW×displayH
        // (иначе CSS-канвас останется 1224×252 и растянется до
        // aspect-ratio своего DOM).
        canvas.setDimensions(
            {width: prevW, height: prevH},
            {cssOnly: false}
        );
        if (prevZoom !== 1) {
            canvas.setZoom(prevZoom);
        }
        canvas.requestRenderAll();

        return dataURL;
    }

    function onPlateChange() {
        const { number, region } = parsePlateInput(frontPlateInput?.value);
        currentNumber = number;
        currentRegion = region;
        redrawFront();
    }

    let detachValidation = () => {};
    if (frontPlateInput) {
        // Стартовое состояние берём из value инпута, чтобы совпадало с
        // тем, что увидит пользователь на канвасе.
        const initial = parsePlateInput(frontPlateInput.value);
        currentNumber = initial.number;
        currentRegion = initial.region;
        detachValidation = setupPlateInputValidation(frontPlateInput, onPlateChange);
    }

    // Панель «Общие настройки» для передней стороны (тоглы showFlag / showSideDots).
    // При любом изменении тогла — перерисовываем канву с новыми настройками.
    // Эта панель доступна всем клиентам.
    const { teardown: detachFrontPanel } = createFrontPanel({
        onChange: redrawFront
    });

    // Сводная панель «Расширенные настройки» — для производителей, не для
    // клиентов. Содержит ВСЕ позиционные/размерные слайдеры передней стороны
    // (раньше были в editor.html, теперь перенесены сюда). Доступна через
    // гамбургер-кнопку и на десктопе, и на мобильном — на десктопе она
    // постоянно видна в правом нижнем углу (как snap-panel), на мобильном
    // выезжает снизу по тапу на гамбургер.
    const ADVANCED_PANEL = {
        id: 'front-advanced',
        title: '🛠 Расширенные настройки',
        toggleLabel: 'Расширенные настройки',
        // Юникод-эмодзи «гаечный ключ» для гамбургер-кнопки — рендерим только значок,
        // без текста «Расшир.» (название панели уже видно в её шапке).
        toggleIconSvg: '🔧',
        sliders: [
            // Флаг и RUS
            { key: 'rusX', label: 'RUS X', min: 0, max: 100, value: frontSettings.rusX, icon: 'images/settings/rus-x.png' },
            { key: 'rusY', label: 'RUS Y', min: 0, max: 100, value: frontSettings.rusY, icon: 'images/settings/rus-y.png' },
            { key: 'flagX', label: 'Флаг X', min: 0, max: 100, value: frontSettings.flagX, icon: 'images/settings/flag-x.png' },
            { key: 'flagY', label: 'Флаг Y', min: -50, max: 50, value: frontSettings.flagY, icon: 'images/settings/flag-y.png' },
            // Номер
            { key: 'numberY', label: 'Номер Y', min: -50, max: 100, value: frontSettings.numberY, icon: 'images/settings/num-y.png' },
            { key: 'numberX', label: 'Номер X', min: -100, max: 100, value: frontSettings.numberX, icon: 'images/settings/num-x.png' },
            { key: 'numberAreaWidth', label: 'Ширина номера', min: 400, max: 600, value: frontSettings.numberAreaWidth, icon: 'images/settings/num-len.png' },
            { key: 'numberPadding', label: 'Отступ номера', min: 0, max: 50, value: frontSettings.numberPadding, icon: 'images/settings/num-off.png' },
            // Регион
            { key: 'regionY', label: 'Регион Y', min: 0, max: 150, value: frontSettings.regionY, icon: 'images/settings/reg-y.png' },
            { key: 'regionX', label: 'Регион X', min: -100, max: 100, value: frontSettings.regionX, icon: 'images/settings/reg-x.png' },
            { key: 'regionAreaWidth', label: 'Ширина региона', min: 150, max: 300, value: frontSettings.regionAreaWidth, icon: 'images/settings/reg-len.png' }
        ]
    };

    const detachAdvancedPanel = createFrontSliderPanel({
        ...ADVANCED_PANEL,
        layout: 'vertical',
        onChange: redrawFront,
        resetButtonLabel: '↺ Сбросить настройки',
        onReset: () => {
            // Сбрасываем все слайдеры панели к DEFAULT_SETTINGS и обновляем DOM.
            const panel = document.getElementById(`${ADVANCED_PANEL.id}-panel`);
            ADVANCED_PANEL.sliders.forEach((s) => {
                frontSettings[s.key] = DEFAULT_SETTINGS[s.key];
                if (!panel) return;
                const input = panel.querySelector(`[data-slider-key="${s.key}"]`);
                const valueEl = panel.querySelector(`.sp-slider-value[data-value-for="${s.key}"]`);
                if (input) input.value = String(DEFAULT_SETTINGS[s.key]);
                if (valueEl) valueEl.textContent = String(DEFAULT_SETTINGS[s.key]);
            });
            // Синхронизируем чекбокс «Показывать флаг» и состояние flagX-слайдера
            // (rusX уже вернулся к DEFAULT_SETTINGS.rusX = 14 — это соответствует
            // включённому флагу). Чекбокс флага живёт в #front-panel, отдельно.
            const flagCheckbox = document.getElementById('front-showFlag');
            if (flagCheckbox) {
                flagCheckbox.checked = !!DEFAULT_SETTINGS.showFlag;
                frontSettings.showFlag = !!DEFAULT_SETTINGS.showFlag;
            }
            const flagInput = panel?.querySelector('[data-slider-key="flagX"]');
            if (flagInput) flagInput.disabled = !DEFAULT_SETTINGS.showFlag;
            const flagRow = flagInput?.closest('.sp-slider-row');
            if (flagRow) flagRow.style.opacity = DEFAULT_SETTINGS.showFlag ? '1' : '0.5';
        }
    }).teardown;

    // Стартовая сторона — передняя. setSide('front') пройдёт (currentSide='back'),
    // покажет native-канву, скроет fabric-chrome и front-панель сделает видимой.
    // Дополнительной инициализации не нужно — setSide делает всё: font-load gate,
    // fitCanvasToViewport, value из currentNumber/currentRegion.
    setSide('front');

    function setSide(side) {
        if (side === currentSide) return;
        currentSide = side;
        if (sideLabel) {
            sideLabel.dataset.side = side;
            sideLabel.textContent = side === 'front' ? '🚗 Передняя сторона' : '🎨 Задняя сторона';
        }

        if (side === 'front') {
            // Снимаем .ready-гард с body — панели (#front-panel, #snap-panel и т.д.)
            // появятся сразу, без flicker'а на init. CSS-правило body:not(.ready)
            // скрывало их до setSide, чтобы не было видно back-canvas и панелей
            // во время инициализации.
            document.body.classList.add('ready');
            document.querySelector('.back-canvas-wrap')?.setAttribute('hidden', '');
            setUserObjectsVisible(canvas, getFrontRect, false);
            hideBackChrome();
            // Панель «Общие настройки» и её гамбургер-кнопка привязаны к передней
            // стороне: показываются здесь, прячутся в ветке `back` ниже.
            document.getElementById('front-panel')?.style.removeProperty('display');
            document.getElementById('front-toggle')?.style.removeProperty('display');
            // Сводная панель «Расширенные настройки» — только на front.
            document.getElementById(`${ADVANCED_PANEL.id}-panel`)?.style.removeProperty('display');
            document.getElementById(`${ADVANCED_PANEL.id}-toggle`)?.style.removeProperty('display');
            frontCanvasWrap?.removeAttribute('hidden');
            fitCanvasToViewport();
            // Пока шрифт GibddFont не загружен — блокируем input и очищаем value,
            // чтобы юзер не увидел ввод, отрисованный fallback'ом (Arial).
            // После загрузки — разблокируем и восстановим value из currentNumber/currentRegion.
            if (frontPlateInput) {
                frontPlateInput.disabled = true;
                frontPlateInput.value = '';
            }
            // Ждём готовности шрифта GibddFont, чтобы текст номера нарисовался
            // им же, что в editor.html. Если шрифт не загрузится — fallback на
            // Arial Black из стека в drawing-front.js.
            (document.fonts?.load
                ? document.fonts.load('bold 160px "GibddFont"', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
                : Promise.resolve()
            ).finally(() => {
                redrawFront();
                if (frontPlateInput) {
                    frontPlateInput.disabled = false;
                    const region = currentRegion || '';
                    frontPlateInput.value = currentNumber + (region ? ' ' + region : '');
                }
            });
        } else {
            frontCanvasWrap?.setAttribute('hidden', '');
            document.querySelector('.back-canvas-wrap')?.removeAttribute('hidden');
            setUserObjectsVisible(canvas, getFrontRect, true);
            restoreBackChrome();
            // Прячем панель «Общие настройки» и её гамбургер — она принадлежит
            // только передней стороне. На десктопе панель была бы видна рядом с
            // тканью задней стороны и вводила бы в заблуждение, на мобильном
            // гамбургер перекрывал бы нижние кнопки задней стороны.
            document.getElementById('front-panel')?.style.setProperty('display', 'none', 'important');
            document.getElementById('front-toggle')?.style.setProperty('display', 'none', 'important');
            // Сводная панель «Расширенные настройки» — тоже только для front.
            document.getElementById(`${ADVANCED_PANEL.id}-panel`)?.style.setProperty('display', 'none', 'important');
            document.getElementById(`${ADVANCED_PANEL.id}-toggle`)?.style.setProperty('display', 'none', 'important');
            fitCanvasToViewport();
            canvas.requestRenderAll();
        }
    }

    function onClick() {
        setSide(currentSide === 'back' ? 'front' : 'back');
    }
    function onKey(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSide(currentSide === 'back' ? 'front' : 'back');
        }
    }

    if (sideLabel) {
        sideLabel.addEventListener('click', onClick);
        sideLabel.addEventListener('keydown', onKey);
    }

    // Делаем геттер и команды видимости доступными для classic-скриптов в
    // back.html (initFontPanel / initLogoPanel создают панели после загрузки
    // модуля и должны подавить свой «показ» на стороне front). Также
    // rear-snapshot в back.html работает в обычном <script> и не может
    // импортировать модуль напрямую.
    if (typeof window !== 'undefined') {
        window.__sideToggle = {
            getCurrentSide,
            // Снимок задней стороны в полноразмерном виде (1224×252).
            // Используется из back.html через BroadcastChannel('brelok-rear')
            // и из getRearSnapshot внутри модуля. Возвращает data:URL PNG.
            takeHighResRearSnapshot,
            // Программное переключение стороны — нужно, например, чтобы
            // модалка предпросмотра открывала редактор нужной стороны
            // по клику на карман плашки, а не через тоггл #canvas-label.
            // No-op, если уже на этой стороне.
            setSide(side) {
                if (side !== 'front' && side !== 'back') return;
                if (side === currentSide) return;
                setSide(side);
            },
            // Вызывается после создания #font-panel / #logo-panel, если они
            // появились уже после setSide('front') (иначе hideBackChrome их
            // пропустил, потому что querySelectorAll их ещё не видел).
            // Если активна back — панель должна быть видна, ничего не делаем.
            syncChromeVisibility() {
                if (currentSide === 'front') hideBackChrome();
            },
            // Снимок задней стороны «как есть». На активной back просто берёт
            // toDataURL. На активной front — временно показывает user-объекты
            // (которые были спрятаны в setSide), снимает снимок и возвращает
            // visible=false, чтобы UI не мигнул. Используется модалкой
            // «Посмотреть результат», чтобы получить корректный backDataURL
            // независимо от текущей стороны.
            getRearSnapshot() {
                // discardActiveObject обязателен в обеих ветках: если перед
                // кликом пользователь тапнул по объекту, на снимке остались бы
                // голубые рамки выделения и уголки mtr (Fabric рисует их в
                // нижний канвас поверх самих объектов).
                const wasActive = canvas.getActiveObject();
                canvas.discardActiveObject();
                let url;
                try {
                    if (currentSide === 'back') {
                        canvas.renderAll();
                        url = takeHighResRearSnapshot();
                    } else {
                        // currentSide === 'front': временно показываем user-объекты.
                        setUserObjectsVisible(canvas, getFrontRect, true);
                        canvas.renderAll();
                        url = takeHighResRearSnapshot();
                    }
                } finally {
                    if (currentSide !== 'back') {
                        setUserObjectsVisible(canvas, getFrontRect, false);
                    }
                    if (wasActive) {
                        canvas.setActiveObject(wasActive);
                        canvas.requestRenderAll();
                    }
                }
                return url;
            },
            // Принудительно перерисовать переднюю сторону в нативный канвас.
            // Используется перед снятием снимка, если пользователь нажал
            // «Посмотреть результат», не переключаясь на front — иначе
            // frontCanvas остаётся пустым с момента загрузки страницы.
            ensureFrontRendered() {
                if (typeof redrawFront === 'function') redrawFront();
            },
            // Текущие номер/регион — обновляются при вводе в #frontPlateInput
            // (см. onPlateChange). Используются при сборке подписи в Telegram,
            // чтобы оператор видел, что именно заказал клиент.
            getPlate() {
                return { number: currentNumber, region: currentRegion };
            },
            // Снимок front-настроек (без frontSettings.number/region — те берутся
            // через getPlate). Нужен для сериализации брелка в .brelok-config.json.
            getFrontSnapshot() {
                return {
                    number: currentNumber,
                    region: currentRegion,
                    showFlag: frontSettings.showFlag,
                    showSideDots: frontSettings.showSideDots,
                    rusX: frontSettings.rusX,
                    rusY: frontSettings.rusY,
                    flagX: frontSettings.flagX,
                    flagY: frontSettings.flagY,
                    numberX: frontSettings.numberX,
                    numberY: frontSettings.numberY,
                    numberAreaWidth: frontSettings.numberAreaWidth,
                    numberPadding: frontSettings.numberPadding,
                    regionX: frontSettings.regionX,
                    regionY: frontSettings.regionY,
                    regionAreaWidth: frontSettings.regionAreaWidth,
                };
            },
            // Применить front-снимок: записать во frontSettings, обновить DOM
            // (тоглы, слайдеры расширенных настроек), вписать номер/регион,
            // перерисовать обе стороны. Используется applyBrelokConfig.
            applyFrontSnapshot(snapshot) {
                if (!snapshot || typeof snapshot !== 'object') return;
                // Тоглы: showFlag, showSideDots
                ['showFlag', 'showSideDots'].forEach((k) => {
                    if (k in snapshot) {
                        frontSettings[k] = !!snapshot[k];
                        const el = document.getElementById(`front-${k}`);
                        if (el) el.checked = frontSettings[k];
                    }
                });
                // Слайдеры расширенных настроек: ищем по data-slider-key
                const advPanel = document.getElementById('front-advanced-panel');
                if (advPanel) {
                    advPanel.querySelectorAll('[data-slider-key]').forEach((input) => {
                        const key = input.dataset.sliderKey;
                        if (key in snapshot && key in frontSettings) {
                            const v = Number(snapshot[key]);
                            if (!Number.isFinite(v)) return;
                            frontSettings[key] = v;
                            input.value = String(v);
                            const valueEl = advPanel.querySelector(
                                `.sp-slider-value[data-value-for="${key}"]`
                            );
                            if (valueEl) valueEl.textContent = String(v);
                        }
                    });
                }
                // Номер/регион — пишем в frontPlateInput, вызывая его input-обработчик,
                // чтобы parsePlateInput обновил currentNumber/currentRegion.
                if (typeof snapshot.number === 'string' || typeof snapshot.region === 'string') {
                    const inp = document.getElementById('frontPlateInput');
                    if (inp) {
                        const num = (typeof snapshot.number === 'string')
                            ? snapshot.number.slice(0, 6) : '';
                        const reg = (typeof snapshot.region === 'string')
                            ? snapshot.region.replace(/\D/g, '').slice(0, 3) : '';
                        const composed = (num + (reg ? ' ' + reg : '')).slice(0, 10);
                        inp.value = composed;
                        inp.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
                // Перерисовка обеих сторон (как при ручном изменении слайдера).
                if (typeof redrawFront === 'function') redrawFront();
                if (canvas && typeof canvas.requestRenderAll === 'function') {
                    canvas.requestRenderAll();
                }
            },
        };
    }

    teardown = () => {
        if (sideLabel) {
            sideLabel.removeEventListener('click', onClick);
            sideLabel.removeEventListener('keydown', onKey);
        }
        detachValidation();
        detachFrontPanel();
        detachAdvancedPanel();
        teardown = null;
        if (typeof window !== 'undefined' && window.__sideToggle) {
            delete window.__sideToggle;
        }
    };
    return teardown;
}
