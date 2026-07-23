// ============================================================
// Clamp объектов в границах внутренней белой плашки (frontRect)
// + опциональный overlay из 4 чёрных полос вокруг frontRect,
// которые видны при выключенном clamp и скрывают всё, что
// выходит за границы белой плашки.
//
// Два режима задаются через setFrameMode(canvas, 'clamp' | 'cover'):
//   • 'clamp' (по умолчанию) — объекты не могут вылезать за frontRect,
//     overlay скрыт. Видно, как пользователь тащит объект, но он
//     упирается в границу.
//   • 'cover' — clamp выключен, четыре чёрных полосы лежат поверх
//     всех объектов по периметру frontRect. Объекты, вылезающие за
//     белую плашку, скрываются под этими полосами.
// ============================================================

let frameStrips = null;
let currentMode = 'clamp';

function clampObjectToPlate(obj, plate) {
    const b = obj.getBoundingRect(true, true);
    let dx = 0, dy = 0;
    if (b.left < plate.left) dx = plate.left - b.left;
    else if (b.left + b.width > plate.right) dx = plate.right - (b.left + b.width);
    if (b.top < plate.top) dy = plate.top - b.top;
    else if (b.top + b.height > plate.bottom) dy = plate.bottom - (b.top + b.height);
    if (dx === 0 && dy === 0) return false;
    obj.set({ left: obj.left + dx, top: obj.top + dy });
    obj.setCoords();
    return true;
}

/**
 * Считает «вылазку» bbox за plate по двум осям. Возвращает {dx, dy, fits}:
 *   dx > 0 — объект торчит вправо, dx < 0 — влево, |dx| — на сколько;
 *   dy — аналогично для вертикали;
 *   fits === true — bbox помещается в plate (после возможного сдвига не нужно
 *   трогать масштаб).
 */
function overflowByAxis(obj, plate) {
    const b = obj.getBoundingRect(true, true);
    let dx = 0, dy = 0;
    if (b.left < plate.left) dx = plate.left - b.left;
    else if (b.left + b.width > plate.right) dx = plate.right - (b.left + b.width);
    if (b.top < plate.top) dy = plate.top - b.top;
    else if (b.top + b.height > plate.bottom) dy = plate.bottom - (b.top + b.height);
    return { dx, dy, fits: dx === 0 && dy === 0 };
}

/**
 * Подбирает scale (равномерно по X/Y) бинарным поиском так, чтобы bbox
 * ровно вписался в bounds при текущем left/top. Возвращает максимальный
 * scale в диапазоне [MIN_SCALE, hiBound], при котором bbox вписывается
 * по обеим осям.
 *
 *   Аналитический ratio (bounds / (bbox / scale)) НЕ работает для
 *   повёрнутых объектов: при scale=1 и угле 90° bbox уже включает
 *   |cos θ|/|sin θ|, и `bbox.width / scaleX` даёт проекцию необработанной
 *   высоты, а не ширины. Получается ratio > 1 при фактически
 *   невмещающемся bbox, и функция возвращает 1 (= «не уменьшать»).
 *
 *   Поэтому подменяем scaleX/scaleY, пересчитываем aCoords, читаем
 *   getBoundingRect — он всегда корректен относительно текущего scale.
 *   Бинарный поиск в [MIN_SCALE, hiBound] — на каждой итерации
 *   проверяем fitsInBounds, сужаем диапазон. После возврата —
 *   восстанавливаем реальные scaleX/scaleY, чтобы Fabric не висел
 *   с подменой до следующего object:rotating.
 *
 *   hiBound — верхняя граница поиска. Если передать текущий scale,
 *   функция не сможет поднять scale выше (это безопасно при
 *   нестабильном fitsInPlate). Если передать __rotationOriginal.scaleX,
 *   функция найдёт максимум, который был бы возможен при идеальном
 *   вписывании на текущем угле.
 *
 *   Минимум 0.05 — текстбоксы не схлопываются в ноль.
 */
