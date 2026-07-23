// ============================================================
// Действия пользователя на финальной странице редактора брелка:
//   • #create-maket — собрать мaкет, открыть preview → order → thanks;
//   • #debug-download-svg — скачать итоговый SVG с физическим размером
//     10.56×1.07 см, зашитым в корневой <svg width/height> (только при body.debug);
//     Photoshop/Illustrator/Inkscape читают эти сантиметры напрямую, минуя
//     нестабильные pHYs/EXIF-метаданные PNG — поэтому для печати используется
//     именно SVG, а не PNG-debug;
//   • #download-config-btn — скачать конфиг .json (только при body.debug);
//   • Импорт конфига по ?config=<key>&type=<brelokType> из sessionStorage;
//   • Консольные команды debug() / undebug() для body.debug.
// ============================================================

import { openResultPreview } from '../shared/result-preview.js';
import { openOrderForm } from '../shared/order-form.js';
import { openThanksModal } from '../shared/thanks-modal.js';
import { buildMaketSvg, sendMaketToTelegram } from '../shared/download.js';
import { CONFIG } from '../shared/config.js';
import {
    serializeBrelokConfig, applyBrelokConfig,
    downloadConfig, parseConfigFile, buildConfigFilename,
} from '../shared/brelok-config.js';

let toastTimer = null;

function showToast(text, isError) {
    const toast = document.getElementById('maket-toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.toggle('mt-error', Boolean(isError));
    toast.classList.add('mt-show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('mt-show');
        toastTimer = null;
    }, 2200);
}

