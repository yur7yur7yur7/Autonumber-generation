// ============================================
// ПАНЕЛЬ НАСТРОЕК
// ============================================

import { DEFAULT_SETTINGS, AVAILABLE_FONTS } from './config.js';

function createFontSelector(selectedFont) {
    const container = document.createElement('div');
    container.className = 'custom-font-select';

    // Триггер (то что видно всегда)
    const trigger = document.createElement('div');
    trigger.className = 'font-select-trigger';

    const preview = document.createElement('span');
    preview.className = 'selected-font-preview';
    preview.style.fontFamily = selectedFont;

    // Находим название выбранного шрифта
    const selectedFontObj = AVAILABLE_FONTS.find(f => f.value === selectedFont) || AVAILABLE_FONTS[0];
    preview.textContent = selectedFontObj.name;

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '▼';

    trigger.appendChild(preview);
    trigger.appendChild(arrow);

    // Выпадающий список
    const dropdown = document.createElement('div');
    dropdown.className = 'font-dropdown';

    AVAILABLE_FONTS.forEach(font => {
        const option = document.createElement('div');
        option.className = 'font-option';
        if (font.value === selectedFont) {
            option.classList.add('selected');
        }
        option.dataset.font = font.value;
        option.style.fontFamily = font.value;
        option.textContent = font.name;

        option.addEventListener('click', () => {
            // Обновляем превью
            preview.style.fontFamily = font.value;
            preview.textContent = font.name;

            // Убираем выделение у всех
            dropdown.querySelectorAll('.font-option').forEach(opt => {
                opt.classList.remove('selected');
            });
            option.classList.add('selected');

            // Закрываем дропдаун
            container.classList.remove('open');

            // Сохраняем значение
            settings.backFontFamily = font.value;
            if (drawCallback) drawCallback();
            if (saveCallback) saveCallback();
        });

        dropdown.appendChild(option);
    });

    // Открытие/закрытие по клику на триггер
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        container.classList.toggle('open');
    });

    // Закрытие по клику вне
    document.addEventListener('click', () => {
        container.classList.remove('open');
    });

    container.appendChild(trigger);
    container.appendChild(dropdown);

    return container;
}

let settings = {};
let saveCallback = null;
let drawCallback = null;
let currentSide = 'front'; // Добавляем отслеживание текущей стороны

/**
 * Устанавливает настройки и колбэки
 * @param {Object} appSettings - Объект настроек
 * @param {Function} onSave - Функция сохранения
 * @param {Function} onDraw - Функция перерисовки
 */
export function setSettingsCallbacks(appSettings, onSave, onDraw) {
    settings = appSettings;
    saveCallback = onSave;
    drawCallback = onDraw;
}

/**
 * Обновляет видимость групп настроек в зависимости от стороны
 * @param {string} side - Текущая сторона ('front' или 'back')
 */
export function updateSettingsVisibility(side) {
    currentSide = side;

    const frontGroups = document.querySelectorAll('.settings-group.front-side');
    const backGroups = document.querySelectorAll('.settings-group.back-side');
    const flagToggle = document.querySelector('.flag-toggle-container'); // тумблер флага
    const dotsToggle = document.querySelectorAll('.flag-toggle-container')[1]; // тумблер точек
    const dotSettings = document.getElementById('dotSettingsContainer'); // настройки точек

    // Кнопки сброса
    const resetFrontBtn = document.getElementById('resetFrontSettingsBtn');
    const resetBackBtn = document.getElementById('resetBackSettingsBtn');

    if (side === 'front') {
        frontGroups.forEach(group => group.style.display = 'block');
        backGroups.forEach(group => group.style.display = 'none');
        if (flagToggle) flagToggle.style.display = 'block';
        if (dotsToggle) dotsToggle.style.display = 'block';

        // Показываем настройки точек только если они включены
        if (dotSettings) {
            dotSettings.style.display = settings.showSideDots ? 'block' : 'none';
        }

        // Показываем кнопку сброса номера, прячем кнопку сброса текста
        if (resetFrontBtn) resetFrontBtn.style.display = 'flex';
        if (resetBackBtn) resetBackBtn.style.display = 'none';

    } else {
        frontGroups.forEach(group => group.style.display = 'none');
        backGroups.forEach(group => group.style.display = 'block');
        if (flagToggle) flagToggle.style.display = 'none';
        if (dotsToggle) dotsToggle.style.display = 'none';
        if (dotSettings) dotSettings.style.display = 'none'; // прячем настройки точек

        // Показываем кнопку сброса текста, прячем кнопку сброса номера
        if (resetFrontBtn) resetFrontBtn.style.display = 'none';
        if (resetBackBtn) resetBackBtn.style.display = 'flex';
    }
}

