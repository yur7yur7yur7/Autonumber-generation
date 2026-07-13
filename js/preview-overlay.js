// ============================================
// PREVIEW OVERLAY — drag/resize на превью
// ============================================

import { getLastDrawnElements } from './element-registry.js';

const HANDLE_CORNERS = ['nw', 'ne', 'sw', 'se'];

// === DEBUG LOGGING ===
// Toggle verbose overlay logging with `localStorage.setItem('overlayDebug', '1')` in DevTools,
// then reload the page. All log entries are prefixed with `[overlay]` for easy filtering.
// Covers: setup, rebuild (with element bboxes in canvas-units AND screen-pixels),
// pointerdown (target + selection), pointermove (throttled every 5 events, with
// before/after settings values), pointerup (with commit dump), pointercancel,
// resetGesture (blur/visibility), scheduleDraw (rAF firing), clampHitMove (when it
// actually clamps, with bounds dump), and stray pointermove without pointerState.
// The `[registry]` log in element-registry.js mirrors set/clear calls.
const DEBUG = (() => {
    try { return localStorage.getItem('overlayDebug') === '1'; } catch (_) { return false; }
})();
function dlog(...args) {
    if (DEBUG) console.log('[overlay]', ...args);
}
function dwarn(...args) {
    console.warn('[overlay]', ...args);
}
// === END DEBUG LOGGING ===

let canvas = null;
let overlay = null;
let getSettings = null;
let getCurrentSide = null;
let onCommit = null;

let selectedKey = null;
let pointerState = null;
let announcementEl = null;
const activePointers = new Map();

// Resolve a hit key like 'logo:0' to its logo file name from the registry.
// Used by drag/resize handlers to know which per-logo Map entry to mutate.
function resolveLogoFile(key) {
    const els = getLastDrawnElements() || [];
    const el = els.find(e => `${e.type}:${e.index}` === key);
    return el && el.type === 'logo' ? el.file : null;
}

export function setupPreviewOverlay(opts) {
    canvas = opts.canvas;
    getSettings = opts.getSettings;
    getCurrentSide = opts.getCurrentSide || (() => 'front');
    onCommit = opts.onCommit;
    overlay = document.getElementById('previewOverlay');
    if (!overlay) { dwarn('setup: #previewOverlay not found'); return; }

    dlog('setup: canvas=', canvas && canvas.width, 'x', canvas && canvas.height,
         'overlay client=', overlay.clientWidth, 'x', overlay.clientHeight,
         'initial side=', getCurrentSide());

    ensureLiveRegion();
    overlay.addEventListener('pointerdown', onOverlayPointerDown);
    overlay.addEventListener('pointermove', onOverlayPointerMove);
    overlay.addEventListener('pointerup', onOverlayPointerUp);
    overlay.addEventListener('pointercancel', onOverlayPointerCancel);
    // Window-level pointerup catch-all: if the overlay listener misses the event
    // (e.g. capture was lost because rebuildPreviewOverlay recreated the hit node
    // mid-gesture, or the user released over an element that swallowed the event),
    // the window-level handler still sees the pointerup and commits the gesture.
    // This prevents the "release outside preview → element still drags" bug.
    window.addEventListener('pointerup', onWindowPointerUp, true);
    // Defensive cleanup: if the window loses focus mid-gesture (alt-tab, dialog open,
    // OS-level interruption), the browser may drop the pointerup. Without this guard,
    // pointerState stays alive and any subsequent pointermove on the overlay keeps
    // mutating settings ("ghost drag"). Same if the user releases outside the window.
    window.addEventListener('blur', () => {
        resetGesture('window.blur');
        clearSelection('window.blur');
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            resetGesture('visibilitychange');
            clearSelection('visibilitychange');
        }
    });
    // Mobile orientation change. screen.orientation is the modern API; window.orientation
    // is the legacy one (still used on older iOS Safari).
    function onOrientationChange() {
        dlog('orientationchange: clearing selection');
        resetGesture('orientationchange');
        clearSelection('orientationchange');
    }
    if (window.screen && window.screen.orientation && typeof window.screen.orientation.addEventListener === 'function') {
        window.screen.orientation.addEventListener('change', onOrientationChange);
    } else if ('onorientationchange' in window) {
        window.addEventListener('orientationchange', onOrientationChange);
    }
    // Click/tap on empty space anywhere on the page (outside the overlay and outside
    // any hit) deselects the currently-selected element. The overlay-level pointerdown
    // already handles clicks inside the overlay; this catches clicks elsewhere on the
    // page (e.g., on the empty .preview-area around the canvas, on the page body).
    document.addEventListener('pointerdown', (e) => {
        if (overlay && !overlay.contains(e.target)) {
            clearSelection('document.pointerdown.outside');
        }
    }, true);
    // Rebuild the overlay on scroll/resize so the canvas-to-overlay pixel offset
    // (computed via getBoundingClientRect) stays accurate. Without this, after the
    // user scrolls or the window resizes, the hit-zones drift relative to the canvas
    // and hover/click positions look wrong until the next pointerdown triggers a rebuild.
    function rebuildIfBack() {
        if (getCurrentSide() === 'back') rebuildPreviewOverlay();
    }
    window.addEventListener('scroll', rebuildIfBack, true);
    window.addEventListener('resize', rebuildIfBack);
}

