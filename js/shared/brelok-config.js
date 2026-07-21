// js/brelok-config.js
//
// Сериализация/десериализация дизайна брелка в .brelok-config.json.
//
// Подключается из back.html как ES-модуль. Не зависит от editor.html,
// editor.html не используется — только back.
//
// Front-state читается/пишется через window.__sideToggle (см. js/side-toggle.js):
//   - getFrontSnapshot()   → { number, region, ...frontSettings }
//   - applyFrontSnapshot() → записано назад в frontSettings + DOM + перерисовка
//
// Back-side — это fabric.Canvas (глобальный `fabric` подгружается из CDN).
//   - serialize:   canvas.getObjects() (исключая front-rect) → toObject()
//   - apply:       enlivenObjects(json, cb) → canvas.add(obj)

const SCHEMA_VERSION = 1;

/**
 * Тип формата брелка, к которому относится конфиг. Один файл редактора
 * (back.html) сейчас обслуживает только один формат — «ru» (Номер РФ).
 * Если в будущем появятся другие типы (мото, дипломат, транзит), их
 * редакторы будут жить в отдельных HTML и сверять cfg.brelokType со своим
 * при импорте.
 *
 * Поле brelokType — ОБЯЗАТЕЛЬНОЕ в v1 (отсутствие → applyBrelokConfig бросает).
 * Это страхует от ситуации «загрузили чужой json».
 */
export const BRELOK_TYPE = 'ru';

export function getSchemaVersion() {
    return SCHEMA_VERSION;
}

// Каталог с логотипами на сайте. Все fabric.Image / fabric.Group, у которых
// src попадает в этот каталог, сериализуются как bare filename и обратно
// резолвятся относительно текущего origin. Так .brelok-config.json, сохранённый
// на проде (yur7yur7yur7.github.io), корректно открывается на любом другом
// хосте (правки/превью), без привязки к абсолютному URL деплоя.
//
// data: URL и абсолютные URL вне этого каталога не трогаем — это могут быть
// пользовательские загрузки или будущие ассеты.
const LOGOS_DIR = 'images/logos';

