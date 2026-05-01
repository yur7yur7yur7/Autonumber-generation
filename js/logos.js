// ============================================
// ЛОГОТИПЫ - как часть текста
// ============================================

let canvas = null;
let ctx = null;
let currentSide = null;
let drawPlateCallback = null;

// Кеш для загруженных логотипов
const logoCache = {};

// Данные манифеста
let logoManifest = [];

// Размер логотипов в тексте (px)
const LOGO_SIZE_IN_TEXT = 24;


/**
 * Разбирает текст на фрагменты (текст и логотипы)
 * Используется для обратной совместимости со старым форматом {brand}
 */
export function parseTextWithLogos(text) {
    const regex = /\{([^{}]+)\}/gi;
    const fragments = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            fragments.push({
                type: 'text',
                content: text.substring(lastIndex, match.index)
            });
        }

        fragments.push({
            type: 'logo',
            brand: match[1]
        });

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        fragments.push({
            type: 'text',
            content: text.substring(lastIndex)
        });
    }

    return fragments;
}
/**
 * Устанавливает ссылки на нужные элементы
 */
export function setLogoContext(canvasElement, context, sideGetter, drawCallback) {
    canvas = canvasElement;
    ctx = context;
    currentSide = sideGetter;
    drawPlateCallback = drawCallback;
}

/**
 * Загружает логотип в кеш
 */
async function loadLogo(fileName) {
    if (logoCache[fileName]) return logoCache[fileName];

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = `images/logos/${fileName}`;

        img.onload = () => {
            logoCache[fileName] = img;
            resolve(img);
        };

        img.onerror = () => {
            console.warn(`Не удалось загрузить логотип: ${fileName}`);
            resolve(null);
        };
    });
}

/**
 * Получает логотип из кеша по имени файла
 */
export function getLogoByFile(fileName) {
    return logoCache[fileName] || null;
}

/**
 * Создает DOM-элемент логотипа для вставки в contenteditable
 */
function createLogoElement(fileName) {
    const img = logoCache[fileName];
    if (!img) return null;

    const span = document.createElement('span');
    span.className = 'inline-logo';
    span.contentEditable = 'false';
    span.dataset.logoFile = fileName;

    const canvas = document.createElement('canvas');
    canvas.width = LOGO_SIZE_IN_TEXT * 2;
    canvas.height = LOGO_SIZE_IN_TEXT * 2;
    canvas.className = 'inline-logo-canvas';

    const c = canvas.getContext('2d');
    const aspect = img.width / img.height;
    let dw = LOGO_SIZE_IN_TEXT * 2 - 4;
    let dh = LOGO_SIZE_IN_TEXT * 2 - 4;

    if (aspect > 1) {
        dh = dw / aspect;
    } else {
        dw = dh * aspect;
    }

    c.drawImage(img,
        (LOGO_SIZE_IN_TEXT * 2 - dw) / 2,
        (LOGO_SIZE_IN_TEXT * 2 - dh) / 2,
        dw, dh
    );

    span.appendChild(canvas);

    // Невидимый пробел после логотипа для удобства навигации
    const space = document.createTextNode('\u200B');
    span.appendChild(space);

    return span;
}

/**
 * Загружает манифест и создает панель логотипов
 */
export async function createLogoPanel() {
    const panel = document.createElement('div');
    panel.className = 'logo-panel';

    // Заголовок
    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `<p class="panel-title">🏭 Логотипы</p>`;

    // Поиск
    const searchContainer = document.createElement('div');
    searchContainer.className = 'logo-search-container';
    searchContainer.innerHTML = `
        <input type="text" class="logo-search-input" placeholder="🔍 Поиск по бренду..." autocomplete="off">
    `;

    // Фильтры по типу
    const filterContainer = document.createElement('div');
    filterContainer.className = 'logo-filter-tabs';
    filterContainer.innerHTML = `
        <button class="logo-filter-btn active" data-filter="all">Все</button>
        <button class="logo-filter-btn" data-filter="badge">Значки</button>
        <button class="logo-filter-btn" data-filter="text">С надписью</button>
    `;

    // Сетка логотипов
    const grid = document.createElement('div');
    grid.className = 'logo-grid';
    grid.id = 'logoGrid';
    grid.innerHTML = '<div class="loading-logos">Загрузка логотипов...</div>';

    panel.appendChild(header);
    panel.appendChild(searchContainer);
    panel.appendChild(filterContainer);
    panel.appendChild(grid);

    // Загружаем манифест и отрисовываем
    await loadManifestAndRender(grid);

    // Обработчики поиска и фильтров
    const searchInput = searchContainer.querySelector('.logo-search-input');
    const filterBtns = filterContainer.querySelectorAll('.logo-filter-btn');

    let currentFilter = 'all';
    let searchQuery = '';

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderLogoGrid(grid, currentFilter, searchQuery);
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderLogoGrid(grid, currentFilter, searchQuery);
        });
    });

    return panel;
}