function showConfigToast(text, isError = false) {
    const toast = document.getElementById('maket-toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.toggle('mt-error', Boolean(isError));
    toast.classList.add('mt-show');
    const prev = toast._timer;
    if (prev) clearTimeout(prev);
    toast._timer = setTimeout(() => {
        toast.classList.remove('mt-show');
    }, 2200);
}

function getFrontDataURL() {
    window.__sideToggle?.ensureFrontRendered?.();
    const frontCanvas = document.getElementById('frontCanvas');
    return frontCanvas ? frontCanvas.toDataURL('image/png') : null;
}

function downloadDataURL(dataURL, filename) {
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// SVG нельзя качать через data: URL (URL получается слишком длинным для
// браузерного лимита при больших встроенных PNG-sнимках), поэтому используем
// Blob + URL.createObjectURL. MIME text/xml с charset=utf-8, чтобы Photoshop
// и Illustrator корректно прочитали национальные буквы в номере/подписи.
function downloadSVG(svgString, filename) {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function attachCreateMaket() {
    const btn = document.getElementById('create-maket');
    if (!btn) {
        console.warn('Кнопка #create-maket не найдена');
        return;
    }
    btn.disabled = false;

    btn.addEventListener('click', async () => {
        const original = btn.textContent;
        btn.textContent = '⏳ Готовлю...';
        btn.disabled = true;
        try {
            const frontDataURL = getFrontDataURL();
            const backDataURL =
                (await window.__sideToggle?.getRearSnapshot?.()) ?? null;

            await openResultPreview({
                frontDataURL,
                backDataURL,
                onSendToPrint: async () => {
                    const order = await openOrderForm();
                    if (!order) return false;
                    const { number, region } = window.__sideToggle?.getPlate?.() ?? {};
                    const result = buildMaketSvg({
                        frontDataURL,
                        backDataURL,
                        number: number || '',
                        region: region || ''
                    });
                    let brelokCfg = null;
                    try {
                        if (window.__backCanvas) {
                            brelokCfg = serializeBrelokConfig(window.__backCanvas);
                        }
                    } catch (e) {
                        console.warn('serializeBrelokConfig:', e);
                    }
                    const isTest = order.__test === true;
                    const ok = isTest
                        ? true
                        : await sendMaketToTelegram(result, order, brelokCfg);
                    showToast(
                        isTest
                            ? '🧪 Тестовая отправка (в Telegram не отправлено)'
                            : ok
                                ? '✅ Макет отправлен'
                                : '⚠️ Не удалось отправить макет',
                        !ok
                    );
                    if (ok) {
                        openThanksModal().catch((err) => console.error('thanks modal:', err));
                    }
                    return ok;
                },
                onSelectFront: () => window.__sideToggle?.setSide?.('front'),
                onSelectBack: () => window.__sideToggle?.setSide?.('back'),
            });
        } catch (e) {
            console.error('preview error:', e);
            showToast('⚠️ Ошибка при подготовке макета', true);
        } finally {
            btn.textContent = original;
            btn.disabled = false;
        }
    });
}

function attachDebugDownloadPng() {
    const dbgBtn = document.getElementById('debug-download-svg');
    if (!dbgBtn) return;
    dbgBtn.disabled = false;
    dbgBtn.addEventListener('click', async () => {
        const original = dbgBtn.textContent;
        dbgBtn.textContent = '⏳ ...';
        dbgBtn.disabled = true;
        try {
            const frontDataURL = getFrontDataURL();
            const backDataURL =
                (await window.__sideToggle?.getRearSnapshot?.()) ?? null;
            if (!frontDataURL || !backDataURL) {
                showToast('⚠️ Не удалось собрать стороны', true);
                return;
            }
            const { number, region } = window.__sideToggle?.getPlate?.() ?? {};
            const svgResult = buildMaketSvg({
                frontDataURL,
                backDataURL,
                number: number || '',
                region: region || '',
            });
            downloadSVG(svgResult.svgString, svgResult.fileName);
            showToast('✅ SVG скачан');
        } catch (e) {
            console.error('debug download:', e);
            showToast('⚠️ Ошибка скачивания', true);
        } finally {
            dbgBtn.textContent = original;
            dbgBtn.disabled = false;
        }
    });
}

async function importConfigFile(file) {
    if (!file) return;
    try {
        const cfg = await parseConfigFile(file);
        const canvas = window.__backCanvas;
        if (!canvas) throw new Error('fabric.Canvas не найден');
        await applyBrelokConfig(canvas, cfg);
        // Сигнал для back-boot.js: если он ещё не дошёл до места, где
        // добавляет дефолтный textbox (await window.__pendingConfigImport),
        // он пропустит создание дефолтного и не наложит его поверх
        // импортированного конфига. Если уже прошёл — сигнал бесполезен,
        // но applyBrelokConfig выше уже удалил все объекты кроме
        // frontRect, так что дефолтный textbox тоже снят.
        window.__pendingConfigImport = Promise.resolve(true);
        showConfigToast('✅ Конфиг загружен');
        const maket = document.getElementById('create-maket');
        if (maket) {
            maket.classList.add('btn-attention');
            setTimeout(() => maket.classList.remove('btn-attention'), 1500);
        }
    } catch (err) {
        console.error('config import:', err);
        showConfigToast(`⚠️ Не получилось: ${err.message}`, true);
    }
}

function attachDownloadConfig() {
    const dumpBtn = document.getElementById('download-config-btn');
    if (!dumpBtn) return;
    dumpBtn.addEventListener('click', () => {
        try {
            const canvas = window.__backCanvas;
            if (!canvas) throw new Error('fabric.Canvas не найден');
            const cfg = serializeBrelokConfig(canvas);
            const filename = buildConfigFilename(cfg.frontSide);
            downloadConfig(cfg, filename);
            showConfigToast('✅ Конфиг скачан');
        } catch (err) {
            console.error('config export:', err);
            showConfigToast(`⚠️ Ошибка экспорта: ${err.message}`, true);
        }
    });
}

function tryAutoImportFromQuery() {
    const params = new URLSearchParams(location.search);
    const configKey = params.get('config');
    const incomingType = params.get('type');

    // Если ?config= нет — резолвим «false» немедленно, чтобы
    // back-boot.js после initFontPanel без ожидания добавил дефолтный textbox.
    if (!configKey) {
        window.__pendingConfigImport = Promise.resolve(false);
        return;
    }
    console.warn('[brelok-tg] tryAutoImportFromQuery start, key=' + configKey);

    // Путь 1: ключ лежит в sessionStorage — старый сценарий (index.html
    // кладёт JSON в sessionStorage, редиректит сюда, мы забираем).
    // Путь 2: ключа нет — это случай «пришли из Telegram по inline-кнопке».
    // Тогда UUID-ключ в query означает «спроси у воркера через /api/config»,
    // воркер выдаст .brelok-config.json из KV.
    // В обоих путях валидация, парсинг и применение одинаковые.
    let rawText = (() => {
        try { return sessionStorage.getItem(configKey); } catch (_e) { return null; }
    })();
    try { sessionStorage.removeItem(configKey); } catch (_e) {}

    function applyRawText(text) {
        let cfg;
        try {
            cfg = JSON.parse(text);
        } catch (e) {
            console.error('[brelok-tg] parse failed', e);
            window.__pendingConfigImport = Promise.resolve(false);
            showConfigToast('⚠️ Файл конфига повреждён', true);
            return;
        }
        if (!cfg || typeof cfg !== 'object') {
            window.__pendingConfigImport = Promise.resolve(false);
            return;
        }

        function waitFor(predicate, cb, attempts = 60) {
            if (predicate()) return cb();
            if (attempts <= 0) return;
            setTimeout(() => waitFor(predicate, cb, attempts - 1), 100);
        }
        waitFor(
            () => window.__sideToggle && window.__backCanvas,
            () => {
                (async () => {
                    try {
                        await applyBrelokConfig(window.__backCanvas, cfg, incomingType);
                        window.__pendingConfigImport = Promise.resolve(true);
                        showConfigToast('✅ Макет загружен');
                        const maket = document.getElementById('create-maket');
                        if (maket) {
                            maket.classList.add('btn-attention');
                            setTimeout(() => maket.classList.remove('btn-attention'), 1500);
                        }
                    } catch (err) {
                        console.error('[brelok-tg] apply err', err);
                        window.__pendingConfigImport = Promise.resolve(false);
                        showConfigToast(`⚠️ Не получилось: ${err.message}`, true);
                    }
                })();
            }
        );
    }

    if (rawText != null) {
        applyRawText(rawText);
        return;
    }

    // Нет ключа в sessionStorage — стягиваем конфиг из KV через воркер.
    // CONFIG импортируется статически сверху файла, без dynamic import,
    // потому что dynamic import на iOS Safari (SFSafariViewController внутри
    // Telegram-кликера) иногда зависает на resolve — выглядит как молчаливый
    // отказ без тоста. Статический import гарантированно доступен к моменту
    // этого вызова, потому что side-toggle.js импортирует config.js в графе
    // back.html раньше, чем initFinalActions регистрирует эту функцию.
    const endpoint = (CONFIG && CONFIG.TELEGRAM_RELAY_URL || '').trim().replace(/\/$/, '');
    if (!endpoint) {
        console.error('[brelok-tg] TELEGRAM_RELAY_URL is empty in CONFIG');
        showConfigToast('⚠️ Не настроен реле для импорта конфига', true);
        return;
    }
    const url = endpoint + '/api/config?id=' + encodeURIComponent(configKey);
    console.warn('[brelok-tg] fetching', url);
    fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } })
        .then((r) => {
            console.warn('[brelok-tg] fetch response', r.status, r.ok);
            if (!r.ok) {
                throw new Error('HTTP ' + r.status + ' от /api/config');
            }
            return r.text();
        })
        .then((text) => {
            applyRawText(text);
        })
        .catch((err) => {
            console.error('[brelok-tg] KV import failed:', err);
            window.__pendingConfigImport = Promise.resolve(false);
            // Показываем тост в ЛЮБОМ случае — и для сетевой ошибки, и для
            // нераспознанного исключения. iOS Safari без этого рискует
            // показать «‎тишину» (no toast, no console), и оператор думает,
            // что всё прошло.
            showConfigToast('⚠️ Не удалось импортировать конфиг из Telegram: ' + err.message, true);
        });
}

