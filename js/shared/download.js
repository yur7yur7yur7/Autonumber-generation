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
 * Поэтому собираем макет сразу на canvas: два чёрных прямоугольника (острые
 * углы) + два PNG-снимка внутри, как в исходной SVG-разметке. Это даёт
 * идентичный визуальный результат, который реле/оператор видит в Telegram.
 * Внутренние скругления подложки плашки рисуются в drawing-front/back через
 * <rect rx=…> внутри SVG и не выходят за пределы PNG-снимков.
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

    // ЛЕВАЯ СТОРОНА: чёрный прямоугольник-подложка + PNG поверх без маски.
    // Внешние углы композитного PNG — острые (как до введения скруглений
    // в composeMaketPngDataURL). Внутренние углы самих сторон управляются
    // через settings.innerBorderRadius и рисуются в drawing-front/back —
    // см. <rect> с rx=… в SVG-версии buildMaketSvg().
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, sideW, sideH);
    ctx.drawImage(frontImg, 0, 0, sideW, sideH);

    // ПРАВАЯ СТОРОНА — то же самое.
    ctx.fillStyle = '#000000';
    ctx.fillRect(backX, 0, sideW, sideH);
    ctx.drawImage(backImg, backX, 0, sideW, sideH);

    return setPngDpi(canvas.toDataURL('image/png'), 600);
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Не удалось загрузить PNG-снимок стороны'));
        img.src = src;
    });
}

/**
 * Прописывает в PNG-байты физическое разрешение (pHYs chunk), чтобы
 * Photoshop / Illustrator / превью печати выводили PNG в сантиметрах
 * согласно SVG (10.56 × 1.07 см) — без pHYs дефолтный DPI приложения
 * (Photoshop — 72) даёт ~87 × 8.9 см, в ~9× больше ожидаемого.
 *
 * Используется в composeMaketPngDataURL. Туда же добавлен хардкод 600 dpi:
 * 2468 px / 600 dpi × 2.54 ≈ 10.45 см (SVG: 10.56 см);
 * 252 px / 600 dpi × 2.54 ≈ 1.07 см (SVG: 1.07 см).
 *
 * Парсер минимальный: бежит по чанкам, заменяет существующий pHYs или
 * вставляет новый прямо перед IEND. CRC32 считается по type+data чанка.
 * Невалидный PNG (другая сигнатура, нет IEND) — возвращает вход как есть.
 *
 * @param {string} dataUrl - data:image/png;base64,...
 * @param {number} dpi     - целевой DPI (целое положительное)
 * @returns {string} новый data:image/png;base64,...
 */
function setPngDpi(dataUrl, dpi) {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) return dataUrl;
    const m = dataUrl.match(/^data:image\/png;base64,(.+)$/);
    if (!m) return dataUrl;
    if (!Number.isFinite(dpi) || dpi <= 0) return dataUrl;

    let raw;
    try {
        const bin = atob(m[1]);
        raw = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
    } catch (e) {
        return dataUrl;
    }
    if (raw.length < 8) return dataUrl;
    // Сигнатура PNG: 89 50 4E 47 0D 0A 1A 0A
    const SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    for (let i = 0; i < 8; i++) if (raw[i] !== SIG[i]) return dataUrl;

    const PPM = Math.round(dpi * 39.3700787); // pixels per metre (units=1)
    // pHYs data: 4 байта x, 4 байта y, 1 байт units=1.
    const phys = new Uint8Array(9);
    const dv = new DataView(phys.buffer);
    dv.setUint32(0, PPM, false);
    dv.setUint32(4, PPM, false);
    phys[8] = 1; // units: 1 = metre

    const out = [];
    out.push(raw.subarray(0, 8));
    let physInserted = false;

    let p = 8;
    while (p + 8 <= raw.length) {
        const view = new DataView(raw.buffer, raw.byteOffset + p, 8);
        const len = view.getUint32(0, false);
        const type = String.fromCharCode(
            raw[p + 4], raw[p + 5], raw[p + 6], raw[p + 7]
        );
        const totalLen = 12 + len;
        if (p + totalLen > raw.length) break;

        if (type === 'pHYs') {
            // заменяем существующий pHYs
            const physChunk = buildChunk('pHYs', phys);
            out.push(physChunk);
            physInserted = true;
            p += totalLen;
            continue;
        }
        if (type === 'IEND') {
            if (!physInserted) out.push(buildChunk('pHYs', phys));
            out.push(raw.subarray(p, p + totalLen));
            p += totalLen;
            // добиваем хвост (бывает мусор после IEND — обычно пусто)
            if (p < raw.length) out.push(raw.subarray(p));
            break;
        }
        out.push(raw.subarray(p, p + totalLen));
        p += totalLen;
    }

    const total = out.reduce((s, a) => s + a.byteLength, 0);
    const merged = new Uint8Array(total);
    let off = 0;
    for (const a of out) { merged.set(a, off); off += a.byteLength; }

    let bin = '';
    for (let i = 0; i < merged.length; i++) bin += String.fromCharCode(merged[i]);
    return 'data:image/png;base64,' + btoa(bin);
}

/** Собрать один PNG-чанк: 4 байта length, 4 байта type, data, 4 байта CRC32(type+data). */
function buildChunk(type, data) {
    const len = data.byteLength;
    const out = new Uint8Array(12 + len);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, len, false);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    const crc = crc32(out.subarray(4, 8 + len));
    dv.setUint32(8 + len, crc, false);
    return out;
}

/** CRC32 (PNG polynomial 0xEDB88320) по массиву байтов. Без таблицы — на холодную. */
function crc32(bytes) {
    let c;
    if (!crc32._t) {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            c = n;
            for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
            t[n] = c >>> 0;
        }
        crc32._t = t;
    }
    c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = crc32._t[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
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
 * @param {Object} [config]     — конфиг брелка из serializeBrelokConfig
 *                                 (js/brelok-config.js). Если передан — кладётся
 *                                 в payload как `config: JSON.stringify(cfg)`,
 *                                 и worker шлёт его в Telegram вторым
 *                                 sendDocument с именем `<file>.config.json`.
 */
export async function sendMaketToTelegram(result, order, config) {
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
            // Конфиг брелка — отдельным файлом в Telegram (см. worker/src/index.js).
            // Ставится ТОЛЬКО если передан; при отсутствии поля — реле ничего
            // дополнительного не делает.
            ...(config ? { config: JSON.stringify(config) } : {}),
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