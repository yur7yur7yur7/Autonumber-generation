// ============================================
// ОТРИСОВКА ПЕРЕДНЕЙ СТОРОНЫ (НОМЕР)
// ============================================

import { CONFIG } from './config.js';
import { drawRoundedRect } from './drawing-utils.js';
import { getDisplayNumber } from './transliteration.js';

let ctx = null;
let settings = {};
const { SCALE_FACTOR, LETTER_HEIGHT, DIGIT_HEIGHT, REGION_HEIGHT, FLAG_HEIGHT } = CONFIG;

/**
 * Устанавливает контекст рисования и настройки
 * @param {CanvasRenderingContext2D} context - Контекст канваса
 * @param {Object} appSettings - Настройки приложения
 */
export function setFrontContext(context, appSettings) {
    ctx = context;
    settings = appSettings;
}

/**
 * Рисует переднюю сторону
 * @param {string} plateNumber - Номер
 * @param {string} region - Регион
 * @param {number} plateWidth - Ширина пластины
 * @param {number} plateHeight - Высота пластины
 */
export function drawFrontSide(plateNumber, region, plateWidth, plateHeight) {
    if (!ctx) return;

    const scaledMargin = settings.margin * SCALE_FACTOR;
    const scaledNumberY = settings.numberY * SCALE_FACTOR;
    const scaledRegionY = settings.regionY * SCALE_FACTOR;
    const scaledRusX = settings.rusX * SCALE_FACTOR;
    const scaledRusY = settings.rusY * SCALE_FACTOR;
    const scaledFlagX = settings.flagX * SCALE_FACTOR;
    const scaledFlagY = settings.flagY * SCALE_FACTOR;
    const scaledNumberAreaWidth = settings.numberAreaWidth * SCALE_FACTOR;
    const scaledRegionAreaWidth = settings.regionAreaWidth * SCALE_FACTOR;
    const scaledInnerBorderRadius = settings.innerBorderRadius * SCALE_FACTOR;
    const scaledPadding = settings.numberPadding * SCALE_FACTOR;

    // Отступ для контента из-за точек
    const dotOffset = settings.showSideDots ? (settings.dotOffset || 15) * SCALE_FACTOR : 0;
    const contentOffset = dotOffset * 1.5;

    // БЕЛЫЙ ПРЯМОУГОЛЬНИК ДЛЯ НОМЕРА - БЕЗ СДВИГА (на всю ширину)
    const numberRectX = scaledMargin;
    const numberRectY = scaledMargin;
    const numberRectWidth = scaledNumberAreaWidth;
    const numberRectHeight = plateHeight - (scaledMargin * 2);

    drawRoundedRect(
        numberRectX, numberRectY,
        numberRectWidth, numberRectHeight,
        scaledInnerBorderRadius,
        '#FFFFFF'
    );

    // БЕЛЫЙ ПРЯМОУГОЛЬНИК ДЛЯ РЕГИОНА - БЕЗ СДВИГА
    const regionRectX = plateWidth - scaledRegionAreaWidth - scaledMargin;
    const regionRectY = scaledMargin;
    const regionRectWidth = scaledRegionAreaWidth;
    const regionRectHeight = plateHeight - (scaledMargin * 2);

    drawRoundedRect(
        regionRectX, regionRectY,
        regionRectWidth, regionRectHeight,
        scaledInnerBorderRadius,
        '#FFFFFF'
    );

    // Получаем номер и регион
    const displayNumber = getDisplayNumber(plateNumber);
    const displayRegion = region || '777';

    // Рисуем номер - СО СДВИГОМ
    drawPlateNumber(
        displayNumber,
        numberRectX + contentOffset + (settings.numberX || 0) * SCALE_FACTOR,
        numberRectY,
        numberRectWidth - (contentOffset * 2),  // ← уменьшаем доступную ширину
        numberRectHeight,
        scaledNumberY,
        scaledPadding
    );

    // Рисуем регион - СО СДВИГОМ
    ctx.font = `bold ${REGION_HEIGHT}px "GibddFont", "Arial Black", Arial, sans-serif`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
        displayRegion,
        regionRectX + regionRectWidth/2 - contentOffset + (settings.regionX || 0) * SCALE_FACTOR,  // ← добавили regionX
        regionRectY + scaledRegionY
    );

    // RUS и флаг - тоже со сдвигом
    drawRusAndFlag(
        regionRectX,  // ← сдвигаем влево
        // regionRectX - contentOffset,  // ← сдвигаем влево
        regionRectY,
        regionRectWidth,
        scaledRegionY,
        scaledRusX,
        scaledRusY,
        scaledFlagX,
        scaledFlagY,
        FLAG_HEIGHT
    );
}

