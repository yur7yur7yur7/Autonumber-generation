// ============================================================
// Контекстное меню долгого нажатия / правого клика по объектам
// на канвасе. Только для активного объекта: delete, change color
// (только для текстбоксов), reset rotation. На десктопе то же меню
// открывается по правому клику мыши по канвасу.
// ============================================================

const LONG_PRESS_MS = 600;
const LONG_PRESS_MOVE_TOLERANCE = 12;
const MTR_HIT_RADIUS_SQ = 14 * 14;

const isNarrow = () => window.matchMedia('(max-width: 768px), (orientation: landscape) and (max-height: 600px)').matches;

let longPressTimer = null;
let longPressStart = null;

export function initContextMenu(canvas) {
    const ctxMenu = document.getElementById('ctx-menu');
    const ctxDeleteBtn = ctxMenu?.querySelector('[data-action="delete"]');
    const ctxColorLabel = ctxMenu?.querySelector('[data-action="color"]');
    const ctxColorInput = document.getElementById('ctx-color-input');
    const ctxColorSwatch = document.getElementById('ctx-color-swatch');
    const ctxRotateZeroBtn = ctxMenu?.querySelector('[data-action="rotate-zero"]');

    if (!ctxMenu) return;

    function hideContextMenu() {
        if (ctxMenu.contains(document.activeElement)) {
            document.activeElement.blur();
        }
        ctxMenu.classList.remove('cm-show');
        ctxMenu.setAttribute('aria-hidden', 'true');
    }

    function showContextMenu(x, y) {
        const active = canvas.getActiveObject();
        if (!active) {
            hideContextMenu();
            return;
        }
        const isText = active.type === 'textbox';
        ctxDeleteBtn.disabled = false;
        if (ctxColorLabel) {
            ctxColorLabel.style.display = isText ? 'flex' : 'none';
        }
        if (isText) {
            const color = (active.fill && typeof active.fill === 'string') ? active.fill : '#111111';
            if (ctxColorSwatch) ctxColorSwatch.style.background = color;
            if (ctxColorInput) ctxColorInput.value = color;
        }
        if (ctxRotateZeroBtn) {
            const ANGLE_EPS = 0.01;
            const currentAngle = active.angle ?? 0;
            const isAlreadyZero = Math.abs(((currentAngle % 360) + 360) % 360) < ANGLE_EPS;
            ctxRotateZeroBtn.disabled = isAlreadyZero;
        }
        ctxMenu.classList.add('cm-show');
        ctxMenu.setAttribute('aria-hidden', 'false');
        const w = ctxMenu.offsetWidth;
        const h = ctxMenu.offsetHeight;
        const left = Math.max(8, Math.min(x, window.innerWidth - w - 8));
        const top = Math.max(8, Math.min(y, window.innerHeight - h - 8));
        ctxMenu.style.left = `${left}px`;
        ctxMenu.style.top = `${top}px`;
    }

    // Хук для других модулей (selection-style menu-button).
    window.__showContextMenu = (x, y) => showContextMenu(x, y);

    function clearLongPress() {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        longPressStart = null;
    }

    // Попадает ли точка (в scene-space канваса) в круглую иконку поворота (mtr).
    function isPointOnRotateControl(point) {
        const objects = canvas.getObjects();
        for (let i = 0; i < objects.length; i++) {
            const obj = objects[i];
            if (!obj || !obj.visible || obj.__guide) continue;
            if (!obj.controls || !obj.controls.mtr) continue;
            const mtr = obj.controls.mtr;
            if (mtr.x === undefined || mtr.y === undefined) continue;
            const halfH = obj.height / 2;
            const lx = mtr.x * halfH + (mtr.offsetX || 0);
            const ly = mtr.y * obj.height + (mtr.offsetY || 0);
            const localPt = { x: lx, y: ly };
            const worldPt = fabric.util.transformPoint(localPt, obj.calcTransformMatrix());
            const dx = point.x - worldPt.x;
            const dy = point.y - worldPt.y;
            if (dx * dx + dy * dy <= MTR_HIT_RADIUS_SQ) return true;
        }
        return false;
    }

    function startLongPress(event) {
        if (!isNarrow()) return;
        if (event.pointerType && event.pointerType !== 'touch') return;
        const target = canvas.findTarget(event);
        if (!target || target.__guide) return;
        if (target.__corner === 'mtr') return;
        const pointer = canvas.getPointer(event);
        if (isPointOnRotateControl(pointer)) return;
        longPressStart = { x: event.clientX, y: event.clientY };
        longPressTimer = setTimeout(() => {
            longPressTimer = null;
            const active = canvas.getActiveObject() || target;
            canvas.setActiveObject(active);
            canvas.requestRenderAll();
            showContextMenu(event.clientX, event.clientY);
        }, LONG_PRESS_MS);
    }

    function trackLongPress(event) {
        if (!longPressStart) return;
        const dx = event.clientX - longPressStart.x;
        const dy = event.clientY - longPressStart.y;
        if (dx * dx + dy * dy > LONG_PRESS_MOVE_TOLERANCE * LONG_PRESS_MOVE_TOLERANCE) {
            clearLongPress();
        }
    }

    function endLongPress() {
        clearLongPress();
    }

    const canvasEl = canvas.upperCanvasEl || document.querySelector('canvas.upper-canvas') || canvas.getElement();
    canvasEl.addEventListener('pointerdown', startLongPress);
    canvasEl.addEventListener('pointermove', trackLongPress);
    canvasEl.addEventListener('pointerup', endLongPress);
    canvasEl.addEventListener('pointercancel', endLongPress);
    canvasEl.addEventListener('pointerleave', endLongPress);

    // ПКМ по канвасу — то же меню.
    function onCanvasPointerDown(event) {
        if (event.button !== 2) return;
        const target = canvas.findTarget(event);
        if (target && target.__corner === 'mtr') return;
        if (target && isPointOnRotateControl(canvas.getPointer(event))) return;
        if (!target || target.__guide) {
            hideContextMenu();
            return;
        }
        const active = canvas.getActiveObject() || target;
        canvas.setActiveObject(active);
        canvas.requestRenderAll();
        hideContextMenu();
        showContextMenu(event.clientX, event.clientY);
    }

    function onCanvasContextMenu(event) {
        if (!canvasEl.contains(event.target)) return;
        event.preventDefault();
    }

    canvasEl.addEventListener('pointerdown', onCanvasPointerDown);
    canvasEl.addEventListener('contextmenu', onCanvasContextMenu);

    ctxDeleteBtn?.addEventListener('click', () => {
        const active = canvas.getActiveObject();
        if (active) {
            canvas.remove(active);
            canvas.requestRenderAll();
        }
        hideContextMenu();
    });
    ctxColorInput?.addEventListener('input', () => {
        const active = canvas.getActiveObject();
        if (!active || active.type !== 'textbox') return;
        active.set({ fill: ctxColorInput.value });
        active.dirty = true;
        canvas.requestRenderAll();
        if (ctxColorSwatch) ctxColorSwatch.style.background = ctxColorInput.value;
    });
    ctxColorLabel?.addEventListener('click', () => ctxColorInput?.click());
    ctxRotateZeroBtn?.addEventListener('click', () => {
        const active = canvas.getActiveObject();
        if (!active) return;
        active.set({ angle: 0 });
        active.setCoords();
        canvas.requestRenderAll();
        hideContextMenu();
    });

    document.addEventListener('pointerdown', (e) => {
        if (!ctxMenu.classList.contains('cm-show')) return;
        if (ctxMenu.contains(e.target)) return;
        hideContextMenu();
    });
    window.addEventListener('resize', hideContextMenu);
    window.addEventListener('orientationchange', hideContextMenu);
    window.addEventListener('scroll', hideContextMenu, true);
    canvas.on('selection:cleared', hideContextMenu);
    canvas.on('object:removed', hideContextMenu);
}