function attachDebugConsoleToggle() {
    const debugAction = () => {
        document.body.classList.add('debug');
        console.info('%c[debug] 🧪 Тестовые кнопки ВКЛ', 'color:#fb923c;font-weight:700');
        console.info('Чтобы скрыть — наберите: undebug');
        return '🧪 Тестовые кнопки видны.';
    };
    const undebugAction = () => {
        document.body.classList.remove('debug');
        console.info('%c[debug] Тестовые кнопки ВЫКЛ', 'color:#9ca3af;font-weight:700');
        return 'Тестовые кнопки скрыты.';
    };
    window.__enableDebugButtons = debugAction;
    window.__disableDebugButtons = undebugAction;
    try {
        Object.defineProperty(window, 'debug', {
            get() { return debugAction; },
            configurable: true,
            enumerable: false,
        });
        Object.defineProperty(window, 'undebug', {
            get() { return undebugAction; },
            configurable: true,
            enumerable: false,
        });
    } catch (e) {
        window.debug = debugAction;
        window.undebug = undebugAction;
    }
    console.info('%c[debug]', 'color:#fb923c;font-weight:700',
        'Наберите в консоли «debug» чтобы показать тестовые кнопки, «undebug» чтобы скрыть');
}

export function initFinalActions() {
    attachCreateMaket();
    attachDebugDownloadPng();
    attachDownloadConfig();
    tryAutoImportFromQuery();
    attachDebugConsoleToggle();
}

// Утилита для будущей UI-кнопки загрузки.
export { importConfigFile };