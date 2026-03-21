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
    // Ищем {любые_символы}, разрешаем буквы, цифры, дефис, подчеркивание, пробелы, скобки
    const regex = /\{([^{}]+)\}/gi; // ← проще: всё что угодно между { и }
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

        // Сам логотип (всё содержимое скобок)
        fragments.push({
            type: 'logo',
            brand: match[1] // сохраняем как есть
        });

        lastIndex = match.index + match[0].length;
    }

    // Остаток текста
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
    try {
        // Показываем загрузку
        grid.innerHTML = '<div class="loading-logos">⏳ Загрузка логотипов...</div>';

        // Один запрос к манифесту
        const response = await fetch('images/logos/manifest.json');

        if (!response.ok) {
            throw new Error('Манифест не найден');
        }

        const manifest = await response.json();

        if (!manifest.logos || manifest.logos.length === 0) {
            grid.innerHTML = '<div class="no-logos">Логотипы не найдены</div>';
            return;
        }

        // Очищаем сетку
        grid.innerHTML = '';

        // Загружаем логотипы параллельно
        const logoPromises = manifest.logos.map(async (fileName) => {
            // Получаем имя бренда из имени файла (без расширения)
            const brand = fileName.replace(/\.[^/.]+$/, '');
            const filePath = `images/logos/${fileName}`;

            try {
                // Загружаем в кеш
                await loadLogo(brand, filePath);
                // Создаем кнопку
                return await createLogoButton(brand, filePath);
            } catch (e) {
                console.warn(`Не удалось загрузить ${fileName}:`, e);
                return null;
            }
        });

        // Ждем все загрузки
        const buttons = await Promise.all(logoPromises);

        // Добавляем только успешные кнопки
        buttons
            .filter(btn => btn !== null)
            .forEach(btn => grid.appendChild(btn));

        console.log(`✅ Загружено ${buttons.filter(b => b).length} логотипов`);

    } catch (e) {
        console.error('Ошибка загрузки логотипов:', e);
        grid.innerHTML = '<div class="no-logos">❌ Ошибка загрузки логотипов</div>';
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