/**
 * Создает панель настроек
 */
export function createSettingsPanel() {
    const container = document.querySelector('.container');
    const actions = document.querySelector('.actions');

    const settingsDiv = document.createElement('div');
    settingsDiv.className = 'settings-panel';
    settingsDiv.innerHTML = getSettingsHTML();

    settingsDiv.style.display = 'none';

    // Кнопка показа настроек
    if (!document.getElementById('showSettingsBtn')) {
        const showBtn = document.createElement('button');
        showBtn.id = 'showSettingsBtn';
        showBtn.className = 'show-settings-btn';
        showBtn.textContent = '🔧 Показать настройки';
        showBtn.onclick = function () {
            settingsDiv.style.display = 'block';
            this.style.display = 'none';

            setTimeout(() => {
                settingsDiv.scrollIntoView({behavior: 'smooth', block: 'start'});
            }, 100);
        };

        actions.appendChild(showBtn);
    }

    // Обработчик для точек по бокам
    // const showSideDots = document.getElementById('showSideDots');
    // if (showSideDots) {
    //     showSideDots.addEventListener('change', function() {
    //         settings.showSideDots = this.checked;
    //
    //         // Показываем или скрываем настройки размера и отступа
    //         const dotSizeContainer = document.getElementById('dotSizeContainer');
    //         const dotOffsetContainer = document.getElementById('dotOffsetContainer');
    //
    //         if (dotSizeContainer) {
    //             dotSizeContainer.style.display = this.checked ? 'flex' : 'none';
    //         }
    //         if (dotOffsetContainer) {
    //             dotOffsetContainer.style.display = this.checked ? 'flex' : 'none';
    //         }
    //
    //         if (drawCallback) drawCallback();
    //         if (saveCallback) saveCallback();
    //     });
    // }

    actions.insertAdjacentElement('afterend', settingsDiv);

    const fontSelectorContainer = document.getElementById('fontSelectorContainer');
    if (fontSelectorContainer) {
        const fontSelector = createFontSelector(settings.backFontFamily || AVAILABLE_FONTS[0].value);
        fontSelectorContainer.appendChild(fontSelector);
    }

    // Обработчик чекбокса флага
    document.getElementById('showFlagCheckbox').addEventListener('change', function () {
        settings.showFlag = this.checked;
        updateFlagSettings(this.checked);
        if (drawCallback) drawCallback();
        if (saveCallback) saveCallback();
    });

    // Обработчик для точек по бокам
    const showSideDots = document.getElementById('showSideDots');
    if (showSideDots) {
        showSideDots.addEventListener('change', function() {
            settings.showSideDots = this.checked;

            // Меняем отступы номера
            if (this.checked) {
                settings.numberPadding = 0;
                settings.regionX = 23;
            } else {
                settings.numberPadding = 14;
                settings.regionX = 0;
            }

            // Обновляем отображение слайдеров
            const numberPaddingSlider = document.querySelector('[data-setting="numberPadding"]');
            const numberPaddingValue = document.querySelector('.value.numberPadding');
            if (numberPaddingSlider) {
                numberPaddingSlider.value = settings.numberPadding;
                numberPaddingValue.textContent = settings.numberPadding;
            }

            const regionXSlider = document.querySelector('[data-setting="regionX"]');
            const regionXValue = document.querySelector('.value.regionX');
            if (regionXSlider) {
                regionXSlider.value = settings.regionX;
                regionXValue.textContent = settings.regionX;
            }

            // Показываем или скрываем настройки размера и отступа
            const dotSettings = document.getElementById('dotSettingsContainer');
            if (dotSettings) {
                dotSettings.style.display = this.checked ? 'block' : 'none';
            }

            if (drawCallback) drawCallback();
            if (saveCallback) saveCallback();
        });
    }

    // Обработчики слайдеров
    settingsDiv.querySelectorAll('.setting-slider').forEach(slider => {
        slider.addEventListener('input', function () {
            const setting = this.dataset.setting;
            const value = parseFloat(this.value);
            settings[setting] = value;
            this.parentElement.querySelector('.value').textContent = value;
            if (drawCallback) drawCallback();
            if (saveCallback) saveCallback();
        });
    });


    // Обработчик для радио-кнопок выравнивания
    document.querySelectorAll('input[name="textAlign"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                settings.backTextAlign = this.value;
                if (drawCallback) drawCallback();
                if (saveCallback) saveCallback();
            }
        });
    });


    // Начальное состояние
    const flagCheckbox = document.getElementById('showFlagCheckbox');
    if (!flagCheckbox.checked) {
        window.savedRusX = settings.rusX;
        window.savedFlagX = settings.flagX;
        updateFlagSettings(false);
    }

    // Кнопка сброса настроек номера
    document.getElementById('resetFrontSettingsBtn').addEventListener('click', function () {
        // Сохраняем текущие настройки текста
        const backSettings = {
            backTextY: settings.backTextY,
            backTextPadding: settings.backTextPadding,
            backTextLineSpacing: settings.backTextLineSpacing,
            backTextMaxWidth: settings.backTextMaxWidth,
            backTextAlign: settings.backTextAlign,
            backFontFamily: settings.backFontFamily
        };

        // Сбрасываем ВСЕ настройки к DEFAULT
        Object.assign(settings, DEFAULT_SETTINGS);

        // Обновляем отступы номера в зависимости от состояния точек
        if (settings.showSideDots) {
            settings.numberPadding = 0;
            settings.regionX = 23;
        } else {
            settings.numberPadding = 14;
            settings.regionX = 0;
        }

// Обновляем слайдеры
        const numberPaddingSlider = document.querySelector('[data-setting="numberPadding"]');
        if (numberPaddingSlider) {
            numberPaddingSlider.value = settings.numberPadding;
            numberPaddingSlider.parentElement.querySelector('.value').textContent = settings.numberPadding;
        }

        const regionXSlider = document.querySelector('[data-setting="regionX"]');
        if (regionXSlider) {
            regionXSlider.value = settings.regionX;
            regionXSlider.parentElement.querySelector('.value').textContent = settings.regionX;
        }

        // Возвращаем настройки текста
        settings.backTextY = backSettings.backTextY;
        settings.backTextPadding = backSettings.backTextPadding;
        settings.backTextLineSpacing = backSettings.backTextLineSpacing;
        settings.backTextMaxWidth = backSettings.backTextMaxWidth;
        settings.backTextAlign = backSettings.backTextAlign;
        settings.backFontFamily = backSettings.backFontFamily;

        // // Обновляем слайдеры (только для передней стороны)
        // document.querySelectorAll('[data-setting^="rus"], [data-setting^="flag"], [data-setting="numberY"], [data-setting="numberAreaWidth"], [data-setting="numberPadding"], [data-setting="regionY"], [data-setting="regionAreaWidth"], [data-setting="mainBorderRadius"], [data-setting="innerBorderRadius"], [data-setting="margin"]').forEach(slider => {
        //     const setting = slider.dataset.setting;
        //     slider.value = settings[setting];
        //     slider.parentElement.querySelector('.value').textContent = settings[setting];
        // });

        // Обновляем чекбокс флага
        const flagCheckbox = document.getElementById('showFlagCheckbox');
        flagCheckbox.checked = settings.showFlag;

        // Обновляем saved значения
        window.savedRusX = undefined;
        window.savedFlagX = undefined;

        updateFlagSettings(settings.showFlag);

        if (drawCallback) drawCallback();
        if (saveCallback) saveCallback();
    });