// Вид: 'https://example.com/foo/images/logos/lada_badge.png?v=1' → 'lada_badge.png'
// Вид: 'images/logos/lada_badge.png' → 'lada_badge.png' (на случай уже
// частично-относительных URL)
// null если src не из images/logos/.
function bareLogoSrc(src) {
    if (typeof src !== 'string' || !src) return null;
    // Режем query/fragment.
    const noQuery = src.split(/[?#]/, 1)[0];
    // Декодируем percent-escape, чтобы 'a%20b.png' и 'a b.png' сравнивались
    // одинаково. На хостах с пробелом в имени файла это критично.
    let decoded;
    try { decoded = decodeURIComponent(noQuery); } catch (_e) { decoded = noQuery; }
    // Ищем /images/logos/<file> в любом месте пути (после любого origin/префикса).
    // Имя файла — basename без расширения не ограничиваем: берём всё после
    // последнего '/' и до конца noQuery.
    const idx = decoded.lastIndexOf('/' + LOGOS_DIR + '/');
    if (idx < 0) return null;
    const tail = decoded.slice(idx + LOGOS_DIR.length + 2);
    if (!tail || tail.includes('/')) return null;
    return tail;
}

// src из /images/logos/<file> → '<file>' (bare). src, который уже bare —
// тоже '<file>' (idempotent). Прочее → null.
function toBareLogoSrc(src) {
    if (typeof src !== 'string' || !src) return null;
    const fromAbs = bareLogoSrc(src);
    if (fromAbs) return fromAbs;
    // Уже относительный путь images/logos/<file>.
    const m = src.match(new RegExp('^' + LOGOS_DIR + '/([^/?#]+)$'));
    if (m) return m[1];
    return null;
}

// Проходит по элементам и переписывает src у image/group-объектов из images/logos/
// в bare filename. Не трогает data: URL и URL из чужих каталогов.
function rewriteElementsToBare(elements) {
    if (!Array.isArray(elements)) return;
    for (const el of elements) {
        if (!el || typeof el !== 'object') continue;
        const t = el.type;
        if (t !== 'image' && t !== 'group') continue;
        const bare = toBareLogoSrc(el.src);
        if (bare) el.src = bare;
    }
}

// Проходит по элементам и переписывает bare src в полный путь images/logos/<file>,
// чтобы fabric.enlivenObjects загрузил логотип относительно текущего origin.
// Прочие src (data:, абсолютные) не трогаем.
function rewriteElementsFromBare(elements) {
    if (!Array.isArray(elements)) return;
    for (const el of elements) {
        if (!el || typeof el !== 'object') continue;
        const t = el.type;
        if (t !== 'image' && t !== 'group') continue;
        if (typeof el.src !== 'string' || !el.src) continue;
        const s = el.src;
        // Уже полный путь images/logos/<file> — не трогаем (идемпотентно).
        if (s.startsWith(LOGOS_DIR + '/')) continue;
        // data: URL и абсолютные URL (содержат "://" или "//") — не трогаем:
        // это либо пользовательская загрузка, либо будущий ассет из CDN.
        if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith('//')) continue;
        // Любой относительный путь, который выглядит как лого-файл
        // (basename без слэшей, basename.png/jpg/svg/webp/jpeg) — приводим
        // к images/logos/<basename>. Это покрывает:
        //   - bare "peugeot_badge.png"
        //   - "peugeot_badge.png?v=2" (cache-busting query — берём basename)
        //   - "./peugeot_badge.png"
        //   - любые другие «битые» формы, где fabric положил относительный
        //     путь без префикса каталога.
        const basename = s.split(/[?#]/, 1)[0].split('/').pop();
        if (basename && /\.(png|jpe?g|svg|webp|gif)$/i.test(basename)) {
            el.src = LOGOS_DIR + '/' + basename;
        }
    }
}

/**
 * Снять снимок текущего состояния брелка.
 * Сериализует:
 *  - frontSide из window.__sideToggle.getFrontSnapshot()
 *  - backSide как JSON от fabric.Canvas для всех пользовательских объектов
 *    (большой чёрный front-rect помечен __isFrontRect=true и НЕ сохраняется).
 *  - brelokType — "ru" (см. константу выше)
 *
 * @param {fabric.Canvas} canvas
 * @returns {{version:number, brelokType:string, exportedAt:string, source:string,
 *           frontSide:object, backSide:{elements:Array<object>}}}
 */
export function serializeBrelokConfig(canvas) {
    if (!canvas || typeof canvas.getObjects !== 'function') {
        throw new Error('serializeBrelokConfig: нужен fabric.Canvas');
    }
    const front = (typeof window !== 'undefined'
        && window.__sideToggle
        && typeof window.__sideToggle.getFrontSnapshot === 'function')
        ? window.__sideToggle.getFrontSnapshot()
        : {};

    const all = canvas.getObjects();
    const userObjects = all.filter((o) => !o.__isFrontRect);

    // fabric.Object#toObject возвращает plain JSON.
    const elements = userObjects.map((o) => {
        try {
            return o.toObject(['__isFrontRect']);
        } catch (e) {
            console.warn('serialize: не удалось сериализовать объект', o, e);
            return null;
        }
    }).filter(Boolean);

    // Переписываем src у логотипов: вместо абсолютного URL деплоя кладём
    // bare filename, чтобы конфиг был переносим между хостами.
    rewriteElementsToBare(elements);

    const background = (typeof window !== 'undefined'
        && window.__backBackground
        && typeof window.__backBackground.get === 'function')
        ? window.__backBackground.get()
        : { type: 'color', color: '#ffffff' };

    return {
        version: SCHEMA_VERSION,
        brelokType: BRELOK_TYPE,
        exportedAt: new Date().toISOString(),
        source: 'back.html',
        frontSide: front,
        backSide: { elements, background },
    };
}

/**
 * Применить конфиг к canvas (очистив его от старых user-объектов) и frontSettings.
 * Возвращает Promise — fabric.enlivenObjects асинхронный.
 *
 * Проверки:
 *  - canvas существует
 *  - config непустой объект
 *  - version совпадает со SCHEMA_VERSION
 *  - brelokType либо совпадает с BRELOK_TYPE редактора, либо проверка
 *    делегирована наружу через параметр expectedType=null (вызывающий код
 *    решает сам).
 *
 * @param {fabric.Canvas} canvas
 * @param {{version:number, brelokType?:string, frontSide?:object,
 *          backSide?:{elements:Array}}} config
 * @param {string|null} [expectedType]  тип брелка, ожидаемый редактором;
 *                                       null — пропустить проверку.
 * @returns {Promise<void>}
 */
export function applyBrelokConfig(canvas, config, expectedType = BRELOK_TYPE) {
    if (!canvas || typeof canvas.getObjects !== 'function') {
        return Promise.reject(new Error('applyBrelokConfig: нужен fabric.Canvas'));
    }
    if (!config || typeof config !== 'object') {
        return Promise.reject(new Error('applyBrelokConfig: пустой конфиг'));
    }
    if (expectedType && config.brelokType !== expectedType) {
        return Promise.reject(new Error(
            `Макет для другого формата («${config.brelokType || '?'}»), `
            + `этот редактор — «${expectedType}»`
        ));
    }
    if (config.version !== SCHEMA_VERSION) {
        return Promise.reject(new Error(
            `Конфиг устарел (v${config.version}, ожидается v${SCHEMA_VERSION})`
        ));
    }

    // 1. Снимаем выделение, удаляем все объекты, КРОМЕ front-rect.
    try { canvas.discardActiveObject(); } catch (_) { /* no-op */ }
    const frontRect = canvas.getObjects().find((o) => o.__isFrontRect);
    const toRemove = canvas.getObjects().slice().filter((o) => o !== frontRect);
    toRemove.forEach((o) => canvas.remove(o));

    // 2. Применяем front-state, если есть.
    if (config.frontSide) {
        if (typeof window !== 'undefined'
            && window.__sideToggle
            && typeof window.__sideToggle.applyFrontSnapshot === 'function') {
            window.__sideToggle.applyFrontSnapshot(config.frontSide);
        }
    }

    // 3. Восстанавливаем фон задней стороны. В старых конфигах поля нет — белый.
    if (typeof window !== 'undefined'
        && window.__backBackground
        && typeof window.__backBackground.set === 'function') {
        window.__backBackground.set(config.backSide?.background || {
            type: 'color',
            color: '#ffffff'
        });
    }

    // 4. Восстанавливаем back-objects через enlivenObjects.
    const elements = Array.isArray(config.backSide?.elements) ? config.backSide.elements : [];

    // Bare-filename src из images/logos/ (новый формат конфигов) →
    // полный относительный путь, чтобы fabric загрузил картинку
    // относительно текущего origin. Старые конфиги с абсолютными URL
    // из images/logos/ сначала нормализуются в bare (rewriteElementsToBare),
    // затем разворачиваются обратно.
    rewriteElementsToBare(elements);
    rewriteElementsFromBare(elements);
    const fabricGlobal = (typeof window !== 'undefined' && window.fabric)
        ? window.fabric
        : (typeof fabric !== 'undefined' ? fabric : null);
    if (!fabricGlobal) {
        return Promise.reject(new Error('fabric.js не загружен'));
    }
    if (elements.length === 0) {
        canvas.requestRenderAll();
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        try {
            fabricGlobal.util.enlivenObjects(elements, (enlivened) => {
                try {
                    enlivened.forEach((obj) => {
                        if (!obj) return;
                        // Блокируем fitTextboxWidthToContent на первый apply,
                        // иначе он развернёт textbox до ширины текста в одну
                        // строку и перенос сломается. Флаг снимется в
                        // selection-style.js при первом changed-событии.
                        if (obj.type === 'textbox' && !('__userLockedWidth' in obj)) {
                            obj.__userLockedWidth = true;
                        }
                        canvas.add(obj);
                    });
                    canvas.requestRenderAll();
                    resolve();
                } catch (e) {
                    reject(e);
                }
            }, 'fabric');
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Скачать конфиг как файл через Blob + <a download>.
 * @param {object} config
 * @param {string} [filename]
 */
export function downloadConfig(config, filename = 'brelok.config.json') {
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Прочитать JSON из File. Бросает на невалидном вводе.
 * @param {File} file
 * @returns {Promise<object>}
 */
export function parseConfigFile(file) {
    return file.text().then((text) => {
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (_e) {
            throw new Error('Файл не похож на JSON');
        }
        if (typeof parsed !== 'object' || parsed === null) {
            throw new Error('Корневой элемент не объект');
        }
        return parsed;
    });
}

/**
 * Собрать имя файла для экспорта: brelok-<number><region>.config.json.
 * Если номера и региона нет — brelok.config.json.
 * @param {{number?:string, region?:string}} front
 */
export function buildConfigFilename(front) {
    const num = (front?.number || '').trim();
    const reg = (front?.region || '').trim();
    return (num || reg) ? `brelok-${num}${reg}.config.json` : 'brelok.config.json';
}