function fitScaleForCurrentPosition(obj, bounds, hiBound) {
    const MIN_SCALE = 0.05;
    const availW = bounds.right - bounds.left;
    const availH = bounds.bottom - bounds.top;
    if (availW <= 0 || availH <= 0) return MIN_SCALE;

    const prevSx = obj.scaleX;
    const prevSy = obj.scaleY;
    let hi = Math.max(hiBound || prevSx || 1, MIN_SCALE);

    // Бинарный поиск максимального scale в [MIN_SCALE, hi], при котором
    // bbox вписывается в bounds. При MIN_SCALE гарантированно fits,
    // поэтому best всегда ≥ MIN_SCALE.
    let lo = MIN_SCALE;
    let best = MIN_SCALE;
    for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        obj.scaleX = mid;
        obj.scaleY = mid;
        obj.setCoords();
        if (fitsInPlate(obj, bounds)) {
            best = mid;
            lo = mid;
        } else {
            hi = mid;
        }
        if (hi - lo < 0.001) break;
    }

    obj.scaleX = prevSx;
    obj.scaleY = prevSy;
    obj.setCoords();
    return best;
}

/**
 * Clamp объекта во время поворота.
 *
 *   Шаг 1. Проверяем, помещается ли bbox в canvasBounds (весь канвас)
 *     при ТЕКУЩЕМ scale.
 *     • Если да — bbox не крупнее канваса, торчит только за plate по
 *       позиции. Делаем обычный сдвиг через clampObjectToPlate.
 *
 *   Шаг 2. Если bbox крупнее канваса хотя бы по одной оси (длинный
 *     объект на диагонали/90°), чистый сдвиг не решает: при попытке
 *     сдвинуть в противоположную сторону объект упрётся в
 *     противоположную границу, на следующем тике angle чуть
 *     меняется — снова торчит «сверху», сдвигаем «вниз» — теперь
 *     торчит «снизу», цикл. Это и есть «дребезг».
 *
 *     В этом случае уменьшаем scale так, чтобы bbox ровно вписался в
 *     canvasBounds (не в plate — scale-fit по размеру канваса, чтобы
 *     объект гарантированно можно было потом сдвинуть в plate за
 *     один шаг). После уменьшения — клампим позицию в plate.
 *
 *   Шаг 3. Когда bbox вписывается (поворот прошёл «узкий участок»),
 *     проверяем fitsAtOriginalScale — если и при исходном scale
 *     вписался бы, возвращаем scale и позицию к __rotationOriginal.
 *
 * Запоминание размера в рамках одного зажатия: __rotationOriginal
 * фиксируется один раз при входе в rotating (scale + позиция) и
 * сбрасывается на object:modified. Между тиками его НЕ подкручиваем — иначе
 * «оригинал» сам уедет вслед за объектом через уменьшенное состояние и
 * никогда не вернётся.
 *
 * Все изменения применяем только если отклонение > 0.5px/scale — иначе
 * при повторяющихся тиках мы бы дёргали set/setCoords на ровном месте и
 * тормозили канвас.
 */

/**
 * Возвращает true, если при scale = orig.scaleX (то есть до уменьшения,
 * сделанного нами во время поворота) bbox вписался бы в plate. Используется
 * чтобы решить, можно ли вернуть scale к исходному при проходе узкого
 * участка. Без этой проверки был бы «дребезг»: на 90° уменьшили scale до
 * 0.19, на 91° bbox вписался при scale 0.19, мы вернули scale к 1, на 92°
 * bbox опять не вписался, опять уменьшили — и так каждую итерацию.
 */
function fitsAtOriginalScale(obj, orig, plate) {
    if (!orig) return false;
    // Подменяем scale, пересчитываем aCoords, читаем bbox. Чтобы не
    // портить настоящие scaleX/scaleY объекта (которые Fabric тут же
    // пересчитает в своих обработчиках), сохраняем и восстанавливаем.
    const prevSx = obj.scaleX;
    const prevSy = obj.scaleY;
    obj.scaleX = orig.scaleX;
    obj.scaleY = orig.scaleY;
    obj.setCoords();
    const fits = fitsInPlate(obj, plate);
    obj.scaleX = prevSx;
    obj.scaleY = prevSy;
    obj.setCoords();
    return fits;
}

