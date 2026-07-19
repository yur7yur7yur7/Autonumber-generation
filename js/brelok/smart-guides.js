// ============================================================
// Smart guides: привязка к краям/центрам других объектов и холста
// при перетаскивании. Рисует розовые направляющие (GUIDE_COLOR) и
// подсказку с текстом, что именно за что зацепилось. Состояние
// snapState.position/angle/showHint живёт в этом модуле и читается
// из UI-панели #snap-panel (см. attachSnapPanel).
// ============================================================

const SNAP_THRESHOLD = 6;
const GUIDE_COLOR = '#ff3b6b';

export const snapState = {
    position: true,   // привязка к краям/центрам
    angle: true,      // поворот с шагом 15°
    showHint: false   // текстовая подсказка при snap (по умолчанию выключено)
};

let snapHint = null;
let activeGuides = { x: null, y: null };

function ensureSnapHint() {
    if (snapHint) return snapHint;
    const el = document.createElement('div');
    el.id = 'snap-hint';
    el.style.cssText = `
        position: fixed;
        pointer-events: none;
        background: rgba(31,41,55,0.92);
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 11px;
        font-weight: 600;
        padding: 4px 8px;
        border-radius: 4px;
        white-space: nowrap;
        z-index: 10;
        display: none;
        letter-spacing: 0.2px;
        left: 0;
        top: 0;
    `;
    document.body.appendChild(el);
    snapHint = el;
    return el;
}

function showSnapHint(text, tb) {
    if (snapState.showHint === false) return;
    const h = ensureSnapHint();
    h.textContent = text;
    h.style.display = 'block';
    positionSnapHint(tb);
}

function positionSnapHint(tb) {
    if (!snapHint || !tb) return;
    const canvas = tb.canvas;
    if (!canvas) return;
    const rect = canvas.getElement().getBoundingClientRect();
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform;
    const b = tb.getBoundingRect(true, true);
    const cx = b.left + b.width / 2;
    const topCanvas = b.top - 10;
    const sx = rect.left + vpt[4] + cx * zoom;
    const sy = rect.top + vpt[5] + topCanvas * zoom;
    snapHint.style.left = `${sx}px`;
    snapHint.style.top = `${sy}px`;
    snapHint.style.transform = 'translate(-50%, -100%)';
}

function hideSnapHint() {
    if (snapHint) snapHint.style.display = 'none';
}

export { hideSnapHint };

function clearGuides(canvas) {
    const guideObjs = canvas.getObjects().filter((o) => o.__guide);
    if (guideObjs.length) {
        canvas.remove(...guideObjs);
    }
    activeGuides.x = null;
    activeGuides.y = null;
}

function drawGuideLine(canvas, orientation, value, PLATE_W, PLATE_H) {
    const opts = {
        stroke: GUIDE_COLOR,
        strokeWidth: 1,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        originX: 'center',
        originY: 'center'
    };
    let line;
    if (orientation === 'v') {
        line = new fabric.Line([value, 0, value, PLATE_H], opts);
    } else {
        line = new fabric.Line([0, value, PLATE_W, value], opts);
    }
    line.__guide = true;
    line.__guideOrient = orientation;
    line.__guideValue = value;
    canvas.add(line);
}

export function resnapGuidesToViewport(canvas, PLATE_W, PLATE_H) {
    const guides = canvas.getObjects().filter((o) => o.__guide);
    if (!guides.length) return;
    for (const line of guides) {
        if (line.__guideOrient === 'v' && typeof line.__guideValue === 'number') {
            line.set({ x1: line.__guideValue, y1: 0, x2: line.__guideValue, y2: PLATE_H });
        } else if (line.__guideOrient === 'h' && typeof line.__guideValue === 'number') {
            line.set({ x1: 0, y1: line.__guideValue, x2: PLATE_W, y2: line.__guideValue });
        }
        line.setCoords();
    }
}

function getObjectEdges(obj) {
    const b = obj.getBoundingRect(true, true);
    return {
        left: b.left,
        centerX: b.left + b.width / 2,
        right: b.left + b.width,
        top: b.top,
        centerY: b.top + b.height / 2,
        bottom: b.top + b.height
    };
}

