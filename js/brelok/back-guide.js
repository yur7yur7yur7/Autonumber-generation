// ============================================================
// Подключение onboarding (js/shared/onboarding.js) + кнопка #guide-toggle
// + автопоказ гайда при первом заходе на каждую из сторон + переключение
// на нужный набор шагов при смене стороны через #canvas-label.
// ============================================================

import '../shared/onboarding.js';

export function initGuide() {
    const guideBtn = document.getElementById('guide-toggle');
    if (guideBtn) {
        guideBtn.addEventListener('click', () => {
            const side =
                (window.__sideToggle &&
                 typeof window.__sideToggle.getCurrentSide === 'function' &&
                 window.__sideToggle.getCurrentSide()) || 'front';
            window.startGuide(side);
        });
    }

    const initialSide =
        (window.__sideToggle &&
         typeof window.__sideToggle.getCurrentSide === 'function' &&
         window.__sideToggle.getCurrentSide()) || 'front';
    if (window.shouldAutoShowGuide && window.shouldAutoShowGuide(initialSide)) {
        setTimeout(() => window.startGuide(initialSide), 600);
    }

    const label = document.getElementById('canvas-label');
    if (label && window.MutationObserver) {
        const sideObserver = new MutationObserver(() => {
            const newSide = label.dataset.side === 'back' ? 'back' : 'front';
            if (window.shouldAutoShowGuide && window.shouldAutoShowGuide(newSide)) {
                window.startGuide(newSide);
            }
        });
        sideObserver.observe(label, {
            attributes: true,
            attributeFilter: ['data-side'],
        });
    }
}