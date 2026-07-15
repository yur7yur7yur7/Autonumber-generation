// ============================================
// СКАЧИВАНИЕ ФАЙЛОВ
// ============================================

import { showTemporaryMessage } from './validation.js';
import { CONFIG } from './config.js';

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
 * Снимок задней стороны с редактора test.html через BroadcastChannel.
 * Принимает функцию-getter (Promise<dataURL>); если она не задана,
 * используется fallback на встроенный previewCanvas текущей вкладки.
 */
async function getRearSideDataURL(getRearDataURL) {
    if (typeof getRearDataURL === 'function') {
        try {
            const data = await getRearDataURL();
            if (data) return data;
        } catch (e) {
            console.warn('Не удалось получить снимок из test.html:', e);
        }
    }
    return null;
}

/**
 * Чистая сборка SVG из двух готовых PNG-снимков. Не трогает DOM и табы —
 * используется как ядро для editor.html (через downloadBothSides) и напрямую
 * из test.html, где табов с переключением сторон нет.
 */
export function buildMaketSvg({ frontDataURL, backDataURL, number, region }) {
    const interval = 20;
    const totalWidth = CANVAS_WIDTH * 2 + interval;

    // Радиус скругления в пикселях канвы (как в main.js#drawPlateImmediate).
    // Fallback на 0 — если контекст не задан (например, в test.html).
    const borderRadius = (mainSettings?.mainBorderRadius || 0) * (CONFIG.SCALE_FACTOR || 1);

    const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${(5.18 * 2 + 0.2)}cm" height="1.07cm" viewBox="0 0 ${totalWidth} ${CANVAS_HEIGHT}"
     preserveAspectRatio="none"
     xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
        <clipPath id="rp-front"><rect x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" rx="${borderRadius}" ry="${borderRadius}"/></clipPath>
        <clipPath id="rp-back"><rect x="${CANVAS_WIDTH + interval}" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" rx="${borderRadius}" ry="${borderRadius}"/></clipPath>
    </defs>
    <rect x="0" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" rx="${borderRadius}" ry="${borderRadius}" fill="#000000"/>
    <g clip-path="url(#rp-front)">
        <image width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xlink:href="${frontDataURL}" />
    </g>
    <rect x="${CANVAS_WIDTH + interval}" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" rx="${borderRadius}" ry="${borderRadius}" fill="#000000"/>
    <g clip-path="url(#rp-back)">
        <image x="${CANVAS_WIDTH + interval}" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xlink:href="${backDataURL}" />
    </g>
</svg>`;

    const trimmedNumber = (number || '').trim();
    const trimmedRegion = (region || '').trim();
    // Empty number or region → fall back to a generic name so we don't
    // produce `brelok-.svg` which would just look like a typo to the operator.
    const fileName = (trimmedNumber || trimmedRegion)
        ? `brelok-${trimmedNumber}${trimmedRegion}.svg`
        : 'brelok.svg';

    return {
        svgString,
        fileName,
        number: trimmedNumber,
        region: trimmedRegion,
        frontPng: frontDataURL,
        backPng: backDataURL,
    };
}

/**
 * Снимает обе стороны с editor.html и собирает SVG. Переключает табы —
 * вызывать только из editor.html. Для test.html используйте buildMaketSvg.
 */
export async function downloadBothSides(canvas, getNumber, getRegion, getRearDataURL) {
    try {
        // Сохраняем текущую сторону
        const currentSide = document.querySelector('.side-btn.active').dataset.side;

        // Переключаем на переднюю сторону
        document.querySelector('[data-side="front"]').click();
        await new Promise(resolve => setTimeout(resolve, 100));
        const frontData = canvas.toDataURL('image/png');

        // Задняя сторона: сначала пытаемся получить из test.html
        let backData = await getRearSideDataURL(getRearDataURL);
        if (!backData) {
            // Fallback — старая встроенная задняя сторона
            document.querySelector('[data-side="back"]').click();
            await new Promise(resolve => setTimeout(resolve, 100));
            backData = canvas.toDataURL('image/png');
            showTemporaryMessage('⚠️ Откройте редактор задней стороны (test.html) и повторите', 'warning');
        }

        // Возвращаем как было
        document.querySelector(`[data-side="${currentSide}"]`).click();

        return buildMaketSvg({
            frontDataURL: frontData,
            backDataURL: backData,
            number: getNumber(),
            region: getRegion(),
        });

    } catch (e) {
        console.error('Ошибка:', e);
        throw e;
    }
}

/**
 * Отправляет результат downloadBothSides в Telegram-реле.
 * Возвращает true при успехе, false при ошибке/ненастроенном реле.
 * Используется из editor.html и test.html как обработчик «Отправить на печать»
 * в модалке result-preview — единая точка входа для обоих редакторов.
 */
export async function sendMaketToTelegram(result) {
    if (!result) return false;
    const endpoint = (CONFIG.TELEGRAM_RELAY_URL || '').trim();
    if (!endpoint) {
        showTemporaryMessage('⚠️ Не настроена отправка в Telegram', 'warning');
        return false;
    }
    try {
        await sendToTelegramRelay(endpoint, {
            svg: result.svgString,
            filename: result.fileName,
            number: result.number,
            region: result.region,
            front_png: result.frontPng,
            back_png: result.backPng,
        });
        showTemporaryMessage('✅ Готово! Отправлено в Telegram', 'success');
        return true;
    } catch (e) {
        console.error('Telegram relay:', e);
        showTemporaryMessage('⚠️ Не отправлено: ' + e.message, 'warning');
        return false;
    }
}

// Forward the generated SVG (and preview PNGs) to a Cloudflare Worker that
// relays them to Telegram. The worker now expects an extended payload that
// includes front/back previews and human-readable caption fields:
//   { svg, filename, number, region, front_png, back_png }
// Returns the relay's JSON response on success, throws on failure (with a
// human-readable message). Caller decides whether to show an error toast.
async function sendToTelegramRelay(endpoint, payload) {
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    let body = null;
    try { body = await resp.json(); } catch (_) { /* non-JSON body */ }
    if (!resp.ok || (body && body.ok === false)) {
        const err = (body && body.error) || ('HTTP ' + resp.status);
        throw new Error(err);
    }
    return body || { ok: true };
}