/**
 * Рисует номер с правильными интервалами
 */
function drawPlateNumber(number, rectX, rectY, rectWidth, rectHeight, offsetY, padding) {
    const chars = number.split('');
    const charWidths = [];
    const charTypes = [];

    // Измеряем символы
    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const isDigit = /[0-9]/.test(char);
        const fontSize = isDigit ? DIGIT_HEIGHT : LETTER_HEIGHT;
        ctx.font = `bold ${fontSize}px "GibddFont", "Arial Black", Arial, sans-serif`;
        const metrics = ctx.measureText(char);
        charWidths.push(metrics.width);
        charTypes.push(isDigit ? 'digit' : 'letter');
    }

    const totalCharsWidth = charWidths.reduce((a, b) => a + b, 0);
    const availableWidth = rectWidth - totalCharsWidth - (padding * 2);
    const gapsCount = chars.length - 1;
    let baseSpacing = gapsCount > 0 ? availableWidth / (gapsCount * 1.2) : 0;
    baseSpacing = Math.max(2, Math.min(50, baseSpacing));
    const mixedSpacingMultiplier = 1.5;

    // Рассчитываем общую ширину с интервалами
    let totalWidthWithSpacing = totalCharsWidth;
    for (let i = 1; i < chars.length; i++) {
        const prevType = charTypes[i-1];
        const currentType = charTypes[i];
        let spacing = baseSpacing;
        if (prevType !== currentType) {
            spacing = baseSpacing * mixedSpacingMultiplier;
        }
        totalWidthWithSpacing += spacing;
    }

    // Стартовая позиция
    const startX = rectX + padding + (availableWidth - (totalWidthWithSpacing - totalCharsWidth)) / 2;
    let currentX = startX;
    const numberY = rectY + rectHeight / 2 + offsetY;

    // Рисуем символы
    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const isDigit = /[0-9]/.test(char);
        const fontSize = isDigit ? DIGIT_HEIGHT : LETTER_HEIGHT;
        ctx.font = `bold ${fontSize}px "GibddFont", "Arial Black", Arial, sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(char, currentX, numberY);
        currentX += charWidths[i];

        if (i < chars.length - 1) {
            const prevType = charTypes[i];
            const nextType = charTypes[i + 1];
            let spacing = baseSpacing;
            if (prevType !== nextType) {
                spacing = baseSpacing * mixedSpacingMultiplier;
            }
            currentX += spacing;
        }
    }
}

/**
 * Рисует надпись RUS и флаг
 */
function drawRusAndFlag(regionX, regionY, regionWidth, regionOffset, rusX, rusY, flagX, flagY, flagHeight) {
    const flagWidth = 50 * SCALE_FACTOR;

    ctx.font = `bold ${40 * SCALE_FACTOR}px Arial`;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.fillText('RUS', regionX + rusX, regionY + regionOffset + rusY + flagHeight/2);

    if (settings.showFlag) {
        const flagXPos = regionX + regionWidth - flagWidth - flagX;
        const flagYPos = regionY + regionOffset + rusY - (5 * SCALE_FACTOR) + flagY;

        // Рамка
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5 * SCALE_FACTOR;
        ctx.strokeRect(flagXPos - SCALE_FACTOR, flagYPos - SCALE_FACTOR, flagWidth + 2*SCALE_FACTOR, flagHeight + 2*SCALE_FACTOR);

        // Триколор
        const stripeHeight = flagHeight / 3;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(flagXPos, flagYPos, flagWidth, stripeHeight);
        ctx.fillStyle = '#0039a6';
        ctx.fillRect(flagXPos, flagYPos + stripeHeight, flagWidth, stripeHeight);
        ctx.fillStyle = '#d52b1e';
        ctx.fillRect(flagXPos, flagYPos + 2*stripeHeight, flagWidth, stripeHeight);
    }
}