// Кнопка сброса настроек текста
    document.getElementById('resetBackSettingsBtn').addEventListener('click', function () {
        // Сохраняем текущие настройки номера
        const frontSettings = {
            rusX: settings.rusX,
            rusY: settings.rusY,
            flagX: settings.flagX,
            flagY: settings.flagY,
            showFlag: settings.showFlag,
            borderThickness: settings.borderThickness,
            numberY: settings.numberY,
            mainBorderRadius: settings.mainBorderRadius,
            innerBorderRadius: settings.innerBorderRadius,
            numberAreaWidth: settings.numberAreaWidth,
            regionAreaWidth: settings.regionAreaWidth,
            regionY: settings.regionY,
            numberPadding: settings.numberPadding,
            margin: settings.margin
        };

        // Сбрасываем только настройки текста
        settings.backTextY = 11;
        settings.backTextPadding = 0;
        settings.backTextLineSpacing = 1.2;
        settings.backTextMaxWidth = 1.0;
        settings.backTextAlign = 'center';
        settings.backFontFamily = '"Comic Sans MS", cursive, sans-serif';
        settings.backLogoY = 0;

        // Сбрасываем размер текста в интерфейсе
        const textSizeInput = document.getElementById('textSize');
        const textSizeValue = document.getElementById('textSizeValue');
        if (textSizeInput) {
            textSizeInput.value = 63;
            textSizeValue.textContent = 63;
        }

        // Возвращаем настройки номера
        // Object.assign(settings, frontSettings);

        // Обновляем слайдеры (только для задней стороны)
        document.querySelectorAll('[data-setting="backTextY"], [data-setting="backTextPadding"], [data-setting="backTextLineSpacing"], [data-setting="backTextMaxWidth"]').forEach(slider => {
            const setting = slider.dataset.setting;
            slider.value = settings[setting];
            slider.parentElement.querySelector('.value').textContent = settings[setting];
        });

        // Добавить после обновления слайдеров:
        const boldCheckbox = document.getElementById('textWeightBold');
        if (boldCheckbox) {
            boldCheckbox.checked = true; // жирный по умолчанию
        }

        // Обновляем радио-кнопки
        document.querySelectorAll('input[name="textAlign"]').forEach(radio => {
            radio.checked = (radio.value === 'center');
        });

        // Обновляем селекты
        const alignSelect = document.getElementById('backTextAlign');
        if (alignSelect) alignSelect.value = settings.backTextAlign;

        const fontSelectorContainer = document.getElementById('fontSelectorContainer');
        if (fontSelectorContainer) {
            fontSelectorContainer.innerHTML = '';
            const newFontSelector = createFontSelector(settings.backFontFamily);
            fontSelectorContainer.appendChild(newFontSelector);
        }

        if (drawCallback) drawCallback();
        if (saveCallback) saveCallback();
    });

    // Кнопка скрытия
    document.getElementById('hideSettingsBtn').addEventListener('click', function () {
        settingsDiv.style.display = 'none';

        // Показываем кнопку "Показать настройки" снова
        const showBtn = document.getElementById('showSettingsBtn');
        if (showBtn) {
            showBtn.style.display = 'flex'; // или 'block' - как в CSS
        } else {
            // Если кнопки нет по какой-то причине, создаем новую
            const newShowBtn = document.createElement('button');
            newShowBtn.id = 'showSettingsBtn';
            newShowBtn.className = 'show-settings-btn';
            newShowBtn.textContent = '🔧 Показать настройки';
            newShowBtn.onclick = function () {
                settingsDiv.style.display = 'block';
                this.style.display = 'none';
                setTimeout(() => {
                    settingsDiv.scrollIntoView({behavior: 'smooth', block: 'start'});
                }, 100);
            };
            actions.appendChild(newShowBtn);
        }
    });

    // Устанавливаем начальную видимость (по умолчанию front)
    updateSettingsVisibility('front');
}