function resetGesture(reason) {
    if (!pointerState) return;
    dlog('resetGesture reason=', reason,
         'clearing activeState=', JSON.stringify({
             mode: pointerState.mode, key: pointerState.key,
             corner: pointerState.corner,
             startClientX: pointerState.startClientX,
             startClientY: pointerState.startClientY,
             startSize: pointerState.startSize
         }));
    activePointers.clear();
    pointerState = null;
}

// Clear the currently selected hit (separate from gesture state). Called when focus is
// lost (orientation change, blur, visibility change) or when the user clicks empty
// space anywhere on the page (document-level pointerdown).
function clearSelection(reason) {
    if (selectedKey === null) return;
    dlog('clearSelection reason=', reason, 'was=', selectedKey);
    selectedKey = null;
    if (overlay && getCurrentSide() === 'back') rebuildPreviewOverlay();
}

export function rebuildPreviewOverlay() {
    if (!overlay || !canvas) return;
    overlay.innerHTML = '';

    const side = getCurrentSide();
    if (side !== 'back') { dlog('rebuild: skip, side=', side); return; }

    const elements = getLastDrawnElements();
    if (!elements || elements.length === 0) { dlog('rebuild: skip, no elements'); return; }

    const displayScale = canvas.clientWidth / canvas.width;
    // Compute the actual canvas top-left in overlay-coordinates. Reading padding
    // from getComputedStyle is fragile (text-align:center shifts the canvas within
    // the content box, borders/scrollbars add more). Bounding rect math is exact:
    // overlayRect.top/left is the overlay's (0,0); canvasRect.top/left is the canvas's
    // pixel position within the same viewport. The difference is the offset that
    // canvas-units must be translated by to land on the right pixel.
    const overlayRect = overlay.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const offsetX = canvasRect.left - overlayRect.left;
    const offsetY = canvasRect.top - overlayRect.top;

    dlog('rebuild: displayScale=', displayScale.toFixed(4),
         'canvasRect=', JSON.stringify({
             left: canvasRect.left.toFixed(1), top: canvasRect.top.toFixed(1),
             w: canvasRect.width.toFixed(1), h: canvasRect.height.toFixed(1)
         }),
         'overlayRect=', JSON.stringify({
             left: overlayRect.left.toFixed(1), top: overlayRect.top.toFixed(1),
             w: overlayRect.width.toFixed(1), h: overlayRect.height.toFixed(1)
         }),
         'offsetX=', offsetX.toFixed(1), 'offsetY=', offsetY.toFixed(1),
         'elements=', elements.length,
         'selectedKey=', selectedKey,
         'pointerState?', pointerState !== null,
         'activePointers.size=', activePointers.size);

    for (const el of elements) {
        const key = `${el.type}:${el.index}`;
        const hit = document.createElement('button');
        hit.type = 'button';
        hit.className = 'preview-overlay__hit';
        hit.dataset.key = key;
        hit.style.left = `${el.canvasX * displayScale + offsetX}px`;
        hit.style.top = `${el.canvasY * displayScale + offsetY}px`;
        hit.style.width = `${el.canvasWidth * displayScale}px`;
        hit.style.height = `${el.canvasHeight * displayScale}px`;

        if (el.type === 'text') {
            hit.setAttribute('aria-label', 'Текст задней стороны. Перетащите для перемещения, щипок для изменения размера.');
        } else {
            hit.setAttribute('aria-label', `Логотип ${el.file}. Перетащите для перемещения, щипок для изменения размера.`);
        }

        if (key === selectedKey) {
            hit.classList.add('is-selected');
            for (const corner of HANDLE_CORNERS) {
                const handle = document.createElement('span');
                handle.className = `preview-overlay__handle preview-overlay__handle--${corner}`;
                handle.dataset.corner = corner;
                handle.setAttribute('role', 'slider');
                handle.setAttribute('aria-label', `Угол ${corner} для изменения размера`);
                handle.tabIndex = -1;
                hit.appendChild(handle);
            }
        }

        dlog('rebuild: hit key=', key,
             'bbox=', JSON.stringify({
                 x: Math.round(el.canvasX), y: Math.round(el.canvasY),
                 w: Math.round(el.canvasWidth), h: Math.round(el.canvasHeight)
             }),
             'screenRect=', JSON.stringify({
                 x: Math.round(el.canvasX * displayScale + offsetX),
                 y: Math.round(el.canvasY * displayScale + offsetY),
                 w: Math.round(el.canvasWidth * displayScale),
                 h: Math.round(el.canvasHeight * displayScale)
             }));

        overlay.appendChild(hit);
    }
}

function onOverlayPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    dlog('pointerdown: id=', e.pointerId, 'type=', e.pointerType,
         'target=', e.target && e.target.className,
         'client=', e.clientX.toFixed(0), e.clientY.toFixed(0));

    const handle = e.target.closest('.preview-overlay__handle');
    if (handle) {
        const hit = handle.closest('.preview-overlay__hit');
        if (!hit) return;
        dlog('pointerdown: handle clicked, key=', hit.dataset.key, 'corner=', handle.dataset.corner);
        startResize(e, hit.dataset.key, handle.dataset.corner);
        return;
    }

    const hit = e.target.closest('.preview-overlay__hit');
    if (hit) {
        dlog('pointerdown: hit clicked, key=', hit.dataset.key,
             'previous selectedKey=', selectedKey);
        selectedKey = hit.dataset.key;
        rebuildPreviewOverlay();
        announceSelection(hit);
        startDrag(e, hit.dataset.key);
        return;
    }

    dlog('pointerdown: empty area, deselecting (was=', selectedKey, ')');
    selectedKey = null;
    rebuildPreviewOverlay();
}

function startDrag(e, key) {
    if (pointerState !== null) {
        dlog('startDrag: REJECTED, gesture already in flight mode=', pointerState.mode,
             'key=', pointerState.key);
        return;
    }
    const hit = overlay.querySelector(`[data-key="${key}"]`);
    if (!hit) { dwarn('startDrag: hit not found for key=', key); return; }
    hit.setPointerCapture(e.pointerId);

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    pointerState = {
        mode: 'drag',
        key,
        startClientX: e.clientX,
        startClientY: e.clientY
    };
    dlog('startDrag: key=', key, 'startClient=', e.clientX.toFixed(0), e.clientY.toFixed(0));
}

function startResize(e, key, corner) {
    if (pointerState !== null) {
        dlog('startResize: REJECTED, gesture already in flight mode=', pointerState.mode,
             'key=', pointerState.key);
        return;
    }
    const hit = overlay.querySelector(`[data-key="${key}"]`);
    if (!hit) { dwarn('startResize: hit not found for key=', key); return; }
    const handle = e.target;
    handle.setPointerCapture(e.pointerId);

    const settings = getSettings();
    let startSize;
    if (key === 'text:-1') {
        const textSizeInput = document.getElementById('textSize');
        startSize = parseFloat(textSizeInput.value) || 63;
    } else {
        // Per-logo size: pos.size, falling back to global backLogoSize, then 1.0.
        const file = resolveLogoFile(key);
        if (file && settings.backLogoPositions && settings.backLogoPositions[file]
                && typeof settings.backLogoPositions[file].size === 'number') {
            startSize = settings.backLogoPositions[file].size;
        } else {
            startSize = settings.backLogoSize || 1.0;
        }
    }

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    let startDistance = null;
    if (activePointers.size === 2) {
        const points = Array.from(activePointers.values());
        startDistance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    }

    pointerState = {
        mode: 'resize',
        key,
        corner,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startSize,
        startDistance
    };
    dlog('startResize: key=', key, 'corner=', corner,
         'startSize=', startSize, 'startDistance=', startDistance,
         'startClient=', e.clientX.toFixed(0), e.clientY.toFixed(0));
}

