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
// Настройки передней стороны, управляемые панелью «Общие настройки».
// showFlag — показывать ли триколор-флаг в правой части номера.
// showSideDots — рисовать ли точки по бокам (как на настоящем номере РФ).
const frontSettings = {
    showFlag: true,
    showSideDots: false
};

import { ALLOWED_CHARS, RUS_TO_LAT } from './config.js';
import { showTemporaryMessage } from './validation.js';

const FRONT_HIDE_SELECTORS = [
    '#font-toggle', '#logo-toggle', '#snap-toggle', '#front-toggle',
    '#create-maket', '#maket-toast',
    '#font-panel', '#logo-panel', '#snap-panel', '#front-panel', '#ctx-menu',
    '#rotate-hint'
];

export function getCurrentSide() {
    return currentSide;
}

function getFrontDeps() {
    if (cachedDeps) return Promise.resolve(cachedDeps);
    if (!frontDepsPromise) {
        frontDepsPromise = Promise.all([
            import('./drawing-front.js'),
            import('./drawing-utils.js')
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
    const settings = {
        margin: 7,
        numberY: 25,
        regionY: 74,
        rusX: 14,
        rusY: 32,
        flagX: 19,
        flagY: 1,
        numberAreaWidth: 522,
        regionAreaWidth: 178,
        innerBorderRadius: 18,
        numberPadding: 14,
        numberX: 0,
        regionX: 0,
        showSideDots: frontSettings.showSideDots,
        showFlag: frontSettings.showFlag,
        mainBorderRadius: 18,
        borderThickness: 0
    };
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

    function rowTemplate(label, key, hint) {
        const id = `front-${key}`;
        const on = frontSettings[key];
        return `
            <label class="sp-row" for="${id}">
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
        toggleBtn.textContent = '⚙ Настройки';
    });

    // Гамбургер-кнопка — мобильный toggle (CSS прячет на десктопе).
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'front-toggle';
    toggleBtn.innerHTML = '⚙ Настройки';
    document.body.appendChild(toggleBtn);
    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('fp-open');
        toggleBtn.textContent = panel.classList.contains('fp-open') ? '✕ Закрыть' : '⚙ Настройки';
    });

    // Клик вне панели на мобильных — закрыть drawer.
    const onDocClick = (e) => {
        if (!window.matchMedia('(max-width: 768px), (orientation: landscape) and (max-height: 600px)').matches) return;
        if (!panel.classList.contains('fp-open')) return;
        if (panel.contains(e.target)) return;
        if (toggleBtn.contains(e.target)) return;
        panel.classList.remove('fp-open');
        toggleBtn.textContent = '⚙ Настройки';
    };
    document.addEventListener('click', onDocClick);

    // Listeners на тоглы.
    document.getElementById('front-showFlag').addEventListener('change', (e) => {
        frontSettings.showFlag = e.target.checked;
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

    const frontCtx = frontCanvas?.getContext('2d');

    function redrawFront() {
        if (frontCtx) {
            renderFrontOnNativeCanvas(frontCtx, currentNumber, currentRegion);
        }
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
    const { teardown: detachFrontPanel } = createFrontPanel({
        onChange: redrawFront
    });

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

    // Делаем геттер доступным для classic-скриптов (rear-snapshot в back.html
    // работает в обычном <script> и не может импортировать модуль напрямую).
    if (typeof window !== 'undefined') {
        window.__sideToggle = { getCurrentSide };
    }

    teardown = () => {
        if (sideLabel) {
            sideLabel.removeEventListener('click', onClick);
            sideLabel.removeEventListener('keydown', onKey);
        }
        detachValidation();
        detachFrontPanel();
        teardown = null;
        if (typeof window !== 'undefined' && window.__sideToggle) {
            delete window.__sideToggle;
        }
    };
    return teardown;
}
