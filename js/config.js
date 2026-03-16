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
    STORAGE_KEY: 'plateGeneratorSettings'
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
    { name: 'Comic Sans MS', value: '"Comic Sans MS", cursive, sans-serif' }
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
    innerBorderRadius: 10,

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
    backTextY: 11,                    // было 0, стало 11
    backTextPadding: 0,                // было 20, стало 0
    backTextLineSpacing: 1.2,          // без изменений
    backTextMaxWidth: 1.0,              // было 0.9, стало 1.0
    backTextAlign: 'center',            // без изменений
    backFontFamily: '"Comic Sans MS", cursive, sans-serif',
    backLogoY: 0,

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
