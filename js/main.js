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
        drawPlate();

        // Обновляем видимость настроек
        updateSettingsVisibility(side);
    });
});

// ============================================
// ЭМОДЗИ И НАСТРОЙКИ ТЕКСТА
// ============================================
document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const emoji = this.dataset.emoji;
        const cursorPos = customText.selectionStart;
        const textBefore = customText.value.substring(0, cursorPos);
        const textAfter = customText.value.substring(cursorPos);

        customText.value = textBefore + emoji + textAfter;
        customText.focus();
        customText.selectionStart = customText.selectionEnd = cursorPos + emoji.length;

        drawPlate();
    });
});

textSize.addEventListener('input', function () {
    textSizeValue.textContent = this.value;
    drawPlate();
});

// ============================================
// СЛУШАТЕЛИ ИЗМЕНЕНИЙ
// ============================================
customText.addEventListener('input', drawPlate);
textColor.addEventListener('input', drawPlate);

const textWeightBold = document.getElementById('textWeightBold');
if (textWeightBold) {
    textWeightBold.addEventListener('change', drawPlate);
}

// Валидация полей
setupNumberValidation(numberInput, drawPlate);
setupRegionValidation(regionInput, drawPlate);

// Добавить после других обработчиков
customText.addEventListener('click', function (e) {
    const cursorPos = this.selectionStart;
    const text = this.value;

    // Ищем все вхождения {brand}
    const logoRegex = /\{([a-z0-9-]+)\}/gi;
    let match;

    while ((match = logoRegex.exec(text)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;

        // Если курсор внутри скобок (включая сами скобки)
        if (cursorPos > start && cursorPos < end) {
            // Перемещаем курсор сразу после закрывающей скобки
            this.selectionStart = end;
            this.selectionEnd = end;
            break;
        }
    }
});

// То же для клавиш
customText.addEventListener('keyup', function (e) {
    // Не срабатывает на стрелки и т.д.
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        const cursorPos = this.selectionStart;
        const text = this.value;

        const logoRegex = /\{([a-z0-9-]+)\}/gi;
        let match;

        while ((match = logoRegex.exec(text)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;

            if (cursorPos > start && cursorPos < end) {
                this.selectionStart = end;
                this.selectionEnd = end;
                break;
            }
        }
    }
});

customText.addEventListener('keydown', function(e) {
    if (e.key === 'Backspace') {
        const cursorPos = this.selectionStart;
        const text = this.value;

        // Проверяем, находится ли курсор сразу после закрывающей скобки
        const logoRegex = /\{([a-z0-9-]+)\}(\s?)/gi;
        let match;

        while ((match = logoRegex.exec(text)) !== null) {
            const end = match.index + match[0].length;

            // Если курсор сразу после логотипа (или перед пробелом)
            if (cursorPos === end || cursorPos === end - 1) {
                e.preventDefault();

                // Удаляем весь логотип
                const beforeLogo = text.substring(0, match.index);
                const afterLogo = text.substring(end);
                this.value = beforeLogo + afterLogo;

                // Ставим курсор на место удаленного логотипа
                this.selectionStart = match.index;
                this.selectionEnd = match.index;

                drawPlate();
                break;
            }
        }
    }

    // Для Delete (если курсор перед логотипом)
    if (e.key === 'Delete') {
        const cursorPos = this.selectionStart;
        const text = this.value;

        const logoRegex = /\{([a-z0-9-]+)\}(\s?)/gi;
        let match;

        while ((match = logoRegex.exec(text)) !== null) {
            const start = match.index;
            const end = match.index + match[0].length;

            // Если курсор сразу перед логотипом
            if (cursorPos === start) {
                e.preventDefault();

                const beforeLogo = text.substring(0, start);
                const afterLogo = text.substring(end);
                this.value = beforeLogo + afterLogo;

                this.selectionStart = start;
                this.selectionEnd = start;

                drawPlate();
                break;
            }
        }
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
            customText.value,
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
