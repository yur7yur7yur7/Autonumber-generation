// ============================================
// ГЛАВНЫЙ ФАЙЛ - ИНИЦИАЛИЗАЦИЯ
// ============================================

import {CONFIG, DEFAULT_SETTINGS} from './config.js';
import {getDisplayNumber} from './transliteration.js';
import {setupNumberValidation, setupRegionValidation, showTemporaryMessage} from './validation.js';
import {setDrawingContext, drawBackground, drawInnerBackground, drawRoundedRect} from './drawing-utils.js';
import {setFrontContext, drawFrontSide} from './drawing-front.js';
import {setBackContext, drawBackSide} from './drawing-back.js';
import {setSettingsCallbacks, createSettingsPanel, updateSettingsVisibility} from './settings-panel.js';
import {setupDownloadButton, setDownloadContext} from './download.js';
import {setLogoContext, createLogoPanel} from './logos.js';
import {drawSideDots} from './drawing-utils.js';
import {EMOJI_CATEGORIES} from './emojis.js';

const {CANVAS_WIDTH, CANVAS_HEIGHT, SCALE_FACTOR, STORAGE_KEY} = CONFIG;

// Состояние приложения
let settings = {...DEFAULT_SETTINGS};
let currentSide = 'front';

// DOM элементы
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const numberInput = document.getElementById('plateNumber');
const regionInput = document.getElementById('plateRegion');
const customText = document.getElementById('customText');
const textSize = document.getElementById('textSize');
const textSizeValue = document.getElementById('textSizeValue'); // ← ОДИН РАЗ
const textColor = document.getElementById('textColor');


// ============================================
// НАСТРОЙКА КАНВАСА
// ============================================
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

function updateCanvasSize() {
    const maxWidth = Math.min(600, canvas.parentElement.clientWidth - 40);
    canvas.style.width = maxWidth + 'px';
    canvas.style.height = 'auto';
    canvas.style.imageRendering = 'auto';
}

updateCanvasSize();
window.addEventListener('resize', () => {
    clearTimeout(window._canvasResizeTimer);
    window._canvasResizeTimer = setTimeout(updateCanvasSize, 150);
});

// Передаем контекст в модули рисования
setDrawingContext(ctx);
setFrontContext(ctx, settings);
setBackContext(ctx, settings);

// ============================================
// ЗАГРУЗКА/СОХРАНЕНИЕ НАСТРОЕК
// ============================================
function loadSettings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(settings, parsed);
        }
    } catch (e) {
        console.log('Не удалось загрузить настройки');
    }
}

loadSettings();

// Применяем логику для точек при загрузке
if (settings.showSideDots) {
    settings.numberPadding = 0;
    settings.regionX = 23;
} else {
    settings.numberPadding = 14;
    settings.regionX = 0;
}

// Устанавливаем размер текста по умолчанию
const textSizeInput = document.getElementById('textSize');
if (textSizeInput && !textSizeInput.value) {
    textSizeInput.value = 63;
    textSizeValue.textContent = 63;
}

function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.log('Не удалось сохранить настройки');
    }
}

// ============================================
// ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК
// ============================================

document.querySelectorAll('.side-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const side = this.dataset.side;

        document.querySelectorAll('.side-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        document.querySelectorAll('.side-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`side-${side}`).classList.add('active');

        currentSide = side;

        // ✅ Показываем/скрываем поле ввода в preview
        const backTextInput = document.getElementById('backTextInput');
        if (backTextInput) {
            backTextInput.style.display = (side === 'back') ? 'block' : 'none';
        }

        // Уменьшаем preview на задней стороне
        const previewArea = document.querySelector('.preview-area');
        if (previewArea) {
            previewArea.classList.toggle('back-side', side === 'back');
        }

        drawPlate();
        updateSettingsVisibility(side);
    });
});

// ============================================
// ЭМОДЗИ И НАСТРОЙКИ ТЕКСТА
// ============================================

textSize.addEventListener('input', function () {
    textSizeValue.textContent = this.value;
    drawPlate();
});

// Кастомная обработка касаний для textSize (только горизонтальный жест)
{
    let startX = 0, startValue = 0, active = false;
    textSize.addEventListener('touchstart', (e) => {
        active = true;
        startX = e.touches[0].clientX;
        startValue = parseFloat(textSize.value);
    }, { passive: true });
    textSize.addEventListener('touchmove', (e) => {
        if (!active) return;
        const dx = e.touches[0].clientX - startX;
        const rect = textSize.getBoundingClientRect();
        const range = parseFloat(textSize.max) - parseFloat(textSize.min);
        let newValue = startValue + (dx / rect.width) * range;
        newValue = Math.round(newValue);
        newValue = Math.max(parseFloat(textSize.min), Math.min(parseFloat(textSize.max), newValue));
        textSize.value = newValue;
        textSizeValue.textContent = newValue;
        drawPlate();
    }, { passive: true });
    textSize.addEventListener('touchend', () => { active = false; }, { passive: true });
    textSize.addEventListener('touchcancel', () => { active = false; }, { passive: true });
}

