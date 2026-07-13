// ============================================
// ЗАГРУЗЧИК ШРИФТОВ (FontFace API)
// ============================================

const loadedFonts = new Set();

/**
 * Загружает шрифт из файла и регистрирует в браузере
 */
export async function loadFont(fontName, fontFile) {
    if (loadedFonts.has(fontName)) return true;
    if (!fontFile) return false;

    try {
        const font = new FontFace(fontName, `url(${fontFile})`);
        await font.load();
        document.fonts.add(font);
        loadedFonts.add(fontName);
        return true;
    } catch (e) {
        console.warn(`Не удалось загрузить шрифт ${fontName}:`, e);
        return false;
    }
}

/**
 * Проверяет, загружен ли шрифт
 */
export function isFontLoaded(fontName) {
    return loadedFonts.has(fontName);
}