// Допуск, на который рамка выделения может выходить за края превью (в canvas-юнитах).
// ≈3мм на печатной пластине — этого хватает для мобильного overscroll без прыжков
// по соседним элементам страницы.
const CANVAS_WIDTH_DEFAULT = 1224;
const BOUNDS_SLACK = 12; // canvas units (≈ 3mm at print scale)

// Clamp drag delta so the hit-zone stays inside the inner preview rect (with SLACK).
// Looks up the hit's current bounding box from the registry; if missing, no clamp.
function clampHitMove(key, dx, dy) {
    if (!canvas) { dlog('clamp: no canvas'); return { dx, dy }; }
    const els = getLastDrawnElements() || [];
    const el = els.find(e => `${e.type}:${e.index}` === key);
    if (!el) { dlog('clamp: key=', key, 'not found in registry, returning raw dx/dy'); return { dx, dy }; }

    const SF = canvas.width / CANVAS_WIDTH_DEFAULT;
    const settings = getSettings();
    const margin = (settings.margin || 0) * SF;
    const innerX = margin;
    const innerY = margin;
    const innerWidth = canvas.width - margin * 2;
    const innerHeight = canvas.height - margin * 2;

    const newLeft = el.canvasX + dx;
    const newRight = newLeft + el.canvasWidth;
    const newTop = el.canvasY + dy;
    const newBottom = newTop + el.canvasHeight;

    const minLeft = innerX - BOUNDS_SLACK;
    const maxRight = innerX + innerWidth + BOUNDS_SLACK;
    const minTop = innerY - BOUNDS_SLACK;
    const maxBottom = innerY + innerHeight + BOUNDS_SLACK;

    let clampedDx = dx;
    let clampedDy = dy;
    if (newLeft < minLeft) clampedDx += minLeft - newLeft;
    else if (newRight > maxRight) clampedDx -= newRight - maxRight;

    if (newTop < minTop) clampedDy += minTop - newTop;
    else if (newBottom > maxBottom) clampedDy -= newBottom - maxBottom;

    if (clampedDx !== dx || clampedDy !== dy) {
        dlog('clamp: key=', key,
             'in dx/dy=', dx.toFixed(2), dy.toFixed(2),
             'out dx/dy=', clampedDx.toFixed(2), clampedDy.toFixed(2),
             'el bbox=', JSON.stringify({l: Math.round(el.canvasX), t: Math.round(el.canvasY), w: Math.round(el.canvasWidth), h: Math.round(el.canvasHeight)}),
             'bounds=', JSON.stringify({l: Math.round(minLeft), t: Math.round(minTop), r: Math.round(maxRight), b: Math.round(maxBottom)}));
    }

    return { dx: clampedDx, dy: clampedDy };
}

