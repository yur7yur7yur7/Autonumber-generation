// ============================================================
// Стилизация выделенных объектов на fabric.Canvas:
//   • голубая рамка + уголки (#3b82f6),
//   • кастомная иконка поворота (mtr) с tooltip,
//   • десктопные action-кнопки (delete / menu) на рамке,
//   • origin в центре bounding box (поворот вокруг центра).
// Также следит за canvas.on('object:added') — навешивает стиль на
// новые текстбоксы и картинки.
// ============================================================

const SELECTION_BLUE = '#3b82f6';
const HORIZONTAL_PADDING = 12;
const ROTATE_ICON_SIZE = 20;
const ROTATE_HANDLE_OFFSET_Y = -28;

const narrowMql = window.matchMedia('(max-width: 768px), (orientation: landscape) and (max-height: 600px)');
const isMobile = () => narrowMql.matches;

let rotateTooltip = null;
let rotateTooltipObj = null;

function ensureRotateTooltip() {
    if (rotateTooltip) return rotateTooltip;
    const el = document.createElement('div');
    el.id = 'rotate-tooltip';
    el.style.cssText = `
        position: fixed;
        pointer-events: none;
        background: #1f2937;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        font-weight: 600;
        padding: 5px 9px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        transform: translate(14px, -50%);
        white-space: nowrap;
        z-index: 10;
        display: none;
        left: 0;
        top: 0;
    `;
    document.body.appendChild(el);
    rotateTooltip = el;
    return el;
}

function showRotateTooltip(obj, degrees) {
    const tip = ensureRotateTooltip();
    const normalized = ((Math.round(degrees) % 360) + 360) % 360;
    tip.textContent = `${normalized}°`;
    tip.style.display = 'block';
    positionRotateTooltipAtObject(obj);
    rotateTooltipObj = obj;
}

function hideRotateTooltip() {
    if (rotateTooltip) rotateTooltip.style.display = 'none';
    rotateTooltipObj = null;
}

function positionRotateTooltipAtObject(obj) {
    if (!rotateTooltip || !obj) return;
    // Канвас и viewport-transform ищутся через первый попавшийся fabric-canvas
    // на странице (canvas тут — аргумент initSelectionStyle). Достаём его
    // через obj.canvas, чтобы не плодить параметры.
    const canvas = obj.canvas;
    if (!canvas) return;
    const rect = canvas.getElement().getBoundingClientRect();
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform;
    const center = obj.getCenterPoint();
    const visualHeight = obj.height * (obj.scaleY || 1);
    const handleDistance = visualHeight / 2 - ROTATE_HANDLE_OFFSET_Y;
    const angleRad = (obj.angle || 0) * Math.PI / 180;
    const worldX = center.x + Math.sin(angleRad) * handleDistance;
    const worldY = center.y - Math.cos(angleRad) * handleDistance;
    const screenX = rect.left + vpt[4] + worldX * zoom;
    const screenY = rect.top  + vpt[5] + worldY * zoom;
    rotateTooltip.style.left = `${screenX}px`;
    rotateTooltip.style.top  = `${screenY}px`;
}

function applySelectionStyle(tb) {
    tb.set({
        borderColor: SELECTION_BLUE,
        cornerColor: SELECTION_BLUE,
        cornerStrokeColor: SELECTION_BLUE,
        transparentCorners: false,
        cornerSize: 8,
        padding: 0,
        borderScaleFactor: 2
    });
}

function measureTextWidth(tb, text) {
    const probe = document.createElement('canvas').getContext('2d');
    const weight = tb.fontWeight || 'normal';
    const style = tb.fontStyle || 'normal';
    probe.font = `${style} ${weight} ${tb.fontSize}px "${tb.fontFamily || 'Arial'}"`;
    return probe.measureText(text).width;
}

function fitTextboxWidthToContent(tb) {
    // Если пользователь явно зафиксировал ширину (например, через apply
    // конфига), не расширяем textbox до ширины текста — иначе wrap сломается.
    if (tb.__userLockedWidth === true) return;
    const lines = (tb.text || '').split('\n');
    let maxLineWidth = 0;
    for (const line of lines) {
        const w = measureTextWidth(tb, line);
        if (w > maxLineWidth) maxLineWidth = w;
    }
    const newWidth = Math.ceil(maxLineWidth + HORIZONTAL_PADDING * 2);
    if (Math.abs(tb.width - newWidth) > 0.5) {
        tb.set({ width: newWidth });
    }
}

