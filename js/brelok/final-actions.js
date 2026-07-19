// ============================================================
// Действия пользователя на финальной странице редактора брелка:
//   • #create-maket — собрать мaкет, открыть preview → order → thanks;
//   • #debug-download-png — скачать итоговый PNG (только при body.debug);
//   • #download-config-btn — скачать конфиг .json (только при body.debug);
//   • Импорт конфига по ?config=<key>&type=<brelokType> из sessionStorage;
//   • Консольные команды debug() / undebug() для body.debug.
// ============================================================

import { openResultPreview } from '../shared/result-preview.js';
import { openOrderForm } from '../shared/order-form.js';
import { openThanksModal } from '../shared/thanks-modal.js';
import { buildMaketSvg, sendMaketToTelegram, composeMaketPngDataURL } from '../shared/download.js';
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
    const dbgBtn = document.getElementById('debug-download-png');
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
            const png = await composeMaketPngDataURL(frontDataURL, backDataURL);
            if (!png) {
                showToast('⚠️ Не удалось собрать PNG', true);
                return;
            }
            const { number, region } = window.__sideToggle?.getPlate?.() ?? {};
            const nn = (number || '').trim();
            const rr = (region || '').trim();
            const filename = (nn || rr) ? `brelok-${nn}${rr}.png` : 'brelok.png';
            downloadDataURL(png, filename);
            showToast('✅ PNG скачан');
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
    if (!configKey) return;

    const rawText = (() => {
        try { return sessionStorage.getItem(configKey); } catch (_e) { return null; }
    })();
    try { sessionStorage.removeItem(configKey); } catch (_e) {}

    if (rawText == null) {
        console.warn('config key missing in sessionStorage:', configKey);
        return;
    }

    let cfg;
    try {
        cfg = JSON.parse(rawText);
    } catch (e) {
        console.error('config parse failed:', e);
        showConfigToast('⚠️ Файл конфига повреждён', true);
        return;
    }
    if (!cfg || typeof cfg !== 'object') return;

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
                    showConfigToast('✅ Макет загружен');
                    const maket = document.getElementById('create-maket');
                    if (maket) {
                        maket.classList.add('btn-attention');
                        setTimeout(() => maket.classList.remove('btn-attention'), 1500);
                    }
                } catch (err) {
                    console.error('config apply:', err);
                    showConfigToast(`⚠️ Не получилось: ${err.message}`, true);
                }
            })();
        }
    );
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