// ============================================================
// Подсказка «Поверните экран» для мобильной портретной ориентации.
// Показывается, если пользователь ещё не закрыл её (флаг в
// localStorage). Следит за resize/orientationchange и зовёт
// syncRotateHint().
// ============================================================

import { isMobilePortrait } from './back-loader.js';

const DISMISS_KEY = 'rotate-hint-dismissed';

const hint = document.getElementById('rotate-hint');
const dismissBtn = hint?.querySelector('.rh-dismiss');

function syncRotateHint() {
    if (!hint) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch (_) { /* приватный режим */ }
    hint.classList.toggle('rh-show', isMobilePortrait() && !dismissed);
}

export function initRotateHint() {
    if (!hint) return;
    dismissBtn?.addEventListener('click', () => {
        try { localStorage.setItem(DISMISS_KEY, '1'); } catch (_) { /* приватный режим */ }
        hint.classList.remove('rh-show');
    });
    syncRotateHint();
    window.addEventListener('resize', syncRotateHint);
    window.addEventListener('orientationchange', syncRotateHint);
}