/**
 * Возвращает HTML панели настроек
 */
function getSettingsHTML() {
    return `
        <h3>🔧 Детальные настройки</h3>

        <div class="flag-toggle-container">
            <label class="flag-toggle">
                <input type="checkbox" id="showFlagCheckbox" ${settings.showFlag ? 'checked' : ''}>
                <span class="toggle-slider"></span>
                <span class="toggle-label">Показывать флаг и RUS</span>
            </label>
        </div>
        
        <div class="flag-toggle-container">
            <label class="flag-toggle">
                <input type="checkbox" id="showSideDots" ${settings.showSideDots ? 'checked' : ''}>
                <span class="toggle-slider"></span>
                <span class="toggle-label dots">Показывать точки по бокам</span>
            </label>
        </div>
        
        <!-- Настройки размера точек (показываются если включены) -->
        <div id="dotSettingsContainer" style="${settings.showSideDots ? 'display: block;' : 'display: none;'}">
            <div class="settings-group">
                <div class="settings-group-title">
                    <span>⚙️ Настройки точек</span>
                </div>
                <div class="settings-grid">
                    <div class="setting-item">
                        <label>Размер точек: <span class="value dotSize">${settings.dotSize || 8}</span></label>
                        <input type="range" class="setting-slider" data-setting="dotSize" min="4" max="30" value="${settings.dotSize || 15}">
                    </div>
                    <div class="setting-item">
                        <label>Отступ от края: <span class="value dotOffset">${settings.dotOffset || 15}</span></label>
                        <input type="range" class="setting-slider" data-setting="dotOffset" min="5" max="40" value="${settings.dotOffset || 21}">
                    </div>
                </div>
            </div>
        </div>
    
        <!-- Настройки для передней стороны -->
        <div class="settings-group front-side">
            <div class="settings-group-title">
                <span>🇷🇺 Настройки флага и RUS</span>
            </div>
            <div class="settings-grid">
                <div class="setting-item flag-setting">
                    <label>Позиция RUS X: <span class="value rusX">${settings.rusX}</span></label>
                    <input type="range" class="setting-slider" data-setting="rusX" min="0" max="100" value="${settings.rusX}">
                </div>
                <div class="setting-item flag-setting">
                    <label>Позиция RUS Y: <span class="value rusY">${settings.rusY}</span></label>
                    <input type="range" class="setting-slider" data-setting="rusY" min="0" max="100" value="${settings.rusY}">
                </div>
                <div class="setting-item flag-setting">
                    <label>Позиция флага X: <span class="value flagX">${settings.flagX}</span></label>
                    <input type="range" class="setting-slider" data-setting="flagX" min="0" max="100" value="${settings.flagX}">
                </div>
                <div class="setting-item flag-setting">
                    <label>Позиция флага Y: <span class="value flagY">${settings.flagY}</span></label>
                    <input type="range" class="setting-slider" data-setting="flagY" min="-50" max="50" value="${settings.flagY}">
                </div>
            </div>
        </div>
    
        <div class="settings-group front-side">
            <div class="settings-group-title">
                <span>🔢 Настройки номера</span>
            </div>
            <div class="settings-grid">
                <div class="setting-item">
                    <label>Смещение по Y: <span class="value numberY">${settings.numberY}</span></label>
                    <input type="range" class="setting-slider" data-setting="numberY" min="-50" max="100" value="${settings.numberY}">
                </div>
                <div class="setting-item">
                    <label>Смещение по X: <span class="value numberX">${settings.numberX || 0}</span></label>
                    <input type="range" class="setting-slider" data-setting="numberX" min="-100" max="100" value="${settings.numberX || 0}">
                </div>
                <div class="setting-item">
                    <label>Ширина блока: <span class="value numberAreaWidth">${settings.numberAreaWidth}</span></label>
                    <input type="range" class="setting-slider" data-setting="numberAreaWidth" min="400" max="600" value="${settings.numberAreaWidth}">
                </div>
                <div class="setting-item">
                    <label>Отступы по краям: <span class="value numberPadding">${settings.numberPadding}</span></label>
                    <input type="range" class="setting-slider" data-setting="numberPadding" min="0" max="50" value="${settings.showSideDots ? 0 : 14}">
                </div>
            </div>
        </div>
    
        <div class="settings-group front-side">
            <div class="settings-group-title">
                <span>📍 Настройки региона</span>
            </div>
            <div class="settings-grid">
                <div class="setting-item">
                    <label>Позиция по Y: <span class="value regionY">${settings.regionY}</span></label>
                    <input type="range" class="setting-slider" data-setting="regionY" min="0" max="150" value="${settings.regionY}">
                </div>
                <div class="setting-item">
                    <label>Смещение по X: <span class="value regionX">${settings.regionX || 0}</span></label>
                    <input type="range" class="setting-slider" data-setting="regionX" min="-100" max="100" value="${settings.regionX || 0}">
                </div>
                <div class="setting-item">
                    <label>Ширина блока: <span class="value regionAreaWidth">${settings.regionAreaWidth}</span></label>
                    <input type="range" class="setting-slider" data-setting="regionAreaWidth" min="150" max="300" value="${settings.regionAreaWidth}">
                </div>
            </div>
        </div>
    
        <div class="settings-group front-side">
            <div class="settings-group-title">
                <span>⚙️ Общие настройки</span>
            </div>
            <div class="settings-grid">
               
                <div class="setting-item">
                    <label>Радиус внешних углов: <span class="value mainBorderRadius">${settings.mainBorderRadius}</span></label>
                    <input type="range" class="setting-slider" data-setting="mainBorderRadius" min="0" max="50" value="${settings.mainBorderRadius}">
                </div>
                <div class="setting-item">
                    <label>Радиус внутр. углов: <span class="value innerBorderRadius">${settings.innerBorderRadius}</span></label>
                    <input type="range" class="setting-slider" data-setting="innerBorderRadius" min="0" max="30" value="${settings.innerBorderRadius}">
                </div>
                <div class="setting-item">
                    <label>Отступ от краев: <span class="value margin">${settings.margin}</span></label>
                    <input type="range" class="setting-slider" data-setting="margin" min="0" max="30" value="${settings.margin}">
                </div>
            </div>
        </div>

                     <!-- Настройки для задней стороны -->
                    <div class="settings-group back-side" style="display: none;">
                        <div class="settings-group-title">
                            <span>📝 Настройки текста</span>
                        </div>
                        <div class="settings-grid">
                            <div class="setting-item">
                                <label>Шрифт:</label>
                                <div id="fontSelectorContainer"></div>
                            </div>
                                            <div class="setting-item">
                        <label>Смещение по Y: <span class="value backTextY">${settings.backTextY || 11}</span></label>
                        <input type="range" class="setting-slider" data-setting="backTextY" min="-100" max="100" value="${settings.backTextY || 11}">
                    </div>
                    
                    <div class="setting-item">
                        <label>Отступ от краев: <span class="value backTextPadding">${settings.backTextPadding || 0}</span></label>
                        <input type="range" class="setting-slider" data-setting="backTextPadding" min="0" max="100" value="${settings.backTextPadding || 0}">
                    </div>
                    
                    <div class="setting-item">
                        <label>Межстрочный интервал: <span class="value backTextLineSpacing">${settings.backTextLineSpacing || 1.2}</span></label>
                        <input type="range" class="setting-slider" data-setting="backTextLineSpacing" min="0.8" max="2" step="0.1" value="${settings.backTextLineSpacing || 1.2}">
                    </div>
                    
                    <div class="setting-item">
                        <label>Макс. ширина текста: <span class="value backTextMaxWidth">${settings.backTextMaxWidth || 1.0}</span></label>
                        <input type="range" class="setting-slider" data-setting="backTextMaxWidth" min="0.5" max="1" step="0.05" value="${settings.backTextMaxWidth || 1.0}">
                    </div>
                    <div class="setting-item">
                        <label>Смещение логотипов по Y: <span class="value backLogoY">${settings.backLogoY || 0}</span></label>
                        <input type="range" class="setting-slider" data-setting="backLogoY" min="-50" max="50" value="${settings.backLogoY || 0}">
                    </div>
                <!-- В блоке настроек текста, вместо <select> для выравнивания: -->
                <div class="setting-item">
                    <label>Выравнивание:</label>
                    <div class="align-radio-group">
                        <label class="radio-label">
                            <input type="radio" name="textAlign" value="left" ${settings.backTextAlign === 'left' ? 'checked' : ''}>
                            <span class="radio-custom"></span>
                            <span class="radio-text">⬅️ Лево</span>
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="textAlign" value="center" ${settings.backTextAlign === 'center' ? 'checked' : ''}>
                            <span class="radio-custom"></span>
                            <span class="radio-text">⬆️ Центр</span>
                        </label>
                        <label class="radio-label">
                            <input type="radio" name="textAlign" value="right" ${settings.backTextAlign === 'right' ? 'checked' : ''}>
                            <span class="radio-custom"></span>
                            <span class="radio-text">➡️ Право</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    
        <div class="settings-actions">
    <div class="reset-group">
        <button id="resetFrontSettingsBtn" class="reset-btn" style="display: flex;">🚗 Сбросить настройки номера</button>
        <button id="resetBackSettingsBtn" class="reset-btn" style="display: none;">📝 Сбросить настройки текста</button>
    </div>
    <button id="hideSettingsBtn" class="hide-settings-btn">Скрыть настройки</button>
</div>
    `;
}


