// ============================================
// СКАЧИВАНИЕ ФАЙЛОВ
// ============================================

import { showTemporaryMessage } from './validation.js';
import { CONFIG, DEFAULT_SETTINGS } from './config.js';

const { CANVAS_WIDTH, CANVAS_HEIGHT } = CONFIG;

// Радиус скругления берётся из mainSettings, который заполняется через
// setDownloadContext из editor.html (legacy). В бэк-флоу этот вызов не
// делается → mainSettings === null. Чтобы скругление работало в обоих
// путях, fallback на DEFAULT_SETTINGS.mainBorderRadius (= 18).
function getMainBorderRadius() {
    return (mainSettings?.mainBorderRadius ?? DEFAULT_SETTINGS.mainBorderRadius);
}

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
 * Снимок задней стороны с редактора back.html через BroadcastChannel.
 * Принимает функцию-getter (Promise<dataURL>); если она не задана,
 * используется fallback на встроенный previewCanvas текущей вкладки.
 */
async function getRearSideDataURL(getRearDataURL) {
    if (typeof getRearDataURL === 'function') {
        try {
            const data = await getRearDataURL();
            if (data) return data;
        } catch (e) {
            console.warn('Не удалось получить снимок из back.html:', e);
        }
    }
    return null;
}

/**
 * Чистая сборка SVG из двух готовых PNG-снимков. Не трогает DOM и табы —
 * используется как ядро для editor.html (через downloadBothSides) и напрямую
 * из back.html, где табов с переключением сторон нет.
 */
