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
 * Сохраняет обе стороны как один SVG с двумя изображениями рядом
 */
export async function downloadBothSides(canvas, getNumber, getRegion) {
    try {
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

        const fileName = `brelok-obe-storony-${getNumber()}-${getRegion()}.svg`;

        // The caller (setupDownloadButton) is responsible for sending the SVG to the
        // configured Telegram relay. We don't trigger a local download anymore — the
        // button's single job is to forward the file to the operator.
        return { svgString, fileName };

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

            const result = await downloadBothSides(canvas, getNumber, getRegion);
            if (!result) return;

            downloadBothBtn.textContent = '📤 Отправка...';
            try {
                await sendToTelegramRelay(endpoint, result.svgString, result.fileName);
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

// Forward the generated SVG to a Cloudflare Worker that relays it to Telegram.
// Returns the relay's JSON response on success, throws on failure (with a
// human-readable message). Caller decides whether to show an error toast.
async function sendToTelegramRelay(endpoint, svgString, fileName) {
    const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ svg: svgString, filename: fileName }),
    });
    let payload = null;
    try { payload = await resp.json(); } catch (_) { /* non-JSON body */ }
    if (!resp.ok || (payload && payload.ok === false)) {
        const err = (payload && payload.error) || ('HTTP ' + resp.status);
        throw new Error(err);
    }
    return payload || { ok: true };
}