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
// import { drawLogos } from './logos.js';
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
const textColor = document.getElementById('textColor'); // ← textWeight удален
const downloadBtn = document.getElementById('downloadBtn');


// ============================================
// НАСТРОЙКА КАНВАСА
// ============================================
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
canvas.style.width = '600px';
canvas.style.height = 'auto';
canvas.style.imageRendering = 'auto';

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
// import { updateSettingsVisibility } from './settings-panel.js';

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

// Backspace/Delete для удаления логотипов
customText.addEventListener('keydown', function (e) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    if (e.key === 'Backspace') {
        if (range.collapsed && range.startOffset === 0) {
            const node = range.startContainer;
            if (node.previousSibling && node.previousSibling.classList &&
                node.previousSibling.classList.contains('inline-logo')) {
                e.preventDefault();
                node.previousSibling.remove();
                drawPlate();
            }
        }
    }

    if (e.key === 'Delete') {
        if (range.collapsed && range.startOffset === range.startContainer.length) {
            const node = range.startContainer;
            if (node.nextSibling && node.nextSibling.classList &&
                node.nextSibling.classList.contains('inline-logo')) {
                e.preventDefault();
                node.nextSibling.remove();
                drawPlate();
            }
        }
    }
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


// ============================================
// ОСНОВНАЯ ФУНКЦИЯ ОТРИСОВКИ
// ============================================
function drawPlate() {
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
        drawBackSide(
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

// ============================================
// ЗАГРУЗКА ШРИФТА
// ============================================
function loadCustomFont() {
    return new Promise((resolve) => {
        const style = document.createElement('style');
        style.textContent = `
            @font-face {
                font-family: 'GibddFont';
                src: url('fonts/gibdd-font.ttf') format('truetype');
                font-weight: bold;
                font-style: normal;
                font-display: block;
            }
        `;
        document.head.appendChild(style);

        if (document.fonts && document.fonts.load) {
            const testString = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            document.fonts.load(`bold 160px 'GibddFont', 'Arial Black'`, testString)
                .then(() => resolve())
                .catch(() => setTimeout(resolve, 300));
        } else {
            setTimeout(resolve, 300);
        }

        setTimeout(resolve, 1000);
    });
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
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

        // Создаем и добавляем панель логотипов
        const emojiPanel = document.querySelector('.emoji-panel');
        if (emojiPanel) {
            const logoPanel = await createLogoPanel();
            emojiPanel.insertAdjacentElement('afterend', logoPanel);
        }

        // Инициализируем табы для смайликов
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

                // ✅ Вешаем обработчики на новые кнопки
                gridContainer.querySelectorAll('.emoji-btn').forEach(btn => {
                    btn.addEventListener('click', function () {
                        const emoji = this.dataset.emoji;
                        const customText = document.getElementById('customText');
                        if (!customText) return;

                        const selection = window.getSelection();

                        if (selection.rangeCount === 0 || !customText.contains(selection.anchorNode)) {
                            const textNode = document.createTextNode(emoji);
                            customText.appendChild(textNode);
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

        // Вызвать после создания панели логотипов
        initEmojiTabs();

        // Первая отрисовка
        drawPlate();

        // Повторные отрисовки для гарантии
        setTimeout(drawPlate, 200);
        setTimeout(drawPlate, 500);

    } catch (e) {
        console.error('Ошибка загрузки шрифта:', e);
        setSettingsCallbacks(settings, saveSettings, drawPlate);
        createSettingsPanel();
        drawPlate();
    }
}

// ============================================
// МОБИЛЬНАЯ КЛАВИАТУРА
// ============================================

let isKeyboardOpen = false;
let originalViewportHeight = window.innerHeight;
let keyboardScrollTimer = null;

// Функция для определения открытия клавиатуры
function detectKeyboard() {
    const currentHeight = window.innerHeight;
    const heightDiff = originalViewportHeight - currentHeight;

    // Если высота уменьшилась более чем на 150px - скорее всего клавиатура
    if (heightDiff > 150 && !isKeyboardOpen) {
        isKeyboardOpen = true;
        document.body.classList.add('keyboard-open');

        // Плавно скроллим к preview
        clearTimeout(keyboardScrollTimer);
        keyboardScrollTimer = setTimeout(() => {
            document.querySelector('.preview-area').scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 100);
    }

    // Если высота вернулась - клавиатура закрылась
    else if (heightDiff <= 150 && isKeyboardOpen) {
        isKeyboardOpen = false;
        document.body.classList.remove('keyboard-open');
    }
}

// Слушаем resize с задержкой
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(detectKeyboard, 100);
});

// Для полей ввода
const inputs = [
    document.getElementById('plateNumber'),
    document.getElementById('plateRegion'),
    document.getElementById('customText')
];

inputs.forEach(input => {
    if (!input) return;

    input.addEventListener('focus', () => {
        // Если на мобилке - ждем появления клавиатуры
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                detectKeyboard();
            }, 300);
        }
    });

    input.addEventListener('blur', () => {
        // Даем время на закрытие клавиатуры
        setTimeout(() => {
            detectKeyboard();
        }, 300);
    });
});

// Сохраняем оригинальную высоту при повороте экрана
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        originalViewportHeight = window.innerHeight;
        isKeyboardOpen = false;
        document.body.classList.remove('keyboard-open');
    }, 100);
});

// Настраиваем кнопку скачивания
// setupDownloadButton(
//     downloadBtn,
//     canvas,
//     () => currentSide,
//     () => numberInput.value,
//     () => regionInput.value,
//     (tempCtx) => { // Функция для рисования передней стороны
//         const originalCtx = ctx;
//         setDrawingContext(tempCtx);
//         setFrontContext(tempCtx, settings);
//         drawFrontSide(
//             numberInput.value,
//             regionInput.value,
//             CANVAS_WIDTH,
//             CANVAS_HEIGHT
//         );
//         setDrawingContext(originalCtx);
//         setFrontContext(originalCtx, settings);
//     },
//     (tempCtx) => { // Функция для рисования задней стороны
//         const originalCtx = ctx;
//         setDrawingContext(tempCtx);
//         setBackContext(tempCtx, settings);
//         const isBold = document.getElementById('textWeightBold').checked;
//         drawBackSide(
//             customText.value,
//             parseInt(textSize.value),
//             isBold ? 'bold' : 'normal',
//             textColor.value,
//             CANVAS_WIDTH,
//             CANVAS_HEIGHT
//         );
//         setDrawingContext(originalCtx);
//         setBackContext(originalCtx, settings);
//     }
// );

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

window.addEventListener('load', drawPlate);