function clampObjectRotationToPlate(obj, plate, canvasBounds, originRef) {
    const HYSTERESIS = 0.005;
    const orig = obj.__rotationOriginal;
    const currentScale = obj.scaleX || 1;
    // object:rotating срабатывает ПОСЛЕ того, как Fabric записал новый angle
    // в obj.angle, но ДО setCoords — внутренний aCoords (и, как следствие,
    // getBoundingRect) ещё содержит угловые точки прошлого тика. setCoords()
    // пересчитывает aCoords на основе текущего угла, и bbox становится
    // актуальным. ЭТО критично: без него видим лаг «изменения видны при
    // следующем действии» (тот же приём, что использует clampObjectToPlate
    // внутри себя — setCoords идёт в конце после set({left, top})).
    obj.setCoords();

    // Шаг 0. Если при исходном scale (__rotationOriginal) bbox
    // вписывается в plate — узкий участок пройден, возвращаем scale
    // и позицию к __rotationOriginal. Срабатывает на ЛЮБОМ угле,
    // где при orig.scaleX влезает (для текстбокса 800×150 в плашке
    // 600×600 — это 0° и 180°, потому что при orig.scaleX=1 на
    // промежуточных углах bbox тоже > plate).
    if (originRef && orig && currentScale < orig.scaleX - HYSTERESIS
        && fitsAtOriginalScale(obj, orig, plate)) {
        obj.set({
            scaleX: orig.scaleX,
            scaleY: orig.scaleY,
            left: orig.left,
            top: orig.top
        });
        obj.setCoords();
        return;
    }

    // Шаг 1. Подбираем максимальный scale в диапазоне [MIN_SCALE,
    // __rotationOriginal.scaleX], при котором bbox вписывается в plate
    // при ТЕКУЩЕМ угле. Передаём orig.scaleX как hiBound, чтобы
    // бинарный поиск мог поднять scale выше currentScale (когда угол
    // становится «удобнее» — например, 0°→45° для длинного объекта,
    // где max scale растёт с 0.75 до 0.894).
    //
    //   Симметричный set с гистерезисом 0.005 (0.5%) подавляет шум
    //   бинарного поиска. Scale меняется монотонно в окрестности
    //   (нет мерцания между уменьшением и увеличением).
    //
    //   Позицию не двигаем во время вращения: уменьшение/увеличение
    //   идёт вокруг точки вращения, объект не «прыгает» в центр plate.
    //   Финальный кламп позиции — на object:modified.
    const hiBound = orig ? orig.scaleX : currentScale;
    const ratio = fitScaleForCurrentPosition(obj, plate, hiBound);
    if (Math.abs(ratio - currentScale) > HYSTERESIS) {
        obj.set({ scaleX: ratio, scaleY: ratio });
        obj.setCoords();
    }
}

/**
 * «Стоп-кран» при растягивании за якорь: объект не уменьшается в размере —
 * якорь просто перестаёт тянуть, когда bbox уже уперся в plate.
 *
 * Реализация через кешированный «потолок» (obj.__scaleCap) с ПОЛНЫМ
 * снапшотом валидного состояния (left, top, scaleX, scaleY):
 *   • На каждом object:scaling, пока bbox помещается в plate, потолок
 *     подтягивается вверх к новому валидному состоянию.
 *   • Если bbox выходит за plate, мы возвращаем объект к снапшоту —
 *     и size, и position. Без этого Fabric при масштабировании за якорь
 *     сдвигает left/top вместе со scale, и объект «выпадает» за границу
 *     по позиции; тогда следующий object:moving клампит позицию, и
 *     визуально это читается как «якорь переключился в режим
 *     передвижения объекта за границу».
 *   • На object:modified (конец драга) снапшот сбрасывается, чтобы при
 *     следующем resize объект снова мог свободно расти вниз.
 */
