// ============================================
// ОБЩИЕ ФУНКЦИИ РИСОВАНИЯ
// ============================================

let ctx = null;

/**
 * Устанавливает контекст рисования
 * @param {CanvasRenderingContext2D} context - Контекст канваса
 */
export function setDrawingContext(context) {
    ctx = context;
}

/**
 * Рисует скругленный прямоугольник
 * @param {number} x - X координата
 * @param {number} y - Y координата
 * @param {number} width - Ширина
 * @param {number} height - Высота
 * @param {number} radius - Радиус скругления
 * @param {string} fillStyle - Цвет заливки
 * @param {string} strokeStyle - Цвет обводки
 * @param {number} lineWidth - Толщина обводки
 */
export function drawRoundedRect(x, y, width, height, radius, fillStyle, strokeStyle = null, lineWidth = 0) {
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();

    if (fillStyle) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
    }

    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }
}

/**
 * Рисует фон с тенью
 * @param {number} width - Ширина
 * @param {number} height - Высота
 * @param {number} scaleFactor - Коэффициент масштабирования
 */
export function drawBackground(width, height, scaleFactor) {
    if (!ctx) return;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 15 * scaleFactor;
    ctx.shadowOffsetY = 5 * scaleFactor;
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
}

/**
 * Рисует внутренний фон макета
 * @param {number} width - Ширина
 * @param {number} height - Высота
 * @param {number} scaleFactor - Коэффициент масштабирования
 * @param {number} borderRadius - Радиус скругления
 */
export function drawInnerBackground(width, height, scaleFactor, borderRadius) {
    if (!ctx) return;

    ctx.save();
    ctx.fillStyle = '#f5f5f5';
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 5 * scaleFactor;
    ctx.shadowOffsetY = 2 * scaleFactor;
    drawRoundedRect(
        5 * scaleFactor, 5 * scaleFactor,
        width - (10 * scaleFactor), height - (10 * scaleFactor),
        borderRadius * scaleFactor,
        '#f5f5f5'
    );
    ctx.restore();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
}

/**
 * Рисует точки по бокам
 */
export function drawSideDots(ctx, width, height, settings, scaleFactor) {
    if (!settings.showSideDots) return;

    const dotSize = (settings.dotSize || 8) * scaleFactor;
    const dotOffset = (settings.dotOffset || 15) * scaleFactor;
    const centerY = height / 2;

    ctx.save();
    ctx.fillStyle = '#000000';

    // Левая точка (по центру)
    ctx.beginPath();
    ctx.arc(dotOffset, centerY, dotSize/2, 0, Math.PI * 2);
    ctx.fill();

    // Правая точка (по центру)
    ctx.beginPath();
    ctx.arc(width - dotOffset, centerY, dotSize/2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}
