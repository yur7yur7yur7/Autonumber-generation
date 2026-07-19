// ============================================================
// Подсказка про системную панель эмодзи (Win+. / ⌃⌘Space / Ctrl+.).
// Показывается один раз за сессию (флаг в sessionStorage), когда
// пользователь впервые заходит в режим редактирования текстбокса
// на задней стороне. На мобиле скрыта полностью (CSS).
// ============================================================

const SEEN_KEY = 'emojiHintSeen';
const AUTO_HIDE_MS = 9000;

export function initEmojiHint(canvas) {
    const hint = document.getElementById('emoji-hint');
    if (!hint) return;

    const ua = navigator.userAgent || '';
    const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
    const isMac = /mac|darwin/i.test(platform) || /Mac OS X/.test(ua);
    const isWin = /win/i.test(platform) || /Windows NT/.test(ua);
    const isLinux = /linux/i.test(platform) && !/android/i.test(ua);

    const isTabletLike = /iPad|iPhone|iPod|Android/i.test(ua);
    if (isTabletLike) {
        hint.remove();
        return;
    }

    const kbd1 = document.getElementById('eh-kbd-1');
    const kbd2 = document.getElementById('eh-kbd-2');
    if (isMac) {
        if (kbd1) kbd1.textContent = '⌃⌘';
        if (kbd2) kbd2.textContent = 'Space';
    } else if (isLinux) {
        if (kbd1) kbd1.textContent = 'Ctrl';
        if (kbd2) kbd2.textContent = '.';
    } else {
        if (kbd1) kbd1.textContent = 'Win';
        if (kbd2) kbd2.textContent = '.';
    }

    let seen = false;
    try { seen = sessionStorage.getItem(SEEN_KEY) === '1'; } catch (_) { /* приватный режим */ }
    if (seen) {
        hint.remove();
        return;
    }

    let hideTimer = null;
    function show() {
        if (hideTimer) clearTimeout(hideTimer);
        hint.classList.add('eh-show');
        hideTimer = setTimeout(() => dismiss(false), AUTO_HIDE_MS);
    }
    function dismiss(markSeen) {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        hint.classList.remove('eh-show');
        if (markSeen) {
            try { sessionStorage.setItem(SEEN_KEY, '1'); } catch (_) {}
            seen = true;
        }
    }

    const sideLabel = document.getElementById('canvas-label');
    const isBackSide = () => sideLabel?.dataset?.side === 'back';

    canvas.on('text:editing:entered', () => {
        if (!isBackSide()) return;
        if (seen) return;
        show();
    });
    canvas.on('text:editing:exited', () => dismiss(false));

    if (sideLabel) {
        new MutationObserver(() => {
            if (!isBackSide()) dismiss(false);
        }).observe(sideLabel, { attributes: true, attributeFilter: ['data-side'] });
    }

    document.getElementById('eh-close')?.addEventListener('click', () => dismiss(true));

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && hint.classList.contains('eh-show')) dismiss(true);
    });

    hint.addEventListener('click', (e) => e.stopPropagation());
}