function fitsInPlate(obj, plate) {
    const b = obj.getBoundingRect(true, true);
    return b.left >= plate.left
        && b.left + b.width <= plate.right
        && b.top >= plate.top
        && b.top + b.height <= plate.bottom;
}

function snapshotState(obj) {
    return {
        left: obj.left,
        top: obj.top,
        scaleX: obj.scaleX,
        scaleY: obj.scaleY
    };
}

function restoreState(obj, snap) {
    obj.set({
        left: snap.left,
        top: snap.top,
        scaleX: snap.scaleX,
        scaleY: snap.scaleY
    });
    obj.setCoords();
}

function clampObjectScaleToPlate(obj, plate) {
    const cap = obj.__scaleCap;
    if (fitsInPlate(obj, plate)) {
        // Запоминаем текущее валидное состояние как новый потолок —
        // и size, и position, чтобы при пересечении границы вернуть
        // объект ровно туда, где он был в последний валидный момент.
        obj.__scaleCap = snapshotState(obj);
        return;
    }
    if (!cap || cap.scaleX <= 0 || cap.scaleY <= 0) {
        // Потолок ещё не выставлен — откатываем через бинарный спуск
        // (одноразово на первом драге, если объект был больше plate).
        clampObjectScaleFirstTime(obj, plate);
        return;
    }
    // bbox превысил plate — возвращаем объект к последнему валидному
    // состоянию (size + position). Якорь перестаёт тянуть, объект
    // не сжимается и не уезжает за границу.
    restoreState(obj, cap);
}

function clampObjectScaleFirstTime(obj, plate) {
    const STEP = 0.01;
    const MIN_SCALE = 0.01;
    let lastValid = null;
    for (let i = 0; i < 200; i++) {
        if (fitsInPlate(obj, plate)) {
            lastValid = snapshotState(obj);
            break;
        }
        const nextSx = Math.max(MIN_SCALE, obj.scaleX - STEP);
        const nextSy = Math.max(MIN_SCALE, obj.scaleY - STEP);
        if (nextSx === obj.scaleX && nextSy === obj.scaleY) break;
        obj.set({ scaleX: nextSx, scaleY: nextSy });
        obj.setCoords();
    }
    if (lastValid) obj.__scaleCap = lastValid;
}

// То же, что fitsAtOriginalScale, но с допуском tol (px) — «влезает
// если каждая грань bbox не выходит за plate больше чем на tol».
// Используется в live-логике для textbox, чтобы подавить дребезг
// wrap'а на границе.
function fitsAtOriginalScaleWithTolerance(obj, orig, plate, tol) {
    if (!orig) return false;
    const prevSx = obj.scaleX;
    const prevSy = obj.scaleY;
    obj.scaleX = orig.scaleX;
    obj.scaleY = orig.scaleY;
    obj.setCoords();
    const b = obj.getBoundingRect(true, true);
    obj.scaleX = prevSx;
    obj.scaleY = prevSy;
    obj.setCoords();
    return b.left >= plate.left - tol
        && b.left + b.width <= plate.right + tol
        && b.top >= plate.top - tol
        && b.top + b.height <= plate.bottom + tol;
}

// Максимальное (по модулю) отклонение bbox за plate в пикселях.
// 0 = bbox точно по границе, >0 = вылез. Используется в live-логике
// textbox, чтобы не дёргать scale при микро-выходах меньше TOL_PX.
function overflowByAxisMax(obj, plate) {
    const b = obj.getBoundingRect(true, true);
    let dx = 0, dy = 0;
    if (b.left < plate.left) dx = Math.max(dx, plate.left - b.left);
    else if (b.left + b.width > plate.right) {
        dx = Math.max(dx, b.left + b.width - plate.right);
    }
    if (b.top < plate.top) dy = Math.max(dy, plate.top - b.top);
    else if (b.top + b.height > plate.bottom) {
        dy = Math.max(dy, b.top + b.height - plate.bottom);
    }
    return Math.max(dx, dy);
}

