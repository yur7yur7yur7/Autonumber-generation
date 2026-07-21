// ============================================================
// Snap-панель: тогглы «Положение» / «Подсказки» + кнопка «Удалить
// выделенное». На мобильных — bottom sheet за гамбургер-кнопкой
// #snap-toggle. Свайп вниз за шапку закрывает.
// Читает/пишет snapState (smart-guides.js) и применяет snap-угла ко
// всем объектам через applyAngleSnapToAll (selection-style.js).
// ============================================================

import { snapState } from './smart-guides.js';
import { applyAngleSnapToAll } from './selection-style.js';
import { setFrameMode } from './clamp-objects.js';

const SWIPE_DOWN_DISMISS_PX = 80;
const SWIPE_DOWN_MAX_LAT = 24;

const DEFAULT_BACKGROUND = {
    type: 'color',
    color: '#ffffff',
    colorStart: '#ffffff',
    colorEnd: '#dbeafe',
    angle: 90
};

const backgroundState = { ...DEFAULT_BACKGROUND };

const SNAP_ICONS = {
    position: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8 V4 H8"/><path d="M20 8 V4 H16"/><path d="M4 16 V20 H8"/><path d="M20 16 V20 H16"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>',
    showHint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5 H20 V16 H12 L8 20 V16 H4 Z"/><circle cx="9" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="1.1" fill="currentColor" stroke="none"/></svg>',
    // Квадратная рамка с обрезанным углом + объект внутри — иллюстрирует
    // режим clamp: объекты остаются внутри плашки.
    frame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" stroke="none"/></svg>'
};