/**
 * Обновляет состояние настроек флага
 */
function updateFlagSettings(showFlag) {
    const rusXSetting = document.querySelector('[data-setting="rusX"]').closest('.setting-item');
    const flagXSetting = document.querySelector('[data-setting="flagX"]').closest('.setting-item');
    const rusXSlider = document.querySelector('[data-setting="rusX"]');
    const flagXSlider = document.querySelector('[data-setting="flagX"]');
    const rusXValue = rusXSetting.querySelector('.value');
    const flagXValue = flagXSetting.querySelector('.value');

    if (showFlag) {
        // Флаг включен - RUS X = 14
        settings.rusX = 14;
        rusXSlider.value = 14;
        rusXValue.textContent = 14;

        // flagX активен
        flagXSetting.style.opacity = '1';
        flagXSlider.disabled = false;

        rusXSetting.querySelector('label').innerHTML = 'Позиция RUS X: <span class="value rusX">14</span>';
        flagXSetting.querySelector('label').innerHTML = 'Позиция флага X: <span class="value flagX">' + settings.flagX + '</span>';

    } else {
        // Флаг выключен - RUS X = 48
        settings.rusX = 48;
        rusXSlider.value = 48;
        rusXValue.textContent = 48;

        // flagX отключается
        flagXSetting.style.opacity = '0.5';
        flagXSlider.disabled = true;

        rusXSetting.querySelector('label').innerHTML = 'Позиция RUS X: <span class="value rusX">48</span>';
        flagXSetting.querySelector('label').innerHTML = 'Позиция флага X: <span class="value flagX">' + settings.flagX + '</span> (неактивно)';
    }

    if (drawCallback) drawCallback();
    if (saveCallback) saveCallback();
}