/**
 * Live-уменьшение scale для textbox при включённом clamp.
 *
 * При object:resizing (боковые ручки ml/mr через Fabric changeWidth)
 * wrap пересчитывает height → bbox может вылезти за plate.
 * Уменьшаем scaleX=scaleY=ratio пропорционально через бинарный поиск
 * fitScaleForCurrentPosition (как в rotation-логике). textbox визуально
 * сжимается равномерно по обеим осям.
 *
 * Подавление дребезга wrap'а:
 *   • TOL_PX (5 px bbox) — если bbox вылез меньше чем на TOL_PX, не
 *     трогаем scale (подавляет subpixel-rounding при пересечении границы).
 *   • STABLE_PX (6 px bbox.bottom) — если bbox.bottom изменился меньше
 *     чем на STABLE_PX между тиками, это дрожание wrap'а между N и
 *     N+1 строками; возвращаемся к зафиксированному __stableScale.
 *     Реальный переход добавляет целую строку (~25px) и не подавляется.
 *   • HYSTERESIS (0.5%) — подавляет шум бинарного поиска.
 *
 * Snapshot: на первом тике запоминаем __scaleOriginal = {scaleX, scaleY,
 * left, top}. Шаг 0: если при orig.scaleX bbox влезает в plate с
 * TOL_PX допуском — возвращаем scale и позицию к оригиналу.
 */
function clampTextboxScaleLiveToPlate(obj, plate) {
    const HYSTERESIS = 0.005;
    const TOL_PX = 5;
    const STABLE_PX = 6;
    obj.setCoords();
    if (obj.__scaleOriginal === undefined) {
        obj.__scaleOriginal = {
            scaleX: obj.scaleX || 1,
            scaleY: obj.scaleY || 1,
            left: obj.left,
            top: obj.top
        };
        obj.__stableScale = obj.scaleX || 1;
        obj.__stableBboxBottom = obj.getBoundingRect(true, true).bottom;
    }
    const orig = obj.__scaleOriginal;
    const currentScale = obj.scaleX || 1;
    const currentBottom = obj.getBoundingRect(true, true).bottom;

    // Шаг 0. Узкий участок пройден — возвращаем scaleX=scaleY к оригиналу.
    if (currentScale < orig.scaleX - HYSTERESIS
        && fitsAtOriginalScaleWithTolerance(obj, orig, plate, TOL_PX)) {
        obj.set({
            scaleX: orig.scaleX,
            scaleY: orig.scaleY,
            left: orig.left,
            top: orig.top
        });
        obj.setCoords();
        obj.__stableScale = orig.scaleX;
        obj.__stableBboxBottom = obj.getBoundingRect(true, true).bottom;
        return;
    }

    // Антидребезг wrap'а.
    if (Math.abs(currentBottom - obj.__stableBboxBottom) < STABLE_PX
        && obj.__stableScale < orig.scaleX - HYSTERESIS) {
        const stableRatio = obj.__stableScale / (obj.scaleX || 1);
        if (Math.abs(stableRatio - 1) > HYSTERESIS) {
            obj.set({
                scaleX: obj.__stableScale,
                scaleY: obj.__stableScale,
                left: orig.left,
                top: orig.top
            });
            obj.setCoords();
        }
        return;
    }

    // Шаг 1. Уменьшаем scaleX=scaleY пропорционально.
    if (overflowByAxisMax(obj, plate) <= TOL_PX) {
        return;
    }
    const ratio = fitScaleForCurrentPosition(obj, plate, orig.scaleX);
    if (Math.abs(ratio - currentScale) > HYSTERESIS) {
        obj.set({
            scaleX: ratio,
            scaleY: ratio
        });
        obj.setCoords();
        obj.__stableScale = ratio;
        obj.__stableBboxBottom = obj.getBoundingRect(true, true).bottom;
    }
}


