// ============================================================
// Канал с editor.html: отдаём снимок задней стороны брелка по запросу.
// Если активна передняя сторона — снимок НЕ отдаём.
// ============================================================

export function attachRearChannel() {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('brelok-rear');
    channel.addEventListener('message', async (event) => {
        const data = event.data;
        if (!data || data.type !== 'rear-snapshot-request') return;
        const currentSide = window.__sideToggle?.getCurrentSide?.();
        if (currentSide && currentSide !== 'back') return;
        try {
            const dataURL =
                await window.__sideToggle?.takeHighResRearSnapshot?.();
            if (!dataURL) return;
            channel.postMessage({ type: 'rear-snapshot', dataURL });
        } catch (e) {
            console.warn('Не удалось отдать снимок канвы:', e);
        }
    });
}