function applySnap(canvas, target, PLATE_W, PLATE_H) {
    if (target.__guide) return false;
    if (target.lockMovementX && target.lockMovementY) return false;

    const t = getObjectEdges(target);
    const candidates = { x: [], y: [] };

    const others = canvas.getObjects().filter((o) => o !== target && !o.__guide);
    const W = canvas.getWidth();
    const H = canvas.getHeight();
    candidates.x.push({ v: 0, label: 'левый край холста' });
    candidates.x.push({ v: W / 2, label: 'центр холста' });
    candidates.x.push({ v: W, label: 'правый край холста' });
    candidates.y.push({ v: 0, label: 'верх холста' });
    candidates.y.push({ v: H / 2, label: 'центр холста' });
    candidates.y.push({ v: H, label: 'низ холста' });

    for (const o of others) {
        const e = getObjectEdges(o);
        candidates.x.push({ v: e.left, label: 'левый край' });
        candidates.x.push({ v: e.centerX, label: 'центр X' });
        candidates.x.push({ v: e.right, label: 'правый край' });
        candidates.y.push({ v: e.top, label: 'верх' });
        candidates.y.push({ v: e.centerY, label: 'центр Y' });
        candidates.y.push({ v: e.bottom, label: 'низ' });
    }

    let newLeft = target.left;
    let newTop = target.top;
    let appliedX = null, appliedY = null;

    const targetXs = [
        { v: t.left, kind: 'left' },
        { v: t.centerX, kind: 'centerX' },
        { v: t.right, kind: 'right' }
    ];
    for (const tx1 of targetXs) {
        let best = null;
        for (const c of candidates.x) {
            const diff = Math.abs(tx1.v - c.v);
            if (diff <= SNAP_THRESHOLD && (!best || diff < best.diff)) {
                best = { v: c.v, diff, label: c.label };
            }
        }
        if (best) {
            if (tx1.kind === 'left') newLeft = target.left + (best.v - t.left);
            else if (tx1.kind === 'centerX') newLeft = target.left + (best.v - t.centerX);
            else if (tx1.kind === 'right') newLeft = target.left + (best.v - t.right);
            appliedX = { value: best.v, targetKind: tx1.kind, candLabel: best.label };
            break;
        }
    }

    const targetYs = [
        { v: t.top, kind: 'top' },
        { v: t.centerY, kind: 'centerY' },
        { v: t.bottom, kind: 'bottom' }
    ];
    for (const ty1 of targetYs) {
        let best = null;
        for (const c of candidates.y) {
            const diff = Math.abs(ty1.v - c.v);
            if (diff <= SNAP_THRESHOLD && (!best || diff < best.diff)) {
                best = { v: c.v, diff, label: c.label };
            }
        }
        if (best) {
            if (ty1.kind === 'top') newTop = target.top + (best.v - t.top);
            else if (ty1.kind === 'centerY') newTop = target.top + (best.v - t.centerY);
            else if (ty1.kind === 'bottom') newTop = target.top + (best.v - t.bottom);
            appliedY = { value: best.v, targetKind: ty1.kind, candLabel: best.label };
            break;
        }
    }

    if (appliedX || appliedY) {
        target.set({ left: newLeft, top: newTop });
        target.setCoords();

        clearGuides(canvas);
        if (appliedX) drawGuideLine(canvas, 'v', appliedX.value, PLATE_W, PLATE_H);
        if (appliedY) drawGuideLine(canvas, 'h', appliedY.value, PLATE_W, PLATE_H);

        const tk = { left: 'левый край', centerX: 'центр X', right: 'правый край',
                     top: 'верх', centerY: 'центр Y', bottom: 'низ' };
        const parts = [];
        if (appliedX) parts.push('↔ ' + tk[appliedX.targetKind] + ' → ' + appliedX.candLabel);
        if (appliedY) parts.push('↕ ' + tk[appliedY.targetKind] + ' → ' + appliedY.candLabel);
        showSnapHint('SNAP: ' + parts.join(' · '), target);
        return true;
    }
    return false;
}

export function attachSmartGuides(canvas, PLATE_W, PLATE_H) {
    canvas.on('object:moving', (e) => {
        const obj = e.target;
        if (!obj || obj.__guide) return;
        if (snapState.position) {
            applySnap(canvas, obj, PLATE_W, PLATE_H);
        } else {
            clearGuides(canvas);
            hideSnapHint();
        }
        if (snapHint && snapHint.style.display !== 'none') {
            positionSnapHint(obj);
        }
    });
    canvas.on('mouse:down', () => {
        hideSnapHint();
        clearGuides(canvas);
    });
    canvas.on('mouse:up', () => {
        clearGuides(canvas);
        hideSnapHint();
    });
    canvas.on('selection:cleared', () => {
        clearGuides(canvas);
        hideSnapHint();
    });
}