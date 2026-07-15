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
// это номер (любая кириллица/латиница, транслитерируется в drawFrontSide),
// остаток — только цифры (код региона, 2-3 знака).
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
let currentNumber = 'М777ММ';
let currentRegion = '777';

const FRONT_HIDE_SELECTORS = [
    '#font-toggle', '#logo-toggle', '#snap-toggle',
    '#create-maket', '#maket-toast',
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
//   - первые 6 символов — номер (всё, что угодно, фильтруется внутри getDisplayNumber);
//   - остаток — только цифры, обрезается до 3 знаков.
function parsePlateInput(value) {
    const v = (value || '').toUpperCase();
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
        showSideDots: false,
        showFlag: true,
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

    function onPlateInput() {
        const { number, region } = parsePlateInput(frontPlateInput?.value);
        currentNumber = number;
        currentRegion = region;
        redrawFront();
    }

    if (frontPlateInput) {
        // Стартовое состояние берём из value инпута, чтобы совпадало с
        // тем, что увидит пользователь на канвасе.
        const initial = parsePlateInput(frontPlateInput.value);
        currentNumber = initial.number;
        currentRegion = initial.region;
        frontPlateInput.addEventListener('input', onPlateInput);
    }

    function setSide(side) {
        if (side === currentSide) return;
        currentSide = side;
        if (sideLabel) {
            sideLabel.dataset.side = side;
            sideLabel.textContent = side === 'front' ? '🚗 Передняя сторона' : '🎨 Задняя сторона';
        }

        if (side === 'front') {
            document.querySelector('.back-canvas-wrap')?.setAttribute('hidden', '');
            setUserObjectsVisible(canvas, getFrontRect, false);
            hideBackChrome();
            frontCanvasWrap?.removeAttribute('hidden');
            fitCanvasToViewport();
            // Ждём готовности шрифта GibddFont, чтобы текст номера нарисовался
            // им же, что в editor.html. Если шрифт не загрузится — fallback на
            // Arial Black из стека в drawing-front.js.
            (document.fonts?.load
                ? document.fonts.load('bold 160px "GibddFont"', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
                : Promise.resolve()
            ).finally(redrawFront);
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
        if (frontPlateInput) {
            frontPlateInput.removeEventListener('input', onPlateInput);
        }
        teardown = null;
        if (typeof window !== 'undefined' && window.__sideToggle) {
            delete window.__sideToggle;
        }
    };
    return teardown;
}
