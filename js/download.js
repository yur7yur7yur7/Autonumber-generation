// ============================================
// СКАЧИВАНИЕ ФАЙЛОВ
// ============================================

import { showTemporaryMessage } from './validation.js';
import { CONFIG } from './config.js';
// import { setDrawingContext } from './drawing-utils.js';

const { CANVAS_WIDTH, CANVAS_HEIGHT } = CONFIG;

// Глобальные переменные
let mainCtx = null;
let mainSettings = null;
let mainNumberInput = null;
let mainRegionInput = null;
let mainCustomText = null;
let mainTextSize = null;
let mainTextColor = null;
let mainTextWeightBold = null;

/**
 * Устанавливает ссылки на основные объекты из main.js
 */
export function setDownloadContext(ctx, settings, elements) {
    mainCtx = ctx;
    mainSettings = settings;
    mainNumberInput = elements.numberInput;
    mainRegionInput = elements.regionInput;
    mainCustomText = elements.customText;
    mainTextSize = elements.textSize;
    mainTextColor = elements.textColor;
    mainTextWeightBold = elements.textWeightBold;
}

/**
 * Сохраняет обе стороны как один SVG с двумя изображениями рядом
 */
export async function downloadBothSides(canvas, getNumber, getRegion) {
    try {
        showTemporaryMessage('⏳ Генерирую макет...', 'warning');

        // Сохраняем текущую сторону
        const currentSide = document.querySelector('.side-btn.active').dataset.side;

        // Переключаем на переднюю сторону
        document.querySelector('[data-side="front"]').click();
        await new Promise(resolve => setTimeout(resolve, 100));
        const frontData = canvas.toDataURL('image/png');

        // Переключаем на заднюю сторону
        document.querySelector('[data-side="back"]').click();
        await new Promise(resolve => setTimeout(resolve, 100));
        const backData = canvas.toDataURL('image/png');

        // Возвращаем как было
        document.querySelector(`[data-side="${currentSide}"]`).click();

        const interval = 20;
        const totalWidth = CANVAS_WIDTH * 2 + interval;

        const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${(5.18 * 2 + 0.2)}cm" height="1.07cm" viewBox="0 0 ${totalWidth} ${CANVAS_HEIGHT}" 
     preserveAspectRatio="none"
     xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink">
    <image width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xlink:href="${frontData}" />
    <image x="${CANVAS_WIDTH + interval}" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xlink:href="${backData}" />
</svg>`;

        const blob = new Blob([svgString], {type: 'image/svg+xml'});
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.download = `brelok-obe-storony-${getNumber()}-${getRegion()}.svg`;
        link.href = url;
        link.click();

        showTemporaryMessage('✅ Готово! Две стороны', 'success');

    } catch (e) {
        console.error('Ошибка:', e);
        showTemporaryMessage('❌ Ошибка', 'error');
    }
}

/**
 * Сохраняет канвас как SVG (одна сторона)
 */
export async function downloadAsSVG(canvas, currentSide, number, region) {
    try {
        const pngData = canvas.toDataURL('image/png');

        const sideText = currentSide === 'front' ? 'perednyaya' : 'zadnyaya';
        const fileName = `brelok-${sideText}-${number || 'M123MM'}-${region || '777'}.svg`;

        const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="5.18cm" height="1.07cm" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" 
     preserveAspectRatio="none"
     xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink">
    <image width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xlink:href="${pngData}" />
</svg>`;

        const blob = new Blob([svgString], {type: 'image/svg+xml'});
        const url = URL.createObjectURL(blob);

        if (!window.createdUrls) window.createdUrls = [];
        window.createdUrls.push(url);

        const link = document.createElement('a');
        link.download = fileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            window.createdUrls = window.createdUrls.filter(u => u !== url);
        }, 100);

        showTemporaryMessage('✅ SVG сохранен!', 'success');

    } catch (e) {
        console.error('Ошибка:', e);
        throw e;
    }
}

/**
 * Сохраняет канвас как PNG (запасной вариант)
 */
export function downloadAsPNG(canvas, currentSide, number, region) {
    try {
        const sideText = currentSide === 'front' ? 'perednyaya' : 'zadnyaya';
        const fileName = `brelok-${sideText}-${number || 'M123MM'}-${region || '777'}.png`;

        const link = document.createElement('a');
        link.download = fileName;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showTemporaryMessage('⚠️ Сохранено как PNG', 'warning');
    } catch (e) {
        console.error('Ошибка:', e);
        showTemporaryMessage('❌ Ошибка при сохранении', 'error');
    }
}

/**
 * Настраивает только кнопку скачивания обеих сторон
 */
export function setupDownloadButton(canvas, getNumber, getRegion) {
    const actions = document.querySelector('.actions');

    // Удаляем старую кнопку если есть
    const oldBtn = document.getElementById('downloadBtn');
    if (oldBtn) oldBtn.remove();

    // Создаем только кнопку для обеих сторон
    const downloadBothBtn = document.createElement('button');
    downloadBothBtn.id = 'downloadBothBtn';
    downloadBothBtn.className = 'download-btn';
    downloadBothBtn.textContent = '⬇⬇ Скачать макет';

    actions.appendChild(downloadBothBtn);

    // Обработчик для обеих сторон
    downloadBothBtn.addEventListener('click', async function () {
        try {
            downloadBothBtn.textContent = '⏳ Генерация...';
            downloadBothBtn.disabled = true;

            await new Promise(resolve => setTimeout(resolve, 50));

            await downloadBothSides(canvas, getNumber, getRegion);

        } catch (e) {
            console.error('Ошибка:', e);
            showTemporaryMessage('❌ Ошибка при сохранении', 'error');
        } finally {
            downloadBothBtn.textContent = '⬇⬇ Скачать макет';
            downloadBothBtn.disabled = false;
        }
    });
}
