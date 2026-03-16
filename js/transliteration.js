// ============================================
// ТРАНСЛИТЕРАЦИЯ
// ============================================

import { ALLOWED_CHARS, RUS_TO_LAT } from './config.js';

/**
 * Фильтрует и транслитерирует текст номера
 * @param {string} text - Входной текст
 * @returns {string} - Отфильтрованный и транслитерированный текст
 */
export function filterAndTransliterate(text) {
    let result = '';
    for (let char of text) {
        let translated = RUS_TO_LAT[char] || char;
        translated = translated.toUpperCase();
        if (ALLOWED_CHARS.includes(translated)) {
            result += translated;
        }
    }
    return result;
}

/**
 * Возвращает текст для отображения на номере
 * @param {string} text - Входной текст
 * @returns {string} - Текст для отрисовки
 */
export function getDisplayNumber(text) {
    return filterAndTransliterate(text || 'М123ММ');
}
