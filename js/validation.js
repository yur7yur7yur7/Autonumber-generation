// ============================================
// ВАЛИДАЦИЯ ПОЛЕЙ ВВОДА
// ============================================

import { RUS_TO_LAT } from './config.js';

let msgTimeout;

/**
 * Показывает временное сообщение
 * @param {string} text - Текст сообщения
 * @param {string} type - Тип сообщения (error, success, warning)
 */
export function showTemporaryMessage(text, type = 'error') {
    let msgEl = document.getElementById('validation-message');
    if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.id = 'validation-message';
        msgEl.className = 'validation-message';
        document.querySelector('.plate-inputs').appendChild(msgEl);
    }

    msgEl.classList.remove('error', 'warning', 'success');
    msgEl.classList.add(type);
    msgEl.textContent = text;
    msgEl.classList.add('show');

    clearTimeout(msgTimeout);
    msgTimeout = setTimeout(() => {
        msgEl.classList.remove('show');
    }, 1500);
}

/**
 * Настраивает валидацию для поля номера
 * @param {HTMLInputElement} input - Поле ввода номера
 * @param {Function} onUpdate - Колбэк при обновлении
 */
export function setupNumberValidation(input, onUpdate) {
    input.addEventListener('input', function (e) {
        let value = this.value;
        let filtered = '';

        for (let char of value) {
            if (RUS_TO_LAT[char] || /[0-9]/.test(char)) {
                filtered += char;
            }
        }

        if (filtered.length > 6) {
            this.value = filtered.slice(0, 6);
            showTemporaryMessage('Максимум 6 символов');
        } else {
            this.value = filtered;
        }

        if (onUpdate) onUpdate();
    });

    input.addEventListener('paste', function (e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        let filtered = '';
        for (let char of pastedText) {
            if (RUS_TO_LAT[char] || /[0-9]/.test(char)) {
                filtered += char;
            }
        }
        this.value = filtered.slice(0, 6);
        if (onUpdate) onUpdate();
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const regionInput = document.getElementById('plateRegion');
            if (regionInput) regionInput.focus();
        }
    });
}

/**
 * Настраивает валидацию для поля региона
 * @param {HTMLInputElement} input - Поле ввода региона
 * @param {Function} onUpdate - Колбэк при обновлении
 */
export function setupRegionValidation(input, onUpdate) {
    input.addEventListener('input', function (e) {
        let value = this.value.replace(/[^0-9]/g, '');
        if (value.length > 3) {
            this.value = value.slice(0, 3);
            showTemporaryMessage('Максимум 3 цифры');
        } else {
            this.value = value;
        }
        if (onUpdate) onUpdate();
    });

    input.addEventListener('paste', function (e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const digits = pastedText.replace(/[^0-9]/g, '').slice(0, 3);
        this.value = digits;
        if (onUpdate) onUpdate();
    });

    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const downloadBtn = document.getElementById('downloadBtn');
            if (downloadBtn) downloadBtn.click();
        }
    });
}
