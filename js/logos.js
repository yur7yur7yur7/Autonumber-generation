// ============================================
// ЛОГОТИПЫ - как часть текста
// ============================================

let canvas = null;
let ctx = null;
let currentSide = null;
let drawPlateCallback = null;

// Кеш для загруженных логотипов
const logoCache = {};

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
 * Проверяет существование файла
 */
async function checkImageExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Загружает логотип в кеш
 */
async function loadLogo(brand, fileName) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = fileName;

        img.onload = () => {
            logoCache[brand] = img;
            resolve(img);
        };

        img.onerror = () => {
            console.warn(`Не удалось загрузить логотип: ${brand}`);
            resolve(null);
        };
    });
}

/**
 * Получает логотип из кеша или загружает
 */
export async function getLogo(brand) {
    return logoCache[brand] || null;
}

/**
 * Разбирает текст на фрагменты (текст и логотипы)
 */
export function parseTextWithLogos(text) {
    const regex = /\{([a-z0-9-]+)\}/gi; // ищем {bmw}, {audi}, {bmw-m} и т.д.
    const fragments = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Текст до логотипа
        if (match.index > lastIndex) {
            fragments.push({
                type: 'text',
                content: text.substring(lastIndex, match.index)
            });
        }

        // Сам логотип
        fragments.push({
            type: 'logo',
            brand: match[1].toLowerCase()
        });

        lastIndex = match.index + match[0].length;
    }

    // Остаток текста после последнего логотипа
    if (lastIndex < text.length) {
        fragments.push({
            type: 'text',
            content: text.substring(lastIndex)
        });
    }

    return fragments;
}

/**
 * Сканирует папку с логотипами и создает кнопки
 */
export async function createLogoPanel() {
    const panel = document.createElement('div');
    panel.className = 'logo-panel';

    const header = document.createElement('div');
    header.className = 'panel-header';
    header.innerHTML = `<p class="panel-title">🏭 Логотипы (клик - вставить в текст как {brand})</p>`;

    const grid = document.createElement('div');
    grid.className = 'logo-grid';
    grid.id = 'logoGrid';

    grid.innerHTML = '<div class="loading-logos">Загрузка логотипов...</div>';

    panel.appendChild(header);
    panel.appendChild(grid);

    setTimeout(() => loadLogos(grid), 100);

    return panel;
}

/**
 * Загружает логотипы из папки и создает кнопки
 */
async function loadLogos(grid) {
    const formats = ['svg', 'png', 'webp', 'jpg', 'jpeg', 'eps'];

    const possibleLogos = [
        'bmw', 'mercedes', 'audi', 'volkswagen', 'porsche', 'bmw-m', 'amg',
        'toyota', 'honda', 'nissan', 'mazda', 'subaru', 'mitsubishi',
        'ford', 'chevrolet', 'dodge', 'tesla', 'ferrari', 'lamborghini',
        'volvo', 'renault', 'peugeot', 'citroen', 'fiat', 'alfa-romeo', 'mers', 'geely','toyota2'
    ];

    const logoButtons = [];

    for (const logoName of possibleLogos) {
        let found = false;

        for (const format of formats) {
            const fileName = `images/logos/${logoName}.${format}`;
            const exists = await checkImageExists(fileName);

            if (exists) {
                // Загружаем логотип в кеш
                await loadLogo(logoName, fileName);

                // Создаем кнопку
                const btn = await createLogoButton(logoName, fileName);
                if (btn) logoButtons.push(btn);
                found = true;
                break;
            }
        }

        if (!found) {
            const capitalized = logoName.charAt(0).toUpperCase() + logoName.slice(1);
            for (const format of formats) {
                const fileName = `images/logos/${capitalized}.${format}`;
                const exists = await checkImageExists(fileName);

                if (exists) {
                    await loadLogo(logoName, fileName);
                    const btn = await createLogoButton(logoName, fileName);
                    if (btn) logoButtons.push(btn);
                    break;
                }
            }
        }
    }

    grid.innerHTML = '';

    if (logoButtons.length === 0) {
        grid.innerHTML = '<div class="no-logos">Логотипы не найдены</div>';
    } else {
        logoButtons.sort((a, b) => {
            const nameA = a.dataset.brand.toLowerCase();
            const nameB = b.dataset.brand.toLowerCase();
            return nameA.localeCompare(nameB);
        });

        logoButtons.forEach(btn => grid.appendChild(btn));
    }
}

/**
 * Создает кнопку с логотипом
 */
async function createLogoButton(logoName, fileName) {
    return new Promise((resolve) => {
        const btn = document.createElement('button');
        btn.className = 'logo-btn';
        btn.dataset.brand = logoName;
        btn.dataset.file = fileName;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = fileName;

        img.onload = () => {
            // Создаем canvas для предпросмотра
            const previewCanvas = document.createElement('canvas');
            previewCanvas.width = 40;
            previewCanvas.height = 40;
            const previewCtx = previewCanvas.getContext('2d');

            previewCtx.clearRect(0, 0, 40, 40);

            const aspectRatio = img.width / img.height;
            let drawWidth = 36;
            let drawHeight = 36;

            if (aspectRatio > 1) {
                drawHeight = 36 / aspectRatio;
            } else {
                drawWidth = 36 * aspectRatio;
            }

            previewCtx.drawImage(img,
                (40 - drawWidth)/2, (40 - drawHeight)/2,
                drawWidth, drawHeight
            );

            btn.innerHTML = '';
            btn.appendChild(previewCanvas);

            // Обработчик клика - вставка кода логотипа в текст
            btn.addEventListener('click', () => {
                if (currentSide() !== 'back') {
                    alert('Переключись на заднюю сторону для вставки логотипа!');
                    return;
                }

                const customText = document.getElementById('customText');
                if (!customText) return;

                const cursorPos = customText.selectionStart;
                const textBefore = customText.value.substring(0, cursorPos);
                const textAfter = customText.value.substring(cursorPos);

                // Вставляем код логотипа {brand}
                const logoCode = `{${logoName}}`;
                customText.value = textBefore + logoCode + textAfter;

                // Возвращаем курсор после вставленного кода
                // customText.focus();
                // customText.selectionStart = customText.selectionEnd = cursorPos + logoCode.length;

                if (drawPlateCallback) drawPlateCallback();
            });

            resolve(btn);
        };

        img.onerror = () => {
            console.warn(`Не удалось загрузить: ${fileName}`);
            resolve(null);
        };
    });
}