function onOverlayPointerMove(e) {
    if (!pointerState) {
        // No active gesture but pointermove fired — usually means the previous
        // pointerup was missed (browser dropped it) or pointerState was already nulled
        // but the browser is still firing moves for a held pointer.
        if (DEBUG) {
            dlog('pointermove: STRAY (no pointerState, ignoring) id=', e.pointerId,
                 'activePointers.size=', activePointers.size,
                 'selectedKey=', selectedKey);
        }
        return;
    }
    e.preventDefault();

    const displayScale = canvas.clientWidth / canvas.width;
    let dxCanvas = (e.clientX - pointerState.startClientX) / displayScale;
    let dyCanvas = (e.clientY - pointerState.startClientY) / displayScale;

    const settings = getSettings();

    if (pointerState.mode === 'drag') {
        // Decoupled rendering: text drag mutates backTextX/Y only. Logo drag mutates
        // per-logo backLogoPositions[file].x/y in the Map. linkLogosToText compensation
        // removed — logos never follow text now.

        if (pointerState.key === 'text:-1') {
            const beforeX = settings.backTextX || 0;
            const beforeY = settings.backTextY || 0;
            const clamped = clampHitMove('text:-1', dxCanvas, dyCanvas);
            dxCanvas = clamped.dx;
            dyCanvas = clamped.dy;
            settings.backTextX = beforeX + dxCanvas;
            settings.backTextY = beforeY + dyCanvas;
        } else {
            const clamped = clampHitMove(pointerState.key, dxCanvas, dyCanvas);
            dxCanvas = clamped.dx;
            dyCanvas = clamped.dy;
            const file = resolveLogoFile(pointerState.key);
            if (file) {
                if (!settings.backLogoPositions) settings.backLogoPositions = {};
                const pos = settings.backLogoPositions[file] || { x: 0, y: 0 };
                pos.x += dxCanvas;
                pos.y += dyCanvas;
                settings.backLogoPositions[file] = pos;
            }
        }
        pointerState.startClientX = e.clientX;
        pointerState.startClientY = e.clientY;
        scheduleDraw();

        // Throttled logging: only every 5th move event to avoid console flood.
        moveLogCounter++;
        if (moveLogCounter % 5 === 1) {
            const file = pointerState.key === 'text:-1' ? null : resolveLogoFile(pointerState.key);
            const afterX = pointerState.key === 'text:-1'
                ? settings.backTextX
                : (file && settings.backLogoPositions && settings.backLogoPositions[file]
                    ? settings.backLogoPositions[file].x : 0);
            const afterY = pointerState.key === 'text:-1'
                ? settings.backTextY
                : (file && settings.backLogoPositions && settings.backLogoPositions[file]
                    ? settings.backLogoPositions[file].y : 0);
            dlog('pointermove drag: key=', pointerState.key, 'file=', file,
                 'canvasDelta=', dxCanvas.toFixed(2), dyCanvas.toFixed(2),
                 'displayScale=', displayScale.toFixed(4),
                 'after=', afterX.toFixed(2), afterY.toFixed(2),
                 'activePointers=', activePointers.size);
        }
    } else if (pointerState.mode === 'resize') {
        const pinchRatio = computePinchRatio(e);
        if (pinchRatio != null) {
            const beforeSize = pointerState.key === 'text:-1'
                ? parseFloat(document.getElementById('textSize').value) || 63
                : (resolveLogoFile(pointerState.key)
                    ? (settings.backLogoPositions[resolveLogoFile(pointerState.key)] || {}).size || settings.backLogoSize || 1.0
                    : settings.backLogoSize || 1.0);
            if (pointerState.key === 'text:-1') {
                const textSizeInput = document.getElementById('textSize');
                const textSizeValue = document.getElementById('textSizeValue');
                const newSize = Math.max(20, Math.min(200, pointerState.startSize * pinchRatio));
                textSizeInput.value = newSize;
                if (textSizeValue) textSizeValue.textContent = newSize;
                textSizeInput.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
                const newSize = Math.max(0.3, Math.min(3.0, pointerState.startSize * pinchRatio));
                const file = resolveLogoFile(pointerState.key);
                if (file) {
                    if (!settings.backLogoPositions) settings.backLogoPositions = {};
                    if (!settings.backLogoPositions[file]) settings.backLogoPositions[file] = { x: 0, y: 0 };
                    settings.backLogoPositions[file].size = newSize;
                }
            }
            scheduleDraw();
            moveLogCounter++;
            if (moveLogCounter % 5 === 1) {
                dlog('pointermove resize/pinch: key=', pointerState.key,
                     'ratio=', pinchRatio.toFixed(3),
                     'startSize=', pointerState.startSize,
                     'before=', beforeSize,
                     'after=', pointerState.key === 'text:-1'
                         ? parseFloat(document.getElementById('textSize').value)
                         : settings.backLogoSize);
            }
            return;
        }

        // Desktop corner-handle math (single-pointer fallback).
        const corner = pointerState.corner;
        const dx = e.clientX - pointerState.startClientX;
        const dy = e.clientY - pointerState.startClientY;

        // For each corner, project the gesture onto its outward axis and take the
        // dominant motion. Sign convention: +x = right, +y = down (screen coords).
        // Sensitivity: 200px of projected travel = 1× ratio change.
        let delta;
        if (corner === 'se') {
            delta = Math.max(dx, dy);     // bottom-left anchor: right or down grows
        } else if (corner === 'ne') {
            delta = Math.max(dx, -dy);    // top-left anchor: right or up grows
        } else if (corner === 'sw') {
            delta = Math.max(-dx, dy);    // top-right anchor: left or down grows
        } else { // nw
            delta = Math.max(-dx, -dy);   // bottom-right anchor: left or up grows
        }
        const ratio = Math.max(0.5, Math.min(2.0, 1 + delta / 200));

        if (pointerState.key === 'text:-1') {
            const textSizeInput = document.getElementById('textSize');
            const textSizeValue = document.getElementById('textSizeValue');
            const newSize = Math.max(20, Math.min(200, pointerState.startSize * ratio));
            textSizeInput.value = newSize;
            if (textSizeValue) textSizeValue.textContent = newSize;
            textSizeInput.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            const newSize = Math.max(0.3, Math.min(3.0, pointerState.startSize * ratio));
            const file = resolveLogoFile(pointerState.key);
            if (file) {
                if (!settings.backLogoPositions) settings.backLogoPositions = {};
                if (!settings.backLogoPositions[file]) settings.backLogoPositions[file] = { x: 0, y: 0 };
                settings.backLogoPositions[file].size = newSize;
            }
        }
        scheduleDraw();
        moveLogCounter++;
        if (moveLogCounter % 5 === 1) {
            dlog('pointermove resize/desktop: corner=', corner,
                 'dx/dy=', dx.toFixed(1), dy.toFixed(1),
                 'ratio=', ratio.toFixed(3));
        }
    }
}