/**
 * Создаёт 4 чёрных прямоугольника по периметру frontRect:
 *   - верхняя полоса: y ∈ [0, frontRect.top]
 *   - нижняя полоса: y ∈ [frontRect.bottom, PLATE_H]
 *   - левая полоса: x ∈ [0, frontRect.left], y ∈ [frontRect.top, frontRect.bottom]
 *   - правая полоса: x ∈ [frontRect.right, PLATE_W], y ∈ [frontRect.top, frontRect.bottom]
 * При 'cover' они лежат поверх всех объектов и скрывают только то,
 * что вылезает за frontRect. Сама плашка остаётся видимой.
 */
function buildFrameStrips(canvas, PLATE_W, PLATE_H, frontRect) {
    const strips = [];
    const fx = frontRect.left;
    const fy = frontRect.top;
    const fw = frontRect.width;
    const fh = frontRect.height;

    const makeStrip = (left, top, width, height) => new fabric.Rect({
        left,
        top,
        width,
        height,
        fill: '#000000',
        selectable: false,
        evented: false,
        excludeFromExport: true,
        hoverCursor: 'default',
        __frameStrip: true
    });

    // Верхняя полоса
    if (fy > 0) strips.push(makeStrip(0, 0, PLATE_W, fy));
    // Нижняя полоса
    const bottomStart = fy + fh;
    if (bottomStart < PLATE_H) strips.push(makeStrip(0, bottomStart, PLATE_W, PLATE_H - bottomStart));
    // Левая полоса (только на высоте плашки)
    if (fx > 0) strips.push(makeStrip(0, fy, fx, fh));
    // Правая полоса
    const rightStart = fx + fw;
    if (rightStart < PLATE_W) strips.push(makeStrip(rightStart, fy, PLATE_W - rightStart, fh));

    for (const strip of strips) {
        strip.set({ visible: false });
        canvas.add(strip);
    }
    return strips;
}

function bringStripsToFront(canvas) {
    if (!frameStrips) return;
    for (const strip of frameStrips) {
        canvas.bringToFront(strip);
    }
}

/**
 * Инициализация: создаёт 4 overlay-полосы (если их ещё нет) и подписывается
 * на object:moving для clamp. По умолчанию полосы скрыты (clamp-режим).
 */
