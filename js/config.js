// ============================================
// КОНФИГУРАЦИЯ И НАСТРОЙКИ
// ============================================

export const CONFIG = {
    // Размеры канваса
    CANVAS_WIDTH: 1224,
    CANVAS_HEIGHT: 252,

    // Коэффициент масштабирования
    SCALE_FACTOR: 1224 / 720,

    // Размеры шрифтов
    LETTER_HEIGHT: Math.round(160 * (1224 / 720)),
    DIGIT_HEIGHT: Math.round(160 * (1224 / 720)),
    REGION_HEIGHT: Math.round(125 * (1224 / 720)),
    FLAG_HEIGHT: Math.round(28 * (1224 / 720)),

    // Ключ для localStorage
    STORAGE_KEY: 'plateGeneratorSettings',

    // URL Cloudflare Worker, который релеит SVG в Telegram @dukas666.
    // По умолчанию пусто — кнопка «Скачать макет» только сохраняет SVG локально
    // (старое поведение). Чтобы включить отправку в Telegram, задеплой
    // `worker/` (см. README раздел «Telegram auto-send») и впиши сюда URL
    // деплоя. Сейчас включено для прод-режима.
    TELEGRAM_RELAY_URL: 'https://brelok-telegram-relay.yur7yur7yur7yur7yur7.workers.dev',
};

// Список доступных шрифтов
export const AVAILABLE_FONTS = [
    { name: 'Стандартный (Arial)', value: 'Arial, sans-serif' },
    { name: 'Arial Black', value: '"Arial Black", Arial, sans-serif' },
    { name: 'Verdana', value: 'Verdana, Arial, sans-serif' },
    { name: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
    { name: 'Times New Roman', value: '"Times New Roman", serif' },
    { name: 'Georgia', value: 'Georgia, serif' },
    { name: 'Courier New', value: '"Courier New", monospace' },
    { name: 'Impact', value: 'Impact, Arial, sans-serif' },
    { name: 'Comic Sans MS', value: '"Comic Sans MS", cursive, sans-serif' },
    { name: 'Noto Sans', value: '"Noto Sans", sans-serif', file: 'fonts/backpanel/NotoSans.woff2' },
    { name: 'Noto Serif', value: '"Noto Serif", serif', file: 'fonts/backpanel/NotoSerif.woff2' },
    { name: 'Inter', value: '"Inter", sans-serif', file: 'fonts/backpanel/Inter.woff2' },
    { name: 'Roboto', value: '"Roboto", sans-serif', file: 'fonts/backpanel/Roboto.woff2' },
    { name: 'Montserrat', value: '"Montserrat", sans-serif', file: 'fonts/backpanel/Montserrat.woff2' },
    { name: 'Oswald', value: '"Oswald", sans-serif', file: 'fonts/backpanel/Oswald.woff2' },
    { name: 'Raleway', value: '"Raleway", sans-serif', file: 'fonts/backpanel/Raleway.woff2' },
    { name: 'Nunito', value: '"Nunito", sans-serif', file: 'fonts/backpanel/Nunito.woff2' },
    { name: 'PT Sans', value: '"PT Sans", sans-serif', file: 'fonts/backpanel/PTSans.woff2' },
    { name: 'Caveat', value: '"Caveat", cursive', file: 'fonts/backpanel/Caveat.woff2' }
];

// Настройки по умолчанию
export const DEFAULT_SETTINGS = {
    // Позиция RUS и флага
    rusX: 14,
    rusY: 32,
    flagX: 19,
    flagY: 1,

    // Показывать флаг
    showFlag: true,

    // Ширина окантовки
    borderThickness: 0,

    // Положение номера
    numberY: 25,

    // Скругление углов
    mainBorderRadius: 0,
    innerBorderRadius: 18,

    // Размеры белых прямоугольников
    numberAreaWidth: 522,
    regionAreaWidth: 178,

    // Положение региона
    regionY: 74,

    // Настройки номера
    numberPadding: 14,
    numberX: 0,

    // Отступ от краев
    margin: 7,

    // Настройки для обратной стороны
    backTextX: 0,
    backTextY: 11,                    // было 0, стало 11
    backTextPadding: 0,                // было 20, стало 0
    backTextLineSpacing: 1.2,          // без изменений
    backTextMaxWidth: 1.0,              // было 0.9, стало 1.0
    backTextAlign: 'center',            // без изменений
    backFontFamily: '"Comic Sans MS", cursive, sans-serif',
    backLogoPositions: {}, // { [logoFile: string]: { x: number, y: number } }
    // Размер логотипов относительно шрифта (множитель)
    backLogoSize: 1.0,

    // Точки по бокам
    showSideDots: false,
    dotSize: 15,
    dotOffset: 21,

    // Смещение региона по X
    regionX: 0
};

// Допустимые символы для номера
export const ALLOWED_CHARS = ['A', 'B', 'C', 'D', 'E', 'H', 'K', 'M', 'O', 'P', 'T', 'X', 'Y', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Транслитерация русских букв
export const RUS_TO_LAT = {
    'А': 'A', 'В': 'B', 'С': 'C', 'Д': 'D', 'Е': 'E',
    'Н': 'H', 'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P',
    'Т': 'T', 'Х': 'X', 'У': 'Y',
    'а': 'A', 'в': 'B', 'с': 'C', 'д': 'D', 'е': 'E',
    'н': 'H', 'к': 'K', 'м': 'M', 'о': 'O', 'р': 'P',
    'т': 'T', 'х': 'X', 'у': 'Y'
};