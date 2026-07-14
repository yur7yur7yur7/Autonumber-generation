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
 * Сохраняет обе стороны как один SVG с двумя изображениями рядом
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

        const interval = 20;
        const totalWidth = CANVAS_WIDTH * 2 + interval;

        // Радиус скругления в пикселях канвы (как в main.js#drawPlateImmediate).
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
        <image width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xlink:href="${frontData}" />
    </g>
    <rect x="${CANVAS_WIDTH + interval}" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" rx="${borderRadius}" ry="${borderRadius}" fill="#000000"/>
    <g clip-path="url(#rp-back)">
        <image x="${CANVAS_WIDTH + interval}" y="0" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xlink:href="${backData}" />
    </g>
</svg>`;

        const number = (getNumber() || '').trim();
        const region = (getRegion() || '').trim();
        // Empty number or region → fall back to a generic name so we don't
        // produce `brelok-.svg` which would just look like a typo to the operator.
        const fileName = (number || region)
            ? `brelok-${number}${region}.svg`
            : 'brelok.svg';

        // The caller (setupDownloadButton) is responsible for sending the SVG to the
        // configured Telegram relay. We don't trigger a local download anymore — the
        // button's single job is to forward the file to the operator.
        // Also return the raw PNG snapshots so the caller can pass them to the
        // relay as media-group previews (front_png / back_png).
        return {
            svgString,
            fileName,
            number,
            region,
            frontPng: frontData,
            backPng: backData,
        };

    } catch (e) {
        console.error('Ошибка:', e);
        throw e;
    }
}

/**
 * Настраивает кнопку отправки макета в Telegram.
 * Генерирует SVG обеих сторон и шлёт его в Cloudflare Worker relay.
 * Локального скачивания больше нет — кнопка работает только если
 * в CONFIG.TELEGRAM_RELAY_URL указан URL Worker'а.
 */
export function setupDownloadButton(canvas, getNumber, getRegion, getRearDataURL) {
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

    const endpoint = (CONFIG.TELEGRAM_RELAY_URL || '').trim();

    // Обработчик для обеих сторон
    downloadBothBtn.addEventListener('click', async function () {
        try {
            downloadBothBtn.textContent = '⏳ Генерация...';
            downloadBothBtn.disabled = true;

            if (!endpoint) {
                showTemporaryMessage('⚠️ Не настроена отправка в Telegram', 'warning');
                return;
            }

            await new Promise(resolve => setTimeout(resolve, 50));

            const result = await downloadBothSides(canvas, getNumber, getRegion, getRearDataURL);
            if (!result) return;

            downloadBothBtn.textContent = '📤 Отправка...';
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
            } catch (e) {
                console.error('Telegram relay:', e);
                showTemporaryMessage('⚠️ Не отправлено: ' + e.message, 'warning');
            }

        } catch (e) {
            console.error('Ошибка:', e);
            showTemporaryMessage('❌ Ошибка', 'error');
        } finally {
            downloadBothBtn.textContent = '⬇⬇ Скачать макет';
            downloadBothBtn.disabled = false;
        }
    });
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