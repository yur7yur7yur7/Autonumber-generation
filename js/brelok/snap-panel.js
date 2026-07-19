// ============================================================
// Snap-панель: тогглы «Положение» / «Подсказки» + кнопка «Удалить
// выделенное». На мобильных — bottom sheet за гамбургер-кнопкой
// #snap-toggle. Свайп вниз за шапку закрывает.
// Читает/пишет snapState (smart-guides.js) и применяет snap-угла ко
// всем объектам через applyAngleSnapToAll (selection-style.js).
// ============================================================

import { snapState } from './smart-guides.js';
import { applyAngleSnapToAll } from './selection-style.js';

const SWIPE_DOWN_DISMISS_PX = 80;
const SWIPE_DOWN_MAX_LAT = 24;

const SNAP_ICONS = {
    position: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8 V4 H8"/><path d="M20 8 V4 H16"/><path d="M4 16 V20 H8"/><path d="M20 16 V20 H16"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>',
    showHint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5 H20 V16 H12 L8 20 V16 H4 Z"/><circle cx="9" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="1.1" fill="currentColor" stroke="none"/></svg>'
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

export function attachSnapPanel(canvas) {
    const panel = document.createElement('div');
    panel.id = 'snap-panel';
    panel.innerHTML = `
        <div class="sp-header">⚙ Настройки</div>
        <div class="sp-body">
            ${rowTemplate('Положение', 'position', 'края / центры рамки и других элементов')}
            ${rowTemplate('Подсказки', 'showHint', 'всплывающий текст при срабатывании')}
            <button class="sp-delete" type="button" disabled>🗑 Удалить выделенное</button>
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

    const deleteBtn = panel.querySelector('.sp-delete');
    const refreshDeleteState = () => {
        if (!deleteBtn) return;
        deleteBtn.disabled = !canvas.getActiveObject();
    };
    deleteBtn.addEventListener('click', () => {
        const active = canvas.getActiveObject();
        if (!active) return;
        canvas.remove(active);
        canvas.requestRenderAll();
        refreshDeleteState();
    });
    canvas.on('selection:created', refreshDeleteState);
    canvas.on('selection:updated', refreshDeleteState);
    canvas.on('selection:cleared', refreshDeleteState);
    canvas.on('object:removed', refreshDeleteState);

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

    applyAngleSnapToAll(canvas, snapState.angle);

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