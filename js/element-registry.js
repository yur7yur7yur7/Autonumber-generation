// ============================================
// РЕЕСТР НАРИСОВАННЫХ ЭЛЕМЕНТОВ
// Хранит позиции и размеры того, что canvas только что отрисовал.
// Нужен, чтобы DOM-overlay мог синхронизировать hit-зоны.
// ============================================

let lastDrawn = [];
let registryDebug = false;
try { registryDebug = localStorage.getItem('overlayDebug') === '1'; } catch (_) {}

export function setLastDrawnElements(elements) {
    lastDrawn = elements;
    if (registryDebug) {
        console.log('[registry] set', elements.length, 'elements:',
            elements.map(e => `${e.type}:${e.index}@(${Math.round(e.canvasX)},${Math.round(e.canvasY)},${Math.round(e.canvasWidth)}x${Math.round(e.canvasHeight)})`).join(' '));
    }
}

export function getLastDrawnElements() {
    return lastDrawn;
}

export function clearLastDrawnElements() {
    if (registryDebug && lastDrawn.length > 0) {
        console.log('[registry] clear (was', lastDrawn.length, 'elements)');
    }
    lastDrawn = [];
}