// ============================================
// СЛУШАТЕЛИ ИЗМЕНЕНИЙ
// ============================================
customText.addEventListener('input', drawPlate);
customText.addEventListener('paste', function (e) {
    // При вставке plain text — ок, при вставке форматированного — чистим
    setTimeout(() => {
        // Убираем вложенные div'ы от браузерного форматирования
        const divs = this.querySelectorAll('div');
        divs.forEach(div => {
            div.replaceWith(...div.childNodes);
        });
        drawPlate();
    }, 0);
});
textColor.addEventListener('input', drawPlate);

const textWeightBold = document.getElementById('textWeightBold');
if (textWeightBold) {
    textWeightBold.addEventListener('change', drawPlate);
}

const doneBtn = document.querySelector('.keyboard-done-btn');
if (doneBtn) {
    doneBtn.addEventListener('click', () => {
        document.activeElement.blur(); // убираем фокус с поля
    });
}

// Валидация полей
setupNumberValidation(numberInput, drawPlate);
setupRegionValidation(regionInput, drawPlate);


/**
 * Извлекает содержимое contenteditable в формате для отрисовки:
 * [{type: 'text', content: '...'}, {type: 'logo', file: 'audi_badge.png'}, ...]
 */
function getCustomTextFragments() {
    const container = document.getElementById('customText');
    if (!container) return [];

    const fragments = [];

    function extractNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;
            if (text) {
                // Убираем zero-width space
                const cleaned = text.replace(/\u200B/g, '');
                if (cleaned) {
                    fragments.push({type: 'text', content: cleaned});
                }
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.classList.contains('inline-logo')) {
                const file = node.dataset.logoFile;
                if (file) {
                    fragments.push({type: 'logo', file: file});
                }
            } else if (node.tagName === 'BR') {
                fragments.push({type: 'text', content: '\n'});
            } else {
                // Рекурсивно обходим дочерние узлы
                node.childNodes.forEach(child => extractNodes(child));
            }
        }
    }

    container.childNodes.forEach(node => extractNodes(node));

    return fragments;
}

// Удаление логотипов (keydown для десктопа + beforeinput для мобильных)
customText.addEventListener('keydown', function (e) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    if (e.key === 'Backspace' && range.collapsed && range.startOffset === 0) {
        const node = range.startContainer;
        if (node.previousSibling && node.previousSibling.classList &&
            node.previousSibling.classList.contains('inline-logo')) {
            e.preventDefault();
            node.previousSibling.remove();
            drawPlate();
        }
    }

    if (e.key === 'Delete' && range.collapsed && range.startOffset === range.startContainer.length) {
        const node = range.startContainer;
        if (node.nextSibling && node.nextSibling.classList &&
            node.nextSibling.classList.contains('inline-logo')) {
            e.preventDefault();
            node.nextSibling.remove();
            drawPlate();
        }
    }
});

customText.addEventListener('beforeinput', function (e) {
    if (e.inputType !== 'deleteContentBackward' && e.inputType !== 'deleteContentForward') return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    if (!range.collapsed) return;

    if (e.inputType === 'deleteContentBackward' && range.startOffset === 0) {
        const node = range.startContainer;
        const prev = node.previousSibling;
        if (prev && prev.classList && prev.classList.contains('inline-logo')) {
            e.preventDefault();
            prev.remove();
            drawPlate();
        }
    }

    if (e.inputType === 'deleteContentForward') {
        const node = range.startContainer;
        const next = node.nextSibling;
        if (next && next.classList && next.classList.contains('inline-logo')) {
            e.preventDefault();
            next.remove();
            drawPlate();
        }
    }
});

// Тап по логотипу в тексте — удаление (надёжный способ для мобильных)
customText.addEventListener('click', function (e) {
    const logo = e.target.closest('.inline-logo');
    if (!logo) return;

    e.preventDefault();

    if (logo.classList.contains('logo-selected')) {
        logo.remove();
        drawPlate();
        return;
    }

    customText.querySelectorAll('.inline-logo.logo-selected').forEach(l => {
        l.classList.remove('logo-selected');
    });
    logo.classList.add('logo-selected');

    setTimeout(() => {
        if (logo.classList.contains('logo-selected')) {
            logo.remove();
            drawPlate();
        }
    }, 1500);
});

