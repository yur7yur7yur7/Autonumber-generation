// ============================================================
// Clamp объектов в границах внутренней белой плашки (frontRect)
// + опциональный overlay из 4 чёрных полос вокруг frontRect,
// которые видны при выключенном clamp и скрывают всё, что
// выходит за границы белой плашки.
//
// Два режима задаются через setFrameMode(canvas, 'clamp' | 'cover'):
//   • 'clamp' (по умолчанию) — объекты не могут вылезать за frontRect,
//     overlay скрыт. Видно, как пользователь тащит объект, но он
//     упирается в границу.
//   • 'cover' — clamp выключен, четыре чёрных полосы лежат поверх
//     всех объектов по периметру frontRect. Объекты, вылезающие за
//     белую плашку, скрываются под этими полосами.
// ============================================================

let frameStrips = null;
let currentMode = 'clamp';

function clampObjectToPlate(obj, plate) {
    const b = obj.getBoundingRect(true, true);
    let dx = 0, dy = 0;
    if (b.left < plate.left) dx = plate.left - b.left;
    else if (b.left + b.width > plate.right) dx = plate.right - (b.left + b.width);
    if (b.top < plate.top) dy = plate.top - b.top;
    else if (b.top + b.height > plate.bottom) dy = plate.bottom - (b.top + b.height);
    if (dx === 0 && dy === 0) return false;
    obj.set({ left: obj.left + dx, top: obj.top + dy });
    obj.setCoords();
    return true;
}

/**
 * Создаёт 4 чёрных прямоугольника по периметру frontRect:
 *   - верхняя полоса: y ∈ [0, frontRect.top]
 *   - нижняя полоса: y ∈ [frontRect.bottom, PLATE_H]
 *   - левая полоса: x ∈ [0, frontRect.left], y ∈ [frontRect.top, frontRect.bottom]
 *   - правая полоса: x ∈ [frontRect.right, PLATE_W], y ∈ [frontRect.top, frontRect.bottom]
 * При 'cover' они лежат поверх всех объектов и скрывают только то,
 * что вылезает за frontRect. Сама плашка остаётся видимой.
 */
function buildFrameStrips(canvas, PLATE_W, PLATE_H, frontRect) {
    const strips = [];
    const fx = frontRect.left;
    const fy = frontRect.top;
    const fw = frontRect.width;
    const fh = frontRect.height;

    const makeStrip = (left, top, width, height) => new fabric.Rect({
        left,
        top,
        width,
        height,
        fill: '#000000',
        selectable: false,
        evented: false,
        excludeFromExport: true,
        hoverCursor: 'default',
        __frameStrip: true
    });

    // Верхняя полоса
    if (fy > 0) strips.push(makeStrip(0, 0, PLATE_W, fy));
    // Нижняя полоса
    const bottomStart = fy + fh;
    if (bottomStart < PLATE_H) strips.push(makeStrip(0, bottomStart, PLATE_W, PLATE_H - bottomStart));
    // Левая полоса (только на высоте плашки)
    if (fx > 0) strips.push(makeStrip(0, fy, fx, fh));
    // Правая полоса
    const rightStart = fx + fw;
    if (rightStart < PLATE_W) strips.push(makeStrip(rightStart, fy, PLATE_W - rightStart, fh));

    for (const strip of strips) {
        strip.set({ visible: false });
        canvas.add(strip);
    }
    return strips;
}

function bringStripsToFront(canvas) {
    if (!frameStrips) return;
    for (const strip of frameStrips) {
        canvas.bringToFront(strip);
    }
}

/**
 * Инициализация: создаёт 4 overlay-полосы (если их ещё нет) и подписывается
 * на object:moving для clamp. По умолчанию полосы скрыты (clamp-режим).
 */
export function initFrameOverlay(canvas, PLATE_W, PLATE_H, scaledInnerRadius, frontRect) {
    if (!frameStrips) {
        frameStrips = buildFrameStrips(canvas, PLATE_W, PLATE_H, frontRect);
    }
    // Полосы всегда на самом верху z-стека.
    bringStripsToFront(canvas);

    // Clamp-режим: при moving клампим объект в frontRect.
    const plate = {
        left: frontRect.left,
        top: frontRect.top,
        right: frontRect.left + frontRect.width,
        bottom: frontRect.top + frontRect.height
    };
    canvas.on('object:moving', (e) => {
        // Режим 'clamp' активен по умолчанию; в 'cover' clamp отключён.
        if (currentMode !== 'clamp') return;
        const obj = e.target;
        if (!obj || obj.__guide || obj.__frameStrip || obj.__isFrontRect) return;
        clampObjectToPlate(obj, plate);
    });

    // После добавления нового объекта (логотип, текстбокс) — полосы
    // должны снова оказаться наверху.
    canvas.on('object:added', (e) => {
        const obj = e.target;
        if (!obj || !frameStrips) return;
        if (obj.__frameStrip) return;
        bringStripsToFront(canvas);
    });

    return frameStrips;
}

/**
 * Переключает режим рамки:
 *   'clamp' — clamp включён, полосы скрыты (по умолчанию).
 *   'cover' — clamp выключен, полосы видны поверх объектов.
 */
export function setFrameMode(canvas, mode) {
    currentMode = mode === 'cover' ? 'cover' : 'clamp';
    if (frameStrips) {
        const visible = currentMode === 'cover';
        for (const strip of frameStrips) {
            strip.set({ visible });
        }
        if (visible) bringStripsToFront(canvas);
        canvas.requestRenderAll();
    }
}

export function getFrameMode() {
    return currentMode;
}