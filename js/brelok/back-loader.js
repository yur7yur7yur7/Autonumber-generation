// ============================================================
// Прелоадер для back.html
// Показываем оверлей ДО инициализации fabric, чтобы пользователь не
// видел flicker «всё мигнуло → появилось». Ждём параллельно шрифты
// (document.fonts.ready) и фоновую картинку (images/back.png).
// Подсказка «Поверните устройство» живёт в отдельном модуле
// rotate-hint.js и включается только на мобильной портретной
// ориентации — в прелоадер её не встраиваем.
// ============================================================

const BACK_IMAGE_URL = 'images/back.png';
const SAFETY_TIMEOUT_MS = 6000;
const MIN_VISIBLE_MS = 250;
const BACK_IMAGE_TIMEOUT_MS = 5000;

const overlay = document.getElementById('loading-overlay');

export function isMobilePortrait() {
    return window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches;
}

export function showLoader() {
    if (!overlay) return;
    overlay.classList.add('lo-show');
}

export function hideLoader() {
    if (!overlay) return;
    overlay.classList.remove('lo-show');
    overlay.removeAttribute('aria-busy');
}

function waitForImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            resolve();
        };
        img.onload = done;
        img.onerror = done;
        setTimeout(done, BACK_IMAGE_TIMEOUT_MS);
        img.src = url;
    });
}

export function startPreloader() {
    showLoader();
    Promise.all([
        (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve())
            .catch(() => {}),
        waitForImage(BACK_IMAGE_URL)
    ]).finally(() => {
        setTimeout(hideLoader, MIN_VISIBLE_MS);
    });
    setTimeout(hideLoader, SAFETY_TIMEOUT_MS);
}