// Защита логотипов от редактирования
customText.addEventListener('mousedown', function (e) {
    if (e.target.closest('.inline-logo')) {
        e.preventDefault();
        const logo = e.target.closest('.inline-logo');
        const range = document.createRange();
        range.setStartAfter(logo);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }
});

customText.addEventListener('touchstart', function (e) {
    if (e.target.closest('.inline-logo')) {
        const logo = e.target.closest('.inline-logo');
        const range = document.createRange();
        range.setStartAfter(logo);
        range.collapse(true);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }
}, {passive: true});


// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ОТРИСОВКИ
// ============================================
async function drawPlateImmediate() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Рисуем фоны
    drawBackground(CANVAS_WIDTH, CANVAS_HEIGHT, SCALE_FACTOR);
    drawInnerBackground(CANVAS_WIDTH, CANVAS_HEIGHT, SCALE_FACTOR, settings.mainBorderRadius);

    // Основная рамка
    drawRoundedRect(
        0, 0,
        CANVAS_WIDTH, CANVAS_HEIGHT,
        settings.mainBorderRadius * SCALE_FACTOR,
        '#000000'
    );

    // Окантовка если нужна
    if (settings.borderThickness > 0) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 5 * SCALE_FACTOR;
        ctx.shadowOffsetY = 2 * SCALE_FACTOR;
        drawRoundedRect(
            2 * SCALE_FACTOR, 2 * SCALE_FACTOR,
            CANVAS_WIDTH - (4 * SCALE_FACTOR), CANVAS_HEIGHT - (4 * SCALE_FACTOR),
            (settings.mainBorderRadius * SCALE_FACTOR) - (2 * SCALE_FACTOR),
            null,
            '#333333',
            settings.borderThickness * SCALE_FACTOR
        );
        ctx.restore();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
    }

    // Рисуем соответствующую сторону
    if (currentSide === 'front') {
        drawFrontSide(
            numberInput.value,
            regionInput.value,
            CANVAS_WIDTH,
            CANVAS_HEIGHT
        );
    } else {
        const isBold = document.getElementById('textWeightBold').checked;
        await drawBackSide(
            getCustomTextFragments(),
            parseInt(textSize.value),
            isBold ? 'bold' : 'normal',
            textColor.value,
            CANVAS_WIDTH,
            CANVAS_HEIGHT
        );
    }

    // Рисуем точки ТОЛЬКО для передней стороны
    if (currentSide === 'front') {
        drawSideDots(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, settings, SCALE_FACTOR);
    }
}

let drawPlateSeq = 0;
async function drawPlate() {
    const seq = ++drawPlateSeq;
    await new Promise(r => requestAnimationFrame(r));
    if (seq !== drawPlateSeq) return;
    await drawPlateImmediate();
}

// ============================================
// ЗАГРУЗКА ШРИФТА
// ============================================
let fontLoaded = false;

function loadCustomFont() {
    if (fontLoaded) return Promise.resolve();

    return new Promise((resolve) => {
        const style = document.createElement('style');
        style.textContent = `
            @font-face {
                font-family: 'GibddFont';
                src: url('fonts/frontpanel/gibdd-font.ttf') format('truetype');
                font-weight: bold;
                font-style: normal;
                font-display: swap;
            }
        `;
        document.head.appendChild(style);

        const timeout = setTimeout(() => {
            fontLoaded = true;
            resolve();
        }, 800);

        if (document.fonts && document.fonts.load) {
            const testString = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            document.fonts.load(`bold 160px 'GibddFont', 'Arial Black'`, testString)
                .then(() => {
                    clearTimeout(timeout);
                    fontLoaded = true;
                    resolve();
                })
                .catch(() => {
                    clearTimeout(timeout);
                    fontLoaded = true;
                    resolve();
                });
        } else {
            clearTimeout(timeout);
            fontLoaded = true;
            resolve();
        }
    });
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
function initEmojiTabs() {
    const tabs = document.querySelectorAll('.emoji-tab');
    const gridContainer = document.getElementById('emojiGridContainer');

    if (!tabs.length || !gridContainer) return;

    function renderEmojiGrid(category) {
        const emojis = EMOJI_CATEGORIES[category] || [];
        gridContainer.innerHTML = `
            <div class="emoji-grid">
                ${emojis.map(emoji => `
                    <button class="emoji-btn" data-emoji="${emoji}">${emoji}</button>
                `).join('')}
            </div>
        `;

        gridContainer.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const emoji = this.dataset.emoji;
                const target = document.getElementById('customText');
                if (!target) return;

                const selection = window.getSelection();

                if (selection.rangeCount === 0 || !target.contains(selection.anchorNode)) {
                    const textNode = document.createTextNode(emoji);
                    target.appendChild(textNode);
                } else {
                    const range = selection.getRangeAt(0);
                    const textNode = document.createTextNode(emoji);
                    range.insertNode(textNode);
                    range.setStartAfter(textNode);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }

                drawPlate();
            });
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderEmojiGrid(tab.dataset.category);
        });
    });

    if (tabs[0]) {
        tabs[0].classList.add('active');
        renderEmojiGrid(tabs[0].dataset.category);
    }
}