export function buildMaketSvg({ frontDataURL, backDataURL, number, region }) {
    const interval = 20;
    const totalWidth = CANVAS_WIDTH * 2 + interval;

    // Радиус скругления в пикселях канвы (как в main.js#drawPlateImmediate).
    // Fallback на DEFAULT_SETTINGS, если setDownloadContext не вызывался
    // (например, в back.html — там этот вызов legacy-оболочки editor.html
    // не происходит).
    const borderRadius = getMainBorderRadius() * (CONFIG.SCALE_FACTOR || 1);

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
 * вызывать только из editor.html. Для back.html используйте buildMaketSvg.
 */
export async function downloadBothSides(canvas, getNumber, getRegion, getRearDataURL) {
    try {
        // Сохраняем текущую сторону
        const currentSide = document.querySelector('.side-btn.active').dataset.side;

        // Переключаем на переднюю сторону
        document.querySelector('[data-side="front"]').click();
        await new Promise(resolve => setTimeout(resolve, 100));
        const frontData = canvas.toDataURL('image/png');

        // Задняя сторона: сначала пытаемся получить из back.html
        let backData = await getRearSideDataURL(getRearDataURL);
        if (!backData) {
            // Fallback — старая встроенная задняя сторона
            document.querySelector('[data-side="back"]').click();
            await new Promise(resolve => setTimeout(resolve, 100));
            backData = canvas.toDataURL('image/png');
            showTemporaryMessage('⚠️ Откройте редактор задней стороны (back.html) и повторите', 'warning');
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
 * Собирает итоговый PNG-файл макета напрямую через canvas, минуя SVG-as-image.
 *
 * Почему не через SVG → <img> → canvas:
 *   В buildMaketSvg() SVG содержит два вложенных <image xlink:href="data:...">
 *   с PNG-снимками канвы. Когда такой SVG грузится как <img src=...>, браузер
 *   не рендерит вложенные <image> в большинстве случаев (same-origin / CORS /
 *   безопасность SVG-as-image), и в canvas попадает пустой белый фон.
 *
 * Поэтому собираем макет сразу на canvas: два скруглённых чёрных прямоугольника
 * + два PNG-снимка внутри, как в исходной SVG-разметке. Это даёт идентичный
 * визуальный результат, который реле/оператор видит в Telegram.
 *
 * @param {string} frontDataURL - data:image/png;... с передней стороной
 * @param {string} backDataURL  - data:image/png;... с задней стороной
 * @returns {Promise<string|null>} data:image/png;base64,... или null при ошибке
 */
export async function composeMaketPngDataURL(frontDataURL, backDataURL) {
    if (!frontDataURL || !backDataURL) return null;
    const interval = 20;
    // Размер PNG 1:1 совпадает с SVG-вёрсткой в buildMaketSvg():
    // viewBox 0 0 (CANVAS_WIDTH*2 + interval) × CANVAS_HEIGHT, реальные
    // размеры в SVG указаны в сантиметрах (5.18×2+0.2 × 1.07). Раньше тут
    // стоял dpr=2 (растровое ×2 для печати), но для отладки нужно
    // получать PNG того же пиксельного размера, что и SVG — иначе
    // оператор видит в Telegram файл другого размера, чем preview.
    const dpr = 1;
    const outW = (CANVAS_WIDTH * 2 + interval) * dpr;
    const outH = CANVAS_HEIGHT * dpr;
    const radius = getMainBorderRadius() * (CONFIG.SCALE_FACTOR || 1) * dpr;

    // Грузим оба PNG-снимка параллельно (оба — same-origin data URL).
    const [frontImg, backImg] = await Promise.all([
        loadImage(frontDataURL),
        loadImage(backDataURL),
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const sideW = CANVAS_WIDTH * dpr;
    const sideH = CANVAS_HEIGHT * dpr;
    const backX = (CANVAS_WIDTH + interval) * dpr;

    // ЛЕВАЯ СТОРОНА: чёрная скруглённая подложка + PNG внутри скруглённой
    // маски. PNG-снимки приходят ПРЯМОУГОЛЬНЫЕ (canvas.toDataURL не применяет
    // CSS border-radius), поэтому без clip() они затирают скругление
    // подложки. Решение — после roundRect вызываем ctx.clip(), и тогда
    // drawImage обрезается по скруглённой форме (как clip-path в SVG).
    ctx.save();
    roundRect(ctx, 0, 0, sideW, sideH, radius);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.clip();
    ctx.drawImage(frontImg, 0, 0, sideW, sideH);
    ctx.restore();

    // ПРАВАЯ СТОРОНА — то же самое.
    ctx.save();
    roundRect(ctx, backX, 0, sideW, sideH, radius);
    ctx.fillStyle = '#000000';
    ctx.fill();
    ctx.clip();
    ctx.drawImage(backImg, backX, 0, sideW, sideH);
    ctx.restore();

    return canvas.toDataURL('image/png');
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Не удалось загрузить PNG-снимок стороны'));
        img.src = src;
    });
}

function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

/**
 * Отправляет результат downloadBothSides в Telegram-реле.
 * Возвращает true при успехе, false при ошибке/ненастроенном реле/отмене.
 * Используется из editor.html и back.html как обработчик «Отправить на печать»
 * в модалке result-preview — единая точка входа для обоих редакторов.
 *
 * Конвертирует SVG из result в PNG перед отправкой — реле ожидает png.
 *
 * @param {Object} result       — вывод buildMaketSvg ({svgString, fileName, ...}).
 * @param {Object} [order]      — данные пользователя из openOrderForm (back.html).
 *                                 { name, contact, comment } — идут в payload как
 *                                 order_name / order_contact / order_comment
 *                                 и попадают в caption в воркере.
 */
export async function sendMaketToTelegram(result, order) {
    if (!result) return false;
    const endpoint = (CONFIG.TELEGRAM_RELAY_URL || '').trim();
    if (!endpoint) {
        showTemporaryMessage('⚠️ Не настроена отправка в Telegram', 'warning');
        return false;
    }
    try {
        const pngDataURL = await composeMaketPngDataURL(result.frontPng, result.backPng);
        // Имя файла тоже меняем с .svg на .png, чтобы оператору в Telegram
        // прилетал правильный файл.
        const pngFileName = (result.fileName || 'brelok.svg').replace(/\.svg$/i, '.png');
        // Подготовим поля заказа (если есть) — строки приходят уже триммированными
        // из order-form.js, но на всякий случай ещё раз срезаем пробелы и
        // ограничиваем длину, чтобы воркеру не прилетело полотно текста.
        const trim = (v, max) => {
            const s = (v == null ? '' : String(v)).trim();
            return s.length > max ? s.slice(0, max) : s;
        };
        const orderFields = order ? {
            order_name: trim(order.name, 80),
            order_contact: trim(order.contact, 120),
            order_comment: trim(order.comment, 800),
        } : {};
        await sendToTelegramRelay(endpoint, {
            // svg оставляем — реле его строго валидирует (Missing or empty
            // svg field); png добавляем рядом как готовое растровое
            // представление для печати/превью.
            svg: result.svgString,
            png: pngDataURL,
            filename: pngFileName,
            number: result.number,
            region: result.region,
            front_png: result.frontPng,
            back_png: result.backPng,
            ...orderFields,
        });
        showTemporaryMessage('✅ Готово! Отправлено в Telegram', 'success');
        return true;
    } catch (e) {
        console.error('Telegram relay:', e);
        showTemporaryMessage('⚠️ Не отправлено: ' + e.message, 'warning');
        return false;
    }
}

// Forward the generated SVG + PNG (and preview PNGs) to a Cloudflare Worker
// that relays them to Telegram. The worker expects both `svg` (validated
// strictly — Missing or empty svg field) and `png` (ready-to-print bitmap)
// alongside front/back previews and caption fields:
//   { svg, png, filename, number, region, front_png, back_png }
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