/**
 * Загружает манифест и рендерит сетку
 */
async function loadManifestAndRender(grid) {
    try {
        grid.innerHTML = '<div class="loading-logos">⏳ Загрузка логотипов...</div>';

        const response = await fetch('images/logos/manifest.json');
        if (!response.ok) throw new Error('Манифест не найден');

        logoManifest = (await response.json()).logos || [];

        if (logoManifest.length === 0) {
            grid.innerHTML = '<div class="no-logos">Логотипы не найдены</div>';
            return;
        }

        // Загружаем все логотипы в кеш
        const loadPromises = logoManifest.map(logo => loadLogo(logo.file));
        await Promise.allSettled(loadPromises);

        renderLogoGrid(grid, 'all', '');
        console.log(`✅ Загружено ${logoManifest.length} логотипов`);

    } catch (e) {
        console.error('Ошибка загрузки манифеста:', e);
        grid.innerHTML = '<div class="no-logos">❌ Ошибка загрузки</div>';
    }
}

/**
 * Рендерит сетку логотипов с учётом фильтров
 */
function renderLogoGrid(grid, filter, query) {
    let filtered = [...logoManifest];

    if (filter === 'badge') {
        filtered = filtered.filter(l => l.type === 'badge');
    } else if (filter === 'text') {
        filtered = filtered.filter(l => l.type === 'text');
    }

    if (query) {
        filtered = filtered.filter(l =>
            l.brand.toLowerCase().includes(query) ||
            l.label.toLowerCase().includes(query)
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="no-logos">Ничего не найдено</div>';
        return;
    }

    // Группируем по бренду
    const grouped = {};
    filtered.forEach(logo => {
        if (!grouped[logo.brand]) grouped[logo.brand] = [];
        grouped[logo.brand].push(logo);
    });

    const sortedBrands = Object.keys(grouped).sort();

    grid.innerHTML = '';

    sortedBrands.forEach(brand => {
        const brandGroup = document.createElement('div');
        brandGroup.className = 'logo-brand-group';

        const brandTitle = document.createElement('div');
        brandTitle.className = 'logo-brand-title';
        brandTitle.textContent = brand.toUpperCase();
        brandGroup.appendChild(brandTitle);

        const brandGrid = document.createElement('div');
        brandGrid.className = 'logo-brand-grid';

        grouped[brand].forEach(logo => {
            const btn = createLogoButton(logo);
            brandGrid.appendChild(btn);
        });

        brandGroup.appendChild(brandGrid);
        grid.appendChild(brandGroup);
    });
}

/**
 * Создает кнопку с логотипом
 */
function createLogoButton(logo) {
    const btn = document.createElement('button');
    btn.className = 'logo-btn';
    btn.title = logo.label;

    const img = logoCache[logo.file];
    if (!img) {
        btn.textContent = '...';
        return btn;
    }

    // Превью на канвасе
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = 40;
    previewCanvas.height = 40;
    const previewCtx = previewCanvas.getContext('2d');
    previewCtx.clearRect(0, 0, 40, 40);

    const aspect = img.width / img.height;
    let dw = 36, dh = 36;
    if (aspect > 1) dh = 36 / aspect;
    else dw = 36 * aspect;

    previewCtx.drawImage(img, (40 - dw) / 2, (40 - dh) / 2, dw, dh);

    btn.appendChild(previewCanvas);

    // Подпись
    const label = document.createElement('span');
    label.className = 'logo-btn-label';
    label.textContent = logo.label.length > 20
        ? logo.label.substring(0, 18) + '...'
        : logo.label;
    btn.appendChild(label);

    // Клик — вставка логотипа в contenteditable
    btn.addEventListener('click', () => {
        if (currentSide() !== 'back') {
            alert('Переключись на заднюю сторону для вставки логотипа!');
            return;
        }

        const customText = document.getElementById('customText');
        if (!customText) return;

        const sideBack = document.getElementById('side-back');
        if (sideBack && !sideBack.classList.contains('active')) {
            alert('Переключись на заднюю сторону для вставки логотипа!');
            return;
        }

        const logoEl = createLogoElement(logo.file);
        if (!logoEl) return;

        const selection = window.getSelection();

        // Проверяем, что курсор внутри customText
        if (selection.rangeCount === 0 || !customText.contains(selection.anchorNode)) {
            // Вставляем в конец, без фокуса
            customText.appendChild(logoEl);
        } else {
            const range = selection.getRangeAt(0);
            range.insertNode(logoEl);
            range.setStartAfter(logoEl);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        drawPlateCallback();
    });

    return btn;
}