function applyCenterOrigin(tb) {
    if (tb.originX === 'center' && tb.originY === 'center') return;
    const w = tb.width;
    const h = tb.height;
    const centerX = tb.left + w / 2;
    const centerY = tb.top + h / 2;
    tb.set({ originX: 'center', originY: 'center', left: centerX, top: centerY });
    tb.setCoords();
}

function replaceRotateControl(tb, snapAngleEnabled) {
    tb.setControlsVisibility && tb.setControlsVisibility({
        tl: true, tr: true, bl: true, br: true,
        ml: true, mr: true, mt: true, mb: true,
        mtr: true
    });
    tb.controls.mtr = new fabric.Control({
        x: 0,
        y: -0.5,
        offsetY: ROTATE_HANDLE_OFFSET_Y,
        cursorStyle: 'grab',
        actionHandler: fabric.controlsUtils.rotationWithSnapping,
        snapAngle: snapAngleEnabled ? 15 : 0,
        snapThreshold: 15,
        sizeX: 26,
        sizeY: 26,
        mouseUpHandler: function () { return true; },
        render: function (ctx, left, top) {
            const size = ROTATE_ICON_SIZE;
            ctx.save();
            ctx.translate(left, top);
            ctx.beginPath();
            ctx.arc(0, 0, size / 2 + 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.shadowColor = 'rgba(0,0,0,0.35)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 1;
            ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = SELECTION_BLUE;
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            const grad = ctx.createRadialGradient(-size/6, -size/6, size/8, 0, 0, size/2);
            grad.addColorStop(0, '#93c5fd');
            grad.addColorStop(1, '#2563eb');
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.strokeStyle = '#1e3a8a';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.arc(0, 0, size * 0.28, Math.PI * 0.25, Math.PI * 1.5, false);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(size * 0.28 * Math.cos(Math.PI * 0.25), size * 0.28 * Math.sin(Math.PI * 0.25));
            ctx.lineTo(size * 0.28 * Math.cos(Math.PI * 0.25) + 3, size * 0.28 * Math.sin(Math.PI * 0.25) - 1);
            ctx.lineTo(size * 0.28 * Math.cos(Math.PI * 0.25) + 2, size * 0.28 * Math.sin(Math.PI * 0.25) + 3);
            ctx.closePath();
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.restore();
        }
    });
}

function drawDeleteGlyph(ctx, size) {
    const r = size * 0.28;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r, -r); ctx.lineTo(r, r);
    ctx.moveTo(r, -r); ctx.lineTo(-r, r);
    ctx.stroke();
}

