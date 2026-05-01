// ============================================
// ОТРИСОВКА ЗАДНЕЙ СТОРОНЫ (ТЕКСТ + ЛОГОТИПЫ)
// ============================================

import { CONFIG } from './config.js';
import { drawRoundedRect } from './drawing-utils.js';
import { parseTextWithLogos, getLogoByFile } from './logos.js';

let ctx = null;
let settings = {};
const { SCALE_FACTOR } = CONFIG;

/**
 * Устанавливает контекст рисования и настройки
 */
export function setBackContext(context, appSettings) {
    ctx = context;
    settings = appSettings;
}

/**
 * Рисует заднюю сторону с поддержкой логотипов в тексте
 */
/**
 * Рисует заднюю сторону с поддержкой логотипов в тексте
 */
export async function drawBackSide(fragments, fontSize, fontWeight, color, plateWidth, plateHeight) {
    if (!ctx) return;

    // Обратная совместимость со строкой
    let parsedFragments = fragments;
    if (typeof fragments === 'string') {
        parsedFragments = parseTextWithLogos(fragments || '🚗 МОЯ ТАЧКА 🚗');
    }
    if (!parsedFragments || parsedFragments.length === 0) {
        parsedFragments = [{ type: 'text', content: '🚗 МОЯ ТАЧКА 🚗' }];
    }
    const scaledMargin = settings.margin * SCALE_FACTOR;
    const scaledBackTextPadding = (settings.backTextPadding || 0) * SCALE_FACTOR;
    const scaledBackTextY = (settings.backTextY || 11) * SCALE_FACTOR;
    const lineSpacing = settings.backTextLineSpacing || 1.2;
    const maxWidthPercent = settings.backTextMaxWidth || 1.0;
    const textAlign = settings.backTextAlign || 'center';
    const fontFamily = settings.backFontFamily || 'Arial, sans-serif';

    // УБИРАЕМ dotOffset и contentOffset - они больше не нужны

    // БЕЛЫЙ ПРЯМОУГОЛЬНИК - на всю ширину
    const innerWidth = plateWidth - (scaledMargin * 2);
    const innerHeight = plateHeight - (scaledMargin * 2);
    const innerX = scaledMargin;
    const innerY = scaledMargin;

    drawRoundedRect(
        innerX, innerY,
        innerWidth, innerHeight,
        settings.innerBorderRadius * SCALE_FACTOR,
        '#FFFFFF'
    );

    ctx.save();
    ctx.font = `${fontWeight} ${fontSize * SCALE_FACTOR}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';

    // Разбираем текст на фрагменты
    // Используем переданные фрагменты
    const contentFragments = parsedFragments;

    // Доступная ширина для текста - БЕЗ вычета точек
    const availableWidth = innerWidth - (scaledBackTextPadding * 2);
    const maxLineWidth = availableWidth * maxWidthPercent;

    // Стартовая позиция для текста - БЕЗ сдвига
    const contentStartX = innerX;
    const contentWidth = innerWidth;

    // Разбиваем на строки с учетом логотипов
    const lines = await wrapTextWithLogos(contentFragments, maxLineWidth, fontSize, fontWeight, fontFamily);

    // Вычисляем позиции
    const lineHeight = fontSize * SCALE_FACTOR * lineSpacing;
    const textBlockHeight = lines.length * lineHeight;
    const baseY = innerY + (innerHeight - textBlockHeight) / 2 + lineHeight/2 + scaledBackTextY;

    // Рисуем строки
    let y = baseY;
    for (const line of lines) {
        await drawLine(
            line,
            contentStartX,
            contentWidth,
            scaledBackTextPadding,
            y,
            textAlign,
            fontSize,
            fontWeight,
            fontFamily,
            color
        );
        y += lineHeight;
    }

    ctx.restore();
}

/**
 * Разбивает текст с логотипами на строки
 */
async function wrapTextWithLogos(fragments, maxWidth, fontSize, fontWeight, fontFamily) {
    const lines = [];
    let currentLine = [];
    let currentWidth = 0;

    ctx.save();
    ctx.font = `${fontWeight} ${fontSize * SCALE_FACTOR}px ${fontFamily}`;

    for (const fragment of fragments) {
        if (fragment.type === 'text') {
            // Разбиваем длинный текст на слова
            const words = fragment.content.split(' ');

            for (const word of words) {
                const wordWidth = ctx.measureText(word + ' ').width;

                if (currentWidth + wordWidth > maxWidth && currentLine.length > 0) {
                    lines.push([...currentLine]);
                    currentLine = [];
                    currentWidth = 0;
                }

                currentLine.push({ type: 'text', content: word + ' ' });
                currentWidth += wordWidth;
            }
        } else {
            const logoFileName = fragment.file || fragment.brand;
            const logo = await getLogoByFile(logoFileName);
            if (logo) {
                const logoWidth = fontSize * SCALE_FACTOR * 1.2;

                if (currentWidth + logoWidth > maxWidth && currentLine.length > 0) {
                    lines.push([...currentLine]);
                    currentLine = [];
                    currentWidth = 0;
                }

                currentLine.push(fragment);
                currentWidth += logoWidth + 4; // + отступ
            }
        }
    }

    if (currentLine.length > 0) {
        lines.push(currentLine);
    }

    ctx.restore();
    return lines;
}

/**
 * Рисует одну строку с текстом и логотипами
 */
async function drawLine(fragments, innerX, innerWidth, padding, y, textAlign, fontSize, fontWeight, fontFamily, color) {
    let x;

    // Сначала вычисляем ширину строки
    let lineWidth = 0;
    ctx.save();
    ctx.font = `${fontWeight} ${fontSize * SCALE_FACTOR}px ${fontFamily}`;

    for (const fragment of fragments) {
        if (fragment.type === 'text') {
            lineWidth += ctx.measureText(fragment.content).width;
        } else {
            lineWidth += fontSize * SCALE_FACTOR * 1.2 + 4;
        }
    }
    ctx.restore();

    // Определяем начальную позицию в зависимости от выравнивания
    switch(textAlign) {
        case 'left':
            x = innerX + padding;
            break;
        case 'right':
            x = innerX + innerWidth - padding - lineWidth;
            break;
        default: // center
            x = innerX + (innerWidth - lineWidth) / 2;
    }

    // Рисуем фрагменты
    for (const fragment of fragments) {
        if (fragment.type === 'text') {
            ctx.save();
            ctx.font = `${fontWeight} ${fontSize * SCALE_FACTOR}px ${fontFamily}`;
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(fragment.content, x, y);
            ctx.restore();

            x += ctx.measureText(fragment.content).width;
        } else {
            const logoFileName = fragment.file || fragment.brand;
            const logo = await getLogoByFile(logoFileName);
            if (logo) {
                const logoHeight = fontSize * SCALE_FACTOR;
                const logoWidth = logoHeight * (logo.width / logo.height);

                ctx.save();
                // Применяем смещение логотипа по Y
                ctx.drawImage(logo, x, y - logoHeight/2 + (settings.backLogoY || 0) * SCALE_FACTOR, logoWidth, logoHeight);
                ctx.restore();

                x += logoWidth + 4;
            }
        }
    }
}