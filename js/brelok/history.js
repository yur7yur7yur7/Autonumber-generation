const HISTORY_LIMIT = 60;
const COMMIT_DELAY_MS = 180;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function stable(value) {
    return JSON.stringify(value);
}

function isUserObject(object) {
    return object && !object.__isFrontRect && !object.__guide && !object.__frameStrip;
}

function getBackSnapshot(canvas) {
    const elements = canvas.getObjects()
        .filter(isUserObject)
        .map((object) => object.toObject());
    const background = window.__backBackground?.get?.() || {
        type: 'color',
        color: '#ffffff'
    };
    return { elements, background };
}

function getFrontSnapshot() {
    return window.__sideToggle?.getFrontSnapshot?.() || {};
}

async function applyBackSnapshot(canvas, snapshot) {
    const userObjects = canvas.getObjects().filter(isUserObject);
    if (userObjects.length) canvas.remove(...userObjects);
    window.__backBackground?.set?.(snapshot.background);

    const elements = Array.isArray(snapshot.elements) ? snapshot.elements : [];
    if (elements.length) {
        await new Promise((resolve) => {
            fabric.util.enlivenObjects(elements, (objects) => {
                objects.filter(Boolean).forEach((object) => {
                    // Preserve user-applied width across undo. The object:added
                    // handler chain re-runs `styleTextbox` → `fitTextboxWidthToContent`
                    // which silently overwrites width to single-line text-content
                    // width — undoing the user's wrap. Same opt-out flag as
                    // `applyBrelokConfig`; cleared automatically on first user edit
                    // (see selection-style.js `styleTextbox` 'changed' handler).
                    if (object && object.type === 'textbox') {
                        object.__userLockedWidth = true;
                    }
                    canvas.add(object);
                });
                resolve();
            }, 'fabric');
        });
    }
    canvas.requestRenderAll();
}

export function initHistory(canvas) {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (!undoBtn || !redoBtn) return null;

    const histories = {
        front: { past: [], present: null, future: [] },
        back: { past: [], present: null, future: [] }
    };
    let applying = false;
    let timer = null;

    function currentSide() {
        return window.__sideToggle?.getCurrentSide?.() === 'back' ? 'back' : 'front';
    }

    function take(side) {
        return side === 'back' ? getBackSnapshot(canvas) : getFrontSnapshot();
    }

    function refresh() {
        const history = histories[currentSide()];
        undoBtn.disabled = history.past.length === 0;
        redoBtn.disabled = history.future.length === 0;
    }

    function seed(side) {
        const snapshot = clone(take(side));
        histories[side].present = snapshot;
        refresh();
    }

    function commit(side = currentSide()) {
        if (applying || !histories[side].present) return;
        const next = clone(take(side));
        const history = histories[side];
        if (stable(next) === stable(history.present)) return;
        history.past.push(history.present);
        if (history.past.length > HISTORY_LIMIT) history.past.shift();
        history.present = next;
        history.future = [];
        refresh();
    }

    function schedule(side = currentSide()) {
        if (applying) return;
        clearTimeout(timer);
        timer = setTimeout(() => commit(side), COMMIT_DELAY_MS);
    }

    async function apply(side, snapshot) {
        applying = true;
        try {
            if (side === 'back') {
                await applyBackSnapshot(canvas, clone(snapshot));
            } else {
                window.__sideToggle?.applyFrontSnapshot?.(clone(snapshot));
            }
        } finally {
            applying = false;
            refresh();
        }
    }

    async function undo() {
        if (applying) return;
        const side = currentSide();
        const history = histories[side];
        commit(side);
        if (!history.past.length) return;
        history.future.push(history.present);
        history.present = history.past.pop();
        await apply(side, history.present);
    }

    async function redo() {
        if (applying) return;
        const side = currentSide();
        const history = histories[side];
        if (!history.future.length) return;
        history.past.push(history.present);
        history.present = history.future.pop();
        await apply(side, history.present);
    }

    canvas.on('object:added', (event) => {
        if (isUserObject(event.target)) schedule('back');
    });
    canvas.on('object:removed', (event) => {
        if (isUserObject(event.target)) schedule('back');
    });
    canvas.on('object:modified', () => schedule('back'));
    canvas.on('text:changed', () => schedule('back'));

    document.addEventListener('input', (event) => {
        if (event.target.closest?.('#snap-panel')) schedule('back');
        if (event.target.closest?.('#front-panel, #front-advanced-panel')
            || event.target.id === 'frontPlateInput') schedule('front');
    });
    document.addEventListener('change', (event) => {
        if (event.target.closest?.('#snap-panel')) schedule('back');
        if (event.target.closest?.('#front-panel, #front-advanced-panel')) schedule('front');
    });

    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    window.addEventListener('keydown', (event) => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
        if (canvas.getActiveObject()?.isEditing) return;
        const key = event.key.toLowerCase();
        const wantsUndo = key === 'z' && !event.shiftKey;
        const wantsRedo = key === 'y' || (key === 'z' && event.shiftKey);
        if (!wantsUndo && !wantsRedo) return;
        event.preventDefault();
        if (wantsRedo) redo();
        else undo();
    });

    const sideObserver = new MutationObserver(refresh);
    const sideLabel = document.getElementById('canvas-label');
    if (sideLabel) sideObserver.observe(sideLabel, {
        attributes: true,
        attributeFilter: ['data-side']
    });

    seed('front');
    seed('back');
    window.__history = { undo, redo, commit, refresh };
    return window.__history;
}