async function initializeWithFont() {
    console.log('Загружаем шрифт...');

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    try {
        await loadCustomFont();
        console.log('Шрифт загружен');

        // Настраиваем колбэки для панели настроек
        setSettingsCallbacks(settings, saveSettings, drawPlate);

        // Создаем панель настроек
        createSettingsPanel();

        // Настраиваем контекст для логотипов
        setLogoContext(canvas, ctx, () => currentSide, drawPlate);

        // Инициализируем табы для смайликов (независимо от логотипов)
        initEmojiTabs();

        // Создаем и добавляем панель логотипов
        const emojiPanel = document.querySelector('.emoji-panel');
        if (emojiPanel) {
            try {
                const logoPanel = await createLogoPanel();
                emojiPanel.insertAdjacentElement('afterend', logoPanel);
            } catch (e) {
                console.warn('Ошибка загрузки логотипов:', e);
            }
        }

        // Первая отрисовка
        drawPlateImmediate();

    } catch (e) {
        console.error('Ошибка загрузки шрифта:', e);
        setSettingsCallbacks(settings, saveSettings, drawPlate);
        createSettingsPanel();
        initEmojiTabs();
        drawPlate();
    }
}

// ============================================
// МОБИЛЬНАЯ КЛАВИАТУРА
// ============================================

let isKeyboardOpen = false;
let isSearchInputFocused = false;

function isSearchInput(el) {
    return el && el.classList && el.classList.contains('logo-search-input');
}

function setKeyboardState(open) {
    if (isKeyboardOpen === open) return;
    isKeyboardOpen = open;
    const preview = document.querySelector('.preview-area');
    isSearchInputFocused = isSearchInput(document.activeElement);
    if (open) {
        document.body.classList.add('keyboard-open');
        if (isSearchInputFocused) {
            document.body.classList.add('keyboard-open-search');
        }
        if (preview) {
            preview.scrollIntoView({behavior: 'smooth', block: 'start'});
        }
    } else {
        document.body.classList.remove('keyboard-open');
        document.body.classList.remove('keyboard-open-search');
        if (preview) {
            preview.style.position = '';
            preview.style.top = '';
            preview.style.left = '';
            preview.style.transform = '';
            preview.style.width = '';
        }
    }
}

function updateKeyboardPreview() {
    const preview = document.querySelector('.preview-area');
    if (!preview || !isKeyboardOpen) return;

    isSearchInputFocused = isSearchInput(document.activeElement);

    if (isSearchInputFocused && window.visualViewport) {
        const top = Math.max(4, window.visualViewport.offsetTop);
        preview.style.top = top + 'px';
        preview.style.position = 'fixed';
        preview.style.left = '50%';
        preview.style.transform = 'translateX(-50%)';
        preview.style.width = `min(calc(100% - 30px), 400px)`;
    } else {
        preview.style.position = '';
        preview.style.top = '';
        preview.style.left = '';
        preview.style.transform = '';
        preview.style.width = '';
    }
}

// Visual Viewport API (iOS Safari 13+)
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        const ratio = window.visualViewport.height / window.screen.height;
        setKeyboardState(ratio < 0.6);
        updateKeyboardPreview();
    });
    window.visualViewport.addEventListener('scroll', updateKeyboardPreview);
} else {
    let originalViewportHeight = window.innerHeight;
    window.addEventListener('resize', () => {
        const heightDiff = originalViewportHeight - window.innerHeight;
        setKeyboardState(heightDiff > 150);
    });
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            originalViewportHeight = window.innerHeight;
            setKeyboardState(false);
        }, 200);
    });
}

// Настраиваем кнопку скачивания
setupDownloadButton(canvas, () => numberInput.value, () => regionInput.value);


setDownloadContext(ctx, settings, {
    numberInput,
    regionInput,
    customText,
    textSize,
    textColor,
    textWeightBold: document.getElementById('textWeightBold')
});

// Запускаем
initializeWithFont();

// Очистка при выгрузке
window.addEventListener('beforeunload', function () {
    if (window.createdUrls) {
        window.createdUrls.forEach(url => URL.revokeObjectURL(url));
    }
});

window.addEventListener('load', drawPlateImmediate);