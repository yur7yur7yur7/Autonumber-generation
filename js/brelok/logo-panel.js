// ============================================================
// Панель логотипов: загружает манифест images/logos/manifest.json,
// рендерит сетку по брендам, поиск + фильтр (Все/Значки/С надп.).
// Тапаешь по лого — добавляется как fabric.Image в центр сцены
// (50% от высоты плиты по короткой стороне). На мобильных — bottom
// sheet за гамбургер-кнопкой #logo-toggle, свайп вниз закрывает.
// ============================================================

const FRACTION_OF_HEIGHT = 0.5;
const SWIPE_DOWN_DISMISS_PX = 80;
const SWIPE_DOWN_MAX_LAT = 24;

let logoManifest = [];

function stackLogosBelowTextboxes(canvas, frontRect) {
    const objs = canvas.getObjects().slice();
    const isTextbox = (o) => o && o.type === 'textbox';
    const textboxes = objs.filter(isTextbox);
    const middle = objs.filter((o) => !isTextbox(o) && o !== frontRect);
    const bottom = frontRect && objs.includes(frontRect) ? [frontRect] : [];
    const ordered = [...bottom, ...middle, ...textboxes];
    ordered.forEach((o, i) => canvas.moveTo(o, i));
    canvas.requestRenderAll();
}

function addLogoFromManifest(canvas, logo, PLATE_W, PLATE_H, frontRect) {
    fabric.Image.fromURL(`images/logos/${logo.file}`, (img) => {
        if (!img) {
            console.warn('Не удалось загрузить логотип:', logo.file);
            return;
        }
        const targetH = Math.round(FRACTION_OF_HEIGHT * PLATE_H);
        const aspect = img.width / img.height;
        const h = targetH;
        const w = Math.round(h * aspect);
        const scale = w / img.width;

        img.set({
            left: canvas.getWidth() / 2,
            top: canvas.getHeight() / 2,
            originX: 'center',
            originY: 'center',
            scaleX: scale,
            scaleY: scale
        });
        canvas.add(img);
        stackLogosBelowTextboxes(canvas, frontRect);
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
    }, { crossOrigin: 'anonymous' });
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

export async function initLogoPanel(canvas, PLATE_W, PLATE_H, frontRect) {
    const panel = document.createElement('div');
    panel.id = 'logo-panel';
    panel.innerHTML = `
        <div class="lp-header">🏭 Логотипы</div>
        <div class="lp-search">
            <input type="text" placeholder="🔍 Поиск по бренду..." autocomplete="off">
        </div>
        <div class="lp-filters">
            <button class="lp-filter-btn active" data-filter="all">Все</button>
            <button class="lp-filter-btn" data-filter="badge">Значки</button>
            <button class="lp-filter-btn" data-filter="text">С надп.</button>
        </div>
        <div class="lp-grid">
            <div class="lp-loading">⏳ Загрузка манифеста…</div>
        </div>
    `;
    document.body.appendChild(panel);
    window.__sideToggle?.syncChromeVisibility?.();

    const isNarrow = () => window.matchMedia('(max-width: 768px), (orientation: landscape) and (max-height: 600px)').matches;
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'logo-toggle';
    toggleBtn.innerHTML = '☰ Логотипы';
    document.body.appendChild(toggleBtn);
    window.__sideToggle?.syncChromeVisibility?.();

    toggleBtn.addEventListener('click', () => {
        panel.classList.toggle('lp-open');
        toggleBtn.textContent = panel.classList.contains('lp-open') ? '✕ Закрыть' : '☰ Логотипы';
    });
    document.addEventListener('click', (e) => {
        if (!isNarrow()) return;
        if (!panel.classList.contains('lp-open')) return;
        if (panel.contains(e.target)) return;
        if (toggleBtn.contains(e.target)) return;
        panel.classList.remove('lp-open');
        toggleBtn.textContent = '☰ Логотипы';
    });

    attachSwipeDownToDismiss(panel, '.lp-header', 'lp-open', () => {
        panel.classList.remove('lp-open');
        toggleBtn.textContent = '☰ Логотипы';
    });

    const grid = panel.querySelector('.lp-grid');
    const searchInput = panel.querySelector('.lp-search input');
    const filterBtns = panel.querySelectorAll('.lp-filter-btn');

    let currentFilter = 'all';
    let searchQuery = '';

    const renderGrid = () => {
        let items = [...logoManifest];
        if (currentFilter !== 'all') {
            items = items.filter((l) => l.type === currentFilter);
        }
        const q = searchQuery.toLowerCase();
        if (q) {
            items = items.filter((l) =>
                (l.brand || '').toLowerCase().includes(q) ||
                (l.label || '').toLowerCase().includes(q)
            );
        }

        if (items.length === 0) {
            grid.innerHTML = '<div class="lp-empty">Ничего не найдено</div>';
            return;
        }

        const grouped = {};
        items.forEach((l) => {
            if (!grouped[l.brand]) grouped[l.brand] = [];
            grouped[l.brand].push(l);
        });
        const brands = Object.keys(grouped).sort();

        grid.innerHTML = '';
        brands.forEach((brand) => {
            const groupTitle = document.createElement('div');
            groupTitle.className = 'lp-brand-title';
            groupTitle.textContent = brand.toUpperCase();
            grid.appendChild(groupTitle);

            const brandGrid = document.createElement('div');
            brandGrid.className = 'lp-brand-grid';

            grouped[brand].forEach((logo) => {
                const btn = document.createElement('button');
                btn.className = 'lp-logo-btn';
                btn.title = logo.label;
                btn.dataset.file = logo.file;

                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.src = `images/logos/${logo.file}`;
                img.onload = () => {
                    const c = document.createElement('canvas');
                    c.width = 128;
                    c.height = 128;
                    const cx = c.getContext('2d');
                    const aspect = img.width / img.height;
                    let dw = 112, dh = 112;
                    if (aspect > 1) dh = 112 / aspect;
                    else dw = 112 * aspect;
                    cx.clearRect(0, 0, 128, 128);
                    cx.drawImage(img, (128 - dw) / 2, (128 - dh) / 2, dw, dh);
                    btn.appendChild(c);
                };
                img.onerror = () => { btn.textContent = '—'; };

                btn.addEventListener('click', () => {
                    addLogoFromManifest(canvas, logo, PLATE_W, PLATE_H, frontRect);
                    const wasOpen = panel.classList.contains('lp-open');
                    if (wasOpen) {
                        panel.classList.remove('lp-open');
                        toggleBtn.textContent = '☰ Логотипы';
                    }
                });
                brandGrid.appendChild(btn);
            });

            grid.appendChild(brandGrid);
        });
    };

    try {
        const resp = await fetch('images/logos/manifest.json');
        if (!resp.ok) throw new Error('Манифест не найден');
        const data = await resp.json();
        logoManifest = data.logos || [];
        if (logoManifest.length === 0) {
            grid.innerHTML = '<div class="lp-empty">Логотипы не найдены</div>';
            return;
        }
        renderGrid();
    } catch (e) {
        console.error('Ошибка загрузки манифеста логотипов:', e);
        grid.innerHTML = '<div class="lp-empty">❌ Ошибка загрузки манифеста</div>';
        return;
    }

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderGrid();
    });

    filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            filterBtns.forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderGrid();
        });
    });
}