function rowTemplate(label, key, hint) {
    const id = `snap-${key}`;
    const on = snapState[key];
    const icon = SNAP_ICONS[key] || '';
    return `
        <label class="sp-row" for="${id}">
            <span class="sp-icon" aria-hidden="true">${icon}</span>
            <span class="sp-label">
                <b>${label}</b>
                <small>${hint}</small>
            </span>
            <span class="sp-toggle">
                <input type="checkbox" id="${id}" ${on ? 'checked' : ''}/>
                <span class="sp-bg"></span>
                <span class="sp-knob"></span>
            </span>
        </label>
    `;
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
        // Блокируем pull-to-refresh / navigation gesture браузера.
        if (typeof e.preventDefault === 'function') e.preventDefault();
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

function normalizeBackground(value = {}) {
    return {
        type: value.type === 'gradient' ? 'gradient' : 'color',
        color: typeof value.color === 'string' ? value.color : DEFAULT_BACKGROUND.color,
        colorStart: typeof value.colorStart === 'string' ? value.colorStart : DEFAULT_BACKGROUND.colorStart,
        colorEnd: typeof value.colorEnd === 'string' ? value.colorEnd : DEFAULT_BACKGROUND.colorEnd,
        angle: [0, 45, 90, 135].includes(Number(value.angle)) ? Number(value.angle) : DEFAULT_BACKGROUND.angle
    };
}

function makeBackgroundFill(frontRect) {
    if (backgroundState.type !== 'gradient') return backgroundState.color;
    const angle = backgroundState.angle * Math.PI / 180;
    const centerX = frontRect.width / 2;
    const centerY = frontRect.height / 2;
    const halfLength = Math.abs(Math.cos(angle)) * centerX + Math.abs(Math.sin(angle)) * centerY;
    const dx = Math.cos(angle) * halfLength;
    const dy = Math.sin(angle) * halfLength;
    return new fabric.Gradient({
        type: 'linear',
        gradientUnits: 'pixels',
        coords: {
            x1: centerX - dx,
            y1: centerY - dy,
            x2: centerX + dx,
            y2: centerY + dy
        },
        colorStops: [
            { offset: 0, color: backgroundState.colorStart },
            { offset: 1, color: backgroundState.colorEnd }
        ]
    });
}

export function attachSnapPanel(canvas, frontRect) {
    const panel = document.createElement('div');
    panel.id = 'snap-panel';
    panel.innerHTML = `
        <div class="sp-header">⚙ Настройки</div>
        <div class="sp-body">
            <fieldset class="sp-background">
                <legend>Фон</legend>
                <div class="sp-background-modes" role="radiogroup" aria-label="Тип фона">
                    <label><input type="radio" name="background-type" value="color" checked> Цвет</label>
                    <label><input type="radio" name="background-type" value="gradient"> Градиент</label>
                </div>
                <label class="sp-color-row" data-background-control="color">
                    <span>Цвет фона</span>
                    <input id="background-color" type="color" value="#ffffff" aria-label="Цвет фона">
                </label>
                <div class="sp-gradient-controls" hidden>
                    <label class="sp-color-row">
                        <span>Начало</span>
                        <input id="background-color-start" type="color" value="#ffffff" aria-label="Начальный цвет градиента">
                    </label>
                    <label class="sp-color-row">
                        <span>Конец</span>
                        <input id="background-color-end" type="color" value="#dbeafe" aria-label="Конечный цвет градиента">
                    </label>
                    <label class="sp-direction-row">
                        <span>Направление</span>
                        <select id="background-angle" aria-label="Направление градиента">
                            <option value="0">Слева направо</option>
                            <option value="90" selected>Сверху вниз</option>
                            <option value="45">По диагонали ↘</option>
                            <option value="135">По диагонали ↙</option>
                        </select>
                    </label>
                </div>
            </fieldset>
            ${rowTemplate('Границы', 'frame', 'удерживать объекты внутри плашки')}
            ${rowTemplate('Положение', 'position', 'края / центры рамки и других элементов')}
            ${rowTemplate('Подсказки', 'showHint', 'всплывающий текст при срабатывании')}
        </div>
    `;
    document.body.appendChild(panel);
    window.__sideToggle?.syncChromeVisibility?.();

    const snapIsNarrow = () => window.matchMedia('(max-width: 768px), (orientation: landscape) and (max-height: 600px)').matches;
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'snap-toggle';
    toggleBtn.innerHTML = '⚙ Настройки';
    document.body.appendChild(toggleBtn);
    window.__sideToggle?.syncChromeVisibility?.();

    attachSwipeDownToDismiss(panel, '.sp-header', 'sp-open', () => {
        panel.classList.remove('sp-open');
        toggleBtn.textContent = '⚙ Настройки';
    });

    const colorControl = panel.querySelector('[data-background-control="color"]');
    const gradientControls = panel.querySelector('.sp-gradient-controls');
    const colorInput = panel.querySelector('#background-color');
    const colorStartInput = panel.querySelector('#background-color-start');
    const colorEndInput = panel.querySelector('#background-color-end');
    const angleSelect = panel.querySelector('#background-angle');

    function applyBackground() {
        frontRect.set('fill', makeBackgroundFill(frontRect));
        frontRect.setCoords();
        canvas.requestRenderAll();
    }

    function syncBackgroundControls() {
        panel.querySelectorAll('input[name="background-type"]').forEach((input) => {
            input.checked = input.value === backgroundState.type;
        });
        colorInput.value = backgroundState.color;
        colorStartInput.value = backgroundState.colorStart;
        colorEndInput.value = backgroundState.colorEnd;
        angleSelect.value = String(backgroundState.angle);
        const gradientEnabled = backgroundState.type === 'gradient';
        colorControl.hidden = gradientEnabled;
        gradientControls.hidden = !gradientEnabled;
    }

    function setBackground(value) {
        Object.assign(backgroundState, normalizeBackground(value));
        syncBackgroundControls();
        applyBackground();
    }

    panel.querySelectorAll('input[name="background-type"]').forEach((input) => {
        input.addEventListener('change', (event) => {
            if (!event.target.checked) return;
            backgroundState.type = event.target.value;
            syncBackgroundControls();
            applyBackground();
        });
    });
    colorInput.addEventListener('input', (event) => {
        backgroundState.color = event.target.value;
        applyBackground();
    });
    colorStartInput.addEventListener('input', (event) => {
        backgroundState.colorStart = event.target.value;
        applyBackground();
    });
    colorEndInput.addEventListener('input', (event) => {
        backgroundState.colorEnd = event.target.value;
        applyBackground();
    });
    angleSelect.addEventListener('change', (event) => {
        backgroundState.angle = Number(event.target.value);
        applyBackground();
    });

    window.__backBackground = {
        get: () => ({ ...backgroundState }),
        set: setBackground
    };
    syncBackgroundControls();
    applyBackground();

    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('sp-open');
        toggleBtn.textContent = panel.classList.contains('sp-open') ? '✕ Закрыть' : '⚙ Настройки';
    });
    document.addEventListener('click', (e) => {
        if (!snapIsNarrow()) return;
        if (!panel.classList.contains('sp-open')) return;
        if (panel.contains(e.target)) return;
        if (toggleBtn.contains(e.target)) return;
        panel.classList.remove('sp-open');
        toggleBtn.textContent = '⚙ Настройки';
    });

    function refreshPanelToggleUI(key) {
        const cb = document.getElementById(`snap-${key}`);
        if (cb) cb.checked = snapState[key];
    }

    document.getElementById('snap-position').addEventListener('change', (e) => {
        snapState.position = e.target.checked;
        refreshPanelToggleUI('position');
        if (!snapState.position) {
            const guides = canvas.getObjects().filter((o) => o.__guide);
            if (guides.length) canvas.remove(...guides);
        }
    });
    document.getElementById('snap-showHint').addEventListener('change', (e) => {
        snapState.showHint = e.target.checked;
        refreshPanelToggleUI('showHint');
        if (!snapState.showHint) {
            const hint = document.getElementById('snap-hint');
            if (hint) hint.style.display = 'none';
        }
    });
    document.getElementById('snap-frame').addEventListener('change', (e) => {
        snapState.frame = e.target.checked;
        refreshPanelToggleUI('frame');
        // snapState.frame === true → clamp (по умолчанию)
        // snapState.frame === false → cover (рамка поверх всего)
        setFrameMode(canvas, snapState.frame ? 'clamp' : 'cover');
    });

    applyAngleSnapToAll(canvas, snapState.angle);
    setFrameMode(canvas, snapState.frame ? 'clamp' : 'cover');

    // ESC / Delete / Backspace
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const guides = canvas.getObjects().filter((o) => o.__guide);
            if (guides.length) canvas.remove(...guides);
            const hint = document.getElementById('snap-hint');
            if (hint) hint.style.display = 'none';
            return;
        }
        if (e.key !== 'Delete' && e.key !== 'Backspace') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const active = canvas.getActiveObject();
        if (!active) return;
        if (active.isEditing) return;
        e.preventDefault();
        canvas.remove(active);
        canvas.requestRenderAll();
    });

    return { panel, toggleBtn };
}