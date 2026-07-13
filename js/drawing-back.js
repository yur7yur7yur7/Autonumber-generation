// ============================================
// ОТРИСОВКА ЗАДНЕЙ СТОРОНЫ (ТЕКСТ + ЛОГОТИПЫ)
// ============================================

import { CONFIG, AVAILABLE_FONTS } from './config.js';
import { drawRoundedRect } from './drawing-utils.js';
import { parseTextWithLogos, getLogoByFile } from './logos.js';
import { loadFont } from './font-loader.js';
import { setLastDrawnElements } from './element-registry.js';

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

    // Загружаем шрифт если нужно
    const fontFamily = settings.backFontFamily || 'Arial, sans-serif';
    const fontObj = AVAILABLE_FONTS.find(f => f.value === fontFamily);
    if (fontObj && fontObj.file) {
        await loadFont(fontObj.name, fontObj.file);
    }

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
    const scaledBackTextX = (settings.backTextX || 0) * SCALE_FACTOR;
    const scaledBackTextY = (settings.backTextY || 11) * SCALE_FACTOR;
    const lineSpacing = settings.backTextLineSpacing || 1.2;
    const maxWidthPercent = settings.backTextMaxWidth || 1.0;
    const textAlign = settings.backTextAlign || 'center';

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
    const contentStartX = innerX + scaledBackTextX;
    const contentWidth = innerWidth;

    // ===== Decoupled text/logo rendering =====
    // Text fragments wrap on their own — adding/removing a logo does not change line
    // breaks. Logos draw in a separate pass at their own per-file positions.
    const textFragments = parsedFragments.filter(f => f.type === 'text');
    const logoFragments = parsedFragments.filter(f => f.type !== 'text');

    const lines = await wrapTextWithLogos(textFragments, maxLineWidth, fontSize, fontWeight, fontFamily);

    // Вычисляем позиции
    const lineHeight = fontSize * SCALE_FACTOR * lineSpacing;
    const textBlockHeight = lines.length * lineHeight;
    const baseY = innerY + (innerHeight - textBlockHeight) / 2 + lineHeight/2 + scaledBackTextY;

    const drawnElements = [];
    const textLineBoxes = []; // [{x, y, width, height}] for each rendered line (real ink)

    // ===== Pass 1: render text only =====
    let y = baseY;
    for (let line of lines) {
        const lineStartX = innerX + scaledBackTextX;
        // drawLine now returns an array of per-text-fragment bboxes (logos skipped).
        const textBoxes = await drawLine(
            line,
            lineStartX,
            innerWidth,
            scaledBackTextPadding,
            y,
            textAlign,
            fontSize,
            fontWeight,
            fontFamily,
            color,
            drawnElements
        );
        if (textBoxes && textBoxes.length > 0) {
            for (const box of textBoxes) textLineBoxes.push(box);
        }
        y += lineHeight;
    }

    // Текстовый блок: bounding box, охватывающий только реальные ink-строки (не всю
    // ширину превью). Высота = fontSize * SCALE_FACTOR (одна строка), расширенная на
    // lineSpacing для многострочных случаев. Это даёт ТОЧНУЮ рамку, не огромный бокс.
    if (textLineBoxes.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const box of textLineBoxes) {
            if (box.x < minX) minX = box.x;
            if (box.x + box.width > maxX) maxX = box.x + box.width;
            if (box.y < minY) minY = box.y;
            if (box.y + box.height > maxY) maxY = box.y + box.height;
        }
        drawnElements.unshift({
            type: 'text',
            canvasX: minX,
            canvasY: minY,
            canvasWidth: maxX - minX,
            canvasHeight: maxY - minY,
            index: -1
        });
    }

    // ===== Pass 2: render logos at their per-file positions overlaying the text block =====
    // Logo (x, y) are offsets from the text block's centered anchor (innerX + scaledBackTextX, baseY).
    // baseX here = innerX + scaledBackTextX = contentStartX; baseY is the text block's center.
    const globalLogoSize = settings.backLogoSize || 1.0; // fallback when per-logo size absent
    const positions = settings.backLogoPositions || {};
    for (let logoIdx = 0; logoIdx < logoFragments.length; logoIdx++) {
        const frag = logoFragments[logoIdx];
        const logoFileName = frag.file || frag.brand;
        if (!logoFileName) continue;
        const logo = await getLogoByFile(logoFileName);
        if (!logo) continue;
        const pos = positions[logoFileName] || { x: 0, y: 0 };
        // Per-logo size multiplier; falls back to the global backLogoSize, then to 1.0.
        const logoSize = (typeof pos.size === 'number') ? pos.size : globalLogoSize;
        const logoHeight = fontSize * SCALE_FACTOR * logoSize;
        const logoWidth = logoHeight * (logo.width / logo.height);
        // Logos are anchored to the inner preview rect (innerX, innerY center), NOT
        // to contentStartX/baseY (which shift with backTextX/Y). This decouples logo
        // positions from text drag — moving the text block does not move the logos.
        const previewCenterX = innerX;
        const previewCenterY = innerY + innerHeight / 2;
        const logoX = previewCenterX + pos.x * SCALE_FACTOR;
        const logoY = previewCenterY + pos.y * SCALE_FACTOR - logoHeight / 2;

        ctx.save();
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
        ctx.restore();

        drawnElements.push({
            type: 'logo',
            canvasX: logoX,
            canvasY: logoY,
            canvasWidth: logoWidth,
            canvasHeight: logoHeight,
            index: logoIdx,
            file: logoFileName
        });
    }

    ctx.restore();

    setLastDrawnElements(drawnElements);
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
async function drawLine(fragments, innerX, innerWidth, padding, y, textAlign, fontSize, fontWeight, fontFamily, color, drawnElements) {
    let x;

    // Сначала вычисляем ширину строки (текст-фрагменты; лого не передаются сюда —
// они рисуются отдельным проходом в drawBackSide Pass 2)
    let lineWidth = 0;
    ctx.save();
    ctx.font = `${fontWeight} ${fontSize * SCALE_FACTOR}px ${fontFamily}`;

    for (const fragment of fragments) {
        if (fragment.type === 'text') {
            lineWidth += ctx.measureText(fragment.content).width;
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

    // Запоминаем стартовую X для возврата реального bbox
    const lineStartX = x;

    // Собираем bbox'ы только для text-фрагментов — PNG-лого имеют собственные bbox'ы,
    // которые уже пишутся в drawnElements напрямую. Возвращаем массив, чтобы text-bbox
    // НЕ расширялся на лого (тогда хиты текста и лого не перекрываются).
    const textBoxes = [];
    const lineHeight = fontSize * SCALE_FACTOR;

    // Рисуем ТОЛЬКО text-фрагменты. Лого рисуются в Pass 2 из drawBackSide.
    for (const fragment of fragments) {
        if (fragment.type !== 'text') continue;
        const textWidth = ctx.measureText(fragment.content).width;

        ctx.save();
        ctx.font = `${fontWeight} ${fontSize * SCALE_FACTOR}px ${fontFamily}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(fragment.content, x, y);
        ctx.restore();

        // Bbox этого text-фрагмента: от текущего x до x + textWidth, по высоте — fontSize.
        textBoxes.push({
            x,
            y: y - lineHeight / 2,
            width: textWidth,
            height: lineHeight
        });

        x += textWidth;
    }

    return textBoxes;
}