export function initFrameOverlay(canvas, PLATE_W, PLATE_H, scaledInnerRadius, frontRect) {
    if (!frameStrips) {
        frameStrips = buildFrameStrips(canvas, PLATE_W, PLATE_H, frontRect);
    }
    // Полосы всегда на самом верху z-стека.
    bringStripsToFront(canvas);

    // Clamp-режим: при moving клампим объект в frontRect.
    const plate = {
        left: frontRect.left,
        top: frontRect.top,
        right: frontRect.left + frontRect.width,
        bottom: frontRect.top + frontRect.height
    };
    // Границы всего канваса — для проверки «крупный ли объект» при
    // повороте: если bbox > canvas хотя бы по одной оси, чистый сдвиг
    // не помогает (начнётся дребезг между тиками), нужно уменьшать scale.
    const canvasBounds = {
        left: 0,
        top: 0,
        right: PLATE_W,
        bottom: PLATE_H
    };
    canvas.on('object:moving', (e) => {
        // Режим 'clamp' активен по умолчанию; в 'cover' clamp отключён.
        if (currentMode !== 'clamp') return;
        const obj = e.target;
        if (!obj || obj.__guide || obj.__frameStrip || obj.__isFrontRect) return;
        clampObjectToPlate(obj, plate);
    });

    // Блокируем увеличение объекта за якорями так, чтобы bbox не вылезал
    // за frontRect. В 'cover'-режиме clamp отключён → объект можно
    // свободно растягивать (вылезающее скрывается за чёрными полосами).
    //
    // Для textbox используем live-уменьшение (по аналогии с rotation) —
    // стоп-кран не справляется, потому что при сужении ширины scaleX
    // меняется высота (добавляются строки wrap'а), bbox может
    // скачкообразно вылезти за plate, и откат к scaleCap оставит
    // позицию textbox'а неподвижной → противоположная грань уйдёт
    // за границу. Для остальных объектов (логотипы, изображения)
    // стоп-кран работает корректно — bbox меняется плавно.
    //
    // Угловые ручки textbox'а (tl/tr/bl/br) по-прежнему используют
    // SCALING (scalingEqually) — там wrap не меняется (width и height
    // остаются прежними, меняется только scale), и стоп-кран
    // работает корректно. Для них оставляем прежнее поведение.
    //
    // Только боковые ручки textbox'а через RESIZING (changeWidth →
    // объект:resizing) ловят новой live-логикой
    // (clampTextboxScaleLiveToPlate).
    canvas.on('object:scaling', (e) => {
        if (currentMode !== 'clamp') return;
        const obj = e.target;
        if (!obj || obj.__guide || obj.__frameStrip || obj.__isFrontRect) return;
        clampObjectScaleToPlate(obj, plate);
    });
    canvas.on('object:resizing', (e) => {
        if (currentMode !== 'clamp') return;
        const obj = e.target;
        if (!obj || obj.__guide || obj.__frameStrip || obj.__isFrontRect) return;
        if (obj.type === 'textbox') {
            clampTextboxScaleLiveToPlate(obj, plate);
        }
    });

    // Clamp при повороте: удерживаем bbox внутри frontRect. Если объект
    // вылезает — равномерно уменьшаем scale (позицию не двигаем, чтобы
    // не было «прыжков» вокруг центра plate). Запоминаем scale и позицию
    // начала поворота, чтобы вернуть их, когда объект снова впишется в
    // plate (например, прошёл 90°-узкий участок при повороте длинного
    // текстбокса с 0° на 180°).
    canvas.on('object:rotating', (e) => {
        if (currentMode !== 'clamp') return;
        const obj = e.target;
        if (!obj || obj.__guide || obj.__frameStrip || obj.__isFrontRect) return;
        if (!obj.__rotationOriginal) {
            obj.__rotationOriginal = {
                scaleX: obj.scaleX || 1,
                scaleY: obj.scaleY || 1,
                left: obj.left,
                top: obj.top
            };
        }
        clampObjectRotationToPlate(obj, plate, canvasBounds, true);
    });

    // Конец любого драга — финальный кламп позиции (во время вращения
    // мы её не двигали, чтобы не дребезжать) и сброс кешей.
    canvas.on('object:modified', () => {
        if (currentMode !== 'clamp') return;
        const obj = canvas.getActiveObject();
        if (!obj || obj.__guide || obj.__frameStrip || obj.__isFrontRect) return;
        // Финальный сдвиг в plate — один раз, без дребезга (драг уже
        // завершён, никаких новых тиков не будет).
        clampObjectToPlate(obj, plate);
        obj.setCoords();
        delete obj.__scaleCap;
        delete obj.__rotationOriginal;
        if (obj.type === 'textbox') {
            delete obj.__scaleOriginal;
            delete obj.__stableScale;
            delete obj.__stableBboxBottom;
        }
    });

    // После добавления нового объекта (логотип, текстбокс) — полосы
    // должны снова оказаться наверху.
    canvas.on('object:added', (e) => {
        const obj = e.target;
        if (!obj || !frameStrips) return;
        if (obj.__frameStrip) return;
        bringStripsToFront(canvas);
    });

    return frameStrips;
}

/**
 * Переключает режим рамки:
 *   'clamp' — clamp включён, полосы скрыты (по умолчанию).
 *   'cover' — clamp выключен, полосы видны поверх объектов.
 */
export function setFrameMode(canvas, mode) {
    currentMode = mode === 'cover' ? 'cover' : 'clamp';
    if (frameStrips) {
        const visible = currentMode === 'cover';
        for (const strip of frameStrips) {
            strip.set({ visible });
        }
        if (visible) bringStripsToFront(canvas);
        canvas.requestRenderAll();
    }
}

export function getFrameMode() {
    return currentMode;
}