function drawMenuGlyph(ctx, size) {
    const r = 1.8;
    const step = size * 0.22;
    ctx.fillStyle = '#ffffff';
    for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(0, i * step, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

function renderActionIcon(ctx, left, top, drawGlyph) {
    const size = ROTATE_ICON_SIZE;
    ctx.save();
    ctx.translate(left, top);
    ctx.beginPath();
    ctx.arc(0, 0, size / 2 + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = SELECTION_BLUE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(-size/6, -size/6, size/8, 0, 0, size/2);
    grad.addColorStop(0, '#93c5fd');
    grad.addColorStop(1, '#2563eb');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#1e3a8a';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawGlyph(ctx, size);
    ctx.restore();
}

function addSelectionActions(tb, onMenuClick) {
    const isActionVisible = !isMobile();
    // shallow-copy controls на уровне инстанса, чтобы fabric.Control не шарился между объектами.
    tb.controls = Object.assign({}, tb.controls);

    tb.controls.delete = new fabric.Control({
        x: 0.55,
        y: -0.5,
        offsetY: -15,
        sizeX: 26,
        sizeY: 26,
        cursorStyle: 'pointer',
        mouseDownHandler: function () {
            const canvas = tb.canvas;
            canvas.remove(tb);
            canvas.requestRenderAll();
        },
        mouseUpHandler: function () { return true; },
        render: function (ctx, left, top) {
            renderActionIcon(ctx, left, top, drawDeleteGlyph);
        }
    });

    tb.controls.menu = new fabric.Control({
        x: -0.55,
        y: -0.5,
        offsetY: -15,
        sizeX: 26,
        sizeY: 26,
        cursorStyle: 'pointer',
        mouseDownHandler: function (eventData) {
            const x = eventData ? eventData.clientX : 0;
            const y = eventData ? eventData.clientY : 0;
            onMenuClick(x, y);
        },
        mouseUpHandler: function () { return true; },
        render: function (ctx, left, top) {
            renderActionIcon(ctx, left, top, drawMenuGlyph);
        }
    });

    tb.setControlsVisibility({
        tl: true, tr: true, bl: true, br: true,
        ml: true, mr: true, mt: true, mb: true,
        mtr: true,
        delete: isActionVisible,
        menu: isActionVisible
    });
}

function styleBaseObject(obj, onMenuClick) {
    if (!obj) return;
    applySelectionStyle(obj);
    replaceRotateControl(obj);
    addSelectionActions(obj, onMenuClick);
    applyCenterOrigin(obj);

    obj.on('rotating', () => showRotateTooltip(obj, obj.angle || 0));
    obj.on('mouseup', () => hideRotateTooltip());
    obj.on('mouseleave', () => hideRotateTooltip());
    obj.on('mouseout', () => hideRotateTooltip());
    obj.on('changed', () => {
        if (obj.originX !== 'center' || obj.originY !== 'center') {
            applyCenterOrigin(obj);
        }
    });
}

function styleTextbox(tb, onMenuClick) {
    if (!tb || tb.type !== 'textbox') return;
    styleBaseObject(tb, onMenuClick);
    const locked = tb.__userLockedWidth === true;
    if (!locked) {
        fitTextboxWidthToContent(tb);
    }
    applyCenterOrigin(tb);
    // Различаем триггеры 'changed':
    //   • правка текста (text:changed) — содержимое поменялось, надо
    //     снять __userLockedWidth и пересчитать ширину под новый текст;
    //   • трансформ (драг/scale) — содержимое НЕ менялось, ширину не трогаем
    //     (пользователь сам её выбрал перетягиванием ручки);
    //   • первый рендер после enlivenObjects — текст ещё не правили, блокировку
    //     сохраняем, иначе fitTextboxWidthToContent пересчитает ширину по
    //     (возможно ещё не загруженному) fallback-шрифту.
    // Сравниваем с предыдущим текстом через closure, чтобы понять intent.
    let lastText = tb.text || '';
    tb.on('changed', () => {
        const currentText = tb.text || '';
        const textChanged = currentText !== lastText;
        lastText = currentText;
        if (!textChanged) return;
        if (tb.__userLockedWidth === true) {
            tb.__userLockedWidth = false;
        }
        fitTextboxWidthToContent(tb);
        if (tb.originX !== 'center' || tb.originY !== 'center') {
            applyCenterOrigin(tb);
        }
    });
}

// Хелпер: вызывается снаружи после добавления объекта на канвас.
export function styleNewObject(obj, onMenuClick) {
    if (!obj) return;
    if (obj.type === 'textbox') {
        styleTextbox(obj, onMenuClick);
    } else if (obj.type === 'image') {
        styleBaseObject(obj, onMenuClick);
    }
}

export function initSelectionStyle(canvas, { onMenuClick, snapState }) {
    function syncSelectionActionsVisibility() {
        const visible = !narrowMql.matches;
        canvas.getObjects().forEach((obj) => {
            if (!obj.controls) return;
            if (!obj.controls.delete || !obj.controls.menu) return;
            obj.setControlsVisibility({
                delete: visible,
                menu: visible
            });
        });
        canvas.requestRenderAll();
    }
    narrowMql.addEventListener('change', syncSelectionActionsVisibility);
    window.addEventListener('resize', syncSelectionActionsVisibility);

    canvas.on('text:editing-exited', (e) => {
        if (e.target) fitTextboxWidthToContent(e.target);
    });
    canvas.on('object:added', (e) => {
        const obj = e.target;
        if (!obj) return;
        if (obj.__guide) return;
        if (obj.type === 'textbox') {
            styleTextbox(obj, onMenuClick);
        } else if (obj.type === 'image') {
            styleBaseObject(obj, onMenuClick);
        }
    });
    canvas.on('selection:cleared', () => hideRotateTooltip());
    canvas.on('before:selection:cleared', () => hideRotateTooltip());
    canvas.on('selection:updated', (e) => {
        hideRotateTooltip();
        if (e.newSelection && e.newSelection.type === 'textbox') {
            replaceRotateControl(e.newSelection, snapState?.angle ?? true);
        }
    });

    return { styleBaseObject, styleTextbox };
}

export function applyAngleSnapToAll(canvas, enabled) {
    canvas.getObjects().forEach((o) => {
        if (o.controls && o.controls.mtr) {
            o.controls.mtr.snapAngle = enabled ? 15 : 0;
            o.controls.mtr.snapThreshold = enabled ? 15 : Infinity;
        }
    });
}