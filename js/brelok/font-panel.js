// ============================================================
// Панель шрифтов: добавляет текстбокс с выбранным шрифтом. Источник
// шрифтов — список ниже, все они подгружаются как @font-face в
// back.html (fonts/backpanel/). На мобильных — bottom sheet за
// гамбургер-кнопкой #font-toggle, свайп вниз закрывает.
// ============================================================

const SWIPE_DOWN_DISMISS_PX = 80;
const SWIPE_DOWN_MAX_LAT = 24;

export const FONT_OPTIONS = [
    { name: 'Inter', family: 'Panel Inter' },
    { name: 'Montserrat', family: 'Panel Montserrat' },
    { name: 'Raleway', family: 'Panel Raleway' },
    { name: 'Roboto', family: 'Panel Roboto' },
    { name: 'Noto Serif', family: 'Panel Noto Serif' },
    { name: 'Caveat', family: 'Panel Caveat' },
    { name: 'Bad Script', family: 'Panel Bad Script' },
    { name: 'Gogol', family: 'Panel Gogol' },
    { name: 'Brusnika', family: 'Panel Brusnika' },
    { name: 'LeoHand', family: 'Panel LeoHand' },
    { name: 'Everlasting', family: 'Panel Everlasting' },
    { name: 'Resphekt', family: 'Panel Resphekt' },
    { name: 'Margot Xtrafette', family: 'Panel Margot' },
    { name: 'Fowviel', family: 'Panel Fowviel' },
    { name: 'Bravo', family: 'Panel Bravo' },
    { name: 'Marta', family: 'Panel Marta' },
    { name: 'Troika', family: 'Panel Troika' },
    { name: 'Sprite Graffiti', family: 'Panel Sprite Graffiti' }
];

export const SIGNATURE_TEXT = 'Ваша красивая подпись';

function stackLogosBelowTextboxes(canvas, frontRect) {
    const objs = canvas.getObjects().slice();
    const isTextbox = (o) => o && o.type === 'textbox';
    const textboxes = objs.filter(isTextbox);
    const middle = objs.filter((o) => !isTextbox(o) && o !== frontRect);
    const bottom = frontRect && objs.includes(frontRect) ? [frontRect] : [];
    const ordered = [...bottom, ...middle, ...textboxes];
    ordered.forEach((o, i) => canvas.moveTo(o, i));
    canvas.requestRenderAll();
}

export async function addTextWithFont(canvas, frontRect, font, options = {}) {
    const fontSize = options.fontSize || 40;
    const width = options.width || 520;
    const PLATE_WIDTH = 1224;
    const PLATE_HEIGHT = 252;
    await document.fonts.load(`${fontSize}px "${font.family}"`, SIGNATURE_TEXT);
    const textbox = new fabric.Textbox(SIGNATURE_TEXT, {
        left: PLATE_WIDTH / 2,
        top: PLATE_HEIGHT / 2,
        originX: 'center',
        originY: 'center',
        width,
        fontSize,
        fontFamily: font.family,
        fill: '#111111',
        textAlign: 'center'
    });
    canvas.add(textbox);
    stackLogosBelowTextboxes(canvas, frontRect);
    canvas.setActiveObject(textbox);
    canvas.requestRenderAll();
}

function attachSwipeDownToDismiss(panelEl, headerSelector, openClass, onDismiss) {
    const header = panelEl.querySelector(headerSelector);
    if (!header) return;
    let startY = 0;
    let startX = 0;
    let activePointer = null;
    let dismissed = false;

    header.addEventListener('pointerdown', (e) => {
        if (e.pointerType && e.pointerType === 'mouse') return;
        if (!panelEl.classList.contains(openClass)) return;
        activePointer = e.pointerId;
        startY = e.clientY;
        startX = e.clientX;
        dismissed = false;
    });
    header.addEventListener('pointermove', (e) => {
        if (activePointer === null || e.pointerId !== activePointer) return;
        if (dismissed) return;
        const dy = e.clientY - startY;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > SWIPE_DOWN_MAX_LAT) {
            activePointer = null;
            return;
        }
        if (dy > SWIPE_DOWN_DISMISS_PX) {
            dismissed = true;
            activePointer = null;
            onDismiss();
        }
    });
    const cancel = () => { activePointer = null; dismissed = false; };
    header.addEventListener('pointerup', cancel);
    header.addEventListener('pointercancel', cancel);
    header.addEventListener('pointerleave', cancel);
}

export async function initFontPanel(canvas, frontRect) {
    await Promise.all(FONT_OPTIONS.map((font) =>
        document.fonts.load(`22px "${font.family}"`, SIGNATURE_TEXT)
    ));

    const fontPanel = document.createElement('div');
    fontPanel.id = 'font-panel';
    fontPanel.innerHTML = `
        <div class="fp-header">Текст и шрифты</div>
        <div class="fp-list"></div>
    `;
    document.body.appendChild(fontPanel);
    window.__sideToggle?.syncChromeVisibility?.();

    const fontToggleBtn = document.createElement('button');
    fontToggleBtn.id = 'font-toggle';
    fontToggleBtn.textContent = '✎ Текст';
    document.body.appendChild(fontToggleBtn);
    window.__sideToggle?.syncChromeVisibility?.();

    const list = fontPanel.querySelector('.fp-list');
    FONT_OPTIONS.forEach((font) => {
        const button = document.createElement('button');
        button.className = 'fp-font-btn';
        button.type = 'button';
        button.setAttribute('aria-label', `${font.name}: ${SIGNATURE_TEXT}`);
        button.innerHTML = `
            <span class="fp-preview" style="font-family: '${font.family}', cursive">${SIGNATURE_TEXT}</span>
            <span class="fp-name">${font.name}</span>
        `;
        button.addEventListener('click', async () => {
            await addTextWithFont(canvas, frontRect, font);
            fontPanel.classList.remove('fp-open');
            fontToggleBtn.textContent = '✎ Текст';
        });
        list.appendChild(button);
    });

    fontToggleBtn.addEventListener('click', () => {
        fontPanel.classList.toggle('fp-open');
        fontToggleBtn.textContent = fontPanel.classList.contains('fp-open') ? '✕ Закрыть' : '✎ Текст';
    });

    document.addEventListener('click', (event) => {
        if (!fontPanel.classList.contains('fp-open')) return;
        if (fontPanel.contains(event.target) || fontToggleBtn.contains(event.target)) return;
        fontPanel.classList.remove('fp-open');
        fontToggleBtn.textContent = '✎ Текст';
    });

    attachSwipeDownToDismiss(fontPanel, '.fp-header', 'fp-open', () => {
        fontPanel.classList.remove('fp-open');
        fontToggleBtn.textContent = '✎ Текст';
    });
}