function computePinchRatio(e) {
    if (!pointerState || pointerState.startDistance == null) return null;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size < 2) return null;

    const points = Array.from(activePointers.values());
    const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    if (pointerState.startDistance < 1) return null;
    return dist / pointerState.startDistance;
}

function onOverlayPointerUp(e) {
    const sizeBeforeDelete = activePointers.size;
    activePointers.delete(e.pointerId);

    // Try to release capture on whichever element has it (best effort — may throw).
    let releaseErr = null;
    try { e.target.releasePointerCapture(e.pointerId); } catch (err) { releaseErr = err.message; }

    dlog('pointerup: id=', e.pointerId,
         'activePointers before=', sizeBeforeDelete, 'after=', activePointers.size,
         'pointerState?', pointerState !== null,
         'releaseErr=', releaseErr);

    // Per spec S7: any pointer lift ends the gesture. We commit on the first lift
    // (not the last), so releasing one of two pinch fingers commits immediately
    // rather than continuing a half-broken gesture with the remaining finger.
    if (pointerState) {
        const settings = getSettings();
        dlog('pointerup COMMIT: mode=', pointerState.mode, 'key=', pointerState.key,
             'settings=', JSON.stringify({
                 backTextX: settings.backTextX,
                 backTextY: settings.backTextY,
                 backLogoPositions: settings.backLogoPositions,
                 backLogoSize: settings.backLogoSize
             }));
        if (onCommit) onCommit();
        pointerState = null;
    }
}

function onOverlayPointerCancel(e) {
    dlog('pointercancel: id=', e.pointerId);
    activePointers.delete(e.pointerId);
    pointerState = null;
}

// Window-level pointerup catch-all. Fires in addition to (or instead of, when capture
// is lost) the overlay listener. Only does work if a gesture is still active — the
// pointerState null-check makes it idempotent so duplicate fires from both listeners
// don't double-commit or double-clear.
function onWindowPointerUp(e) {
    if (!pointerState) return;
    // Only commit if the lifted pointerId is one we tracked in the gesture.
    if (activePointers.has(e.pointerId)) {
        activePointers.delete(e.pointerId);
    }
    dlog('window pointerup: id=', e.pointerId,
         'activePointers after=', activePointers.size,
         'pointerState?', pointerState !== null);
    if (pointerState) {
        const settings = getSettings();
        dlog('window pointerup COMMIT: mode=', pointerState.mode, 'key=', pointerState.key,
             'settings=', JSON.stringify({
                 backTextX: settings.backTextX,
                 backTextY: settings.backTextY,
                 backLogoPositions: settings.backLogoPositions,
                 backLogoSize: settings.backLogoSize
             }));
        if (onCommit) onCommit();
        pointerState = null;
    }
}

let drawScheduled = false;
let moveLogCounter = 0;
function scheduleDraw() {
    if (drawScheduled) return;
    drawScheduled = true;
    requestAnimationFrame(() => {
        drawScheduled = false;
        dlog('scheduleDraw: rAF firing, calling window.drawPlate');
        if (window.drawPlate) window.drawPlate();
        else dwarn('scheduleDraw: window.drawPlate missing — overlay cannot trigger redraws');
    });
}

function ensureLiveRegion() {
    if (announcementEl) return;
    announcementEl = document.createElement('div');
    announcementEl.setAttribute('aria-live', 'polite');
    announcementEl.style.position = 'absolute';
    announcementEl.style.left = '-9999px';
    document.body.appendChild(announcementEl);
}

function announceSelection(hit) {
    if (!announcementEl) return;
    announcementEl.textContent = hit.getAttribute('aria-label') || 'Элемент выбран';
}