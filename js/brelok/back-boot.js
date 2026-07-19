// ============================================================
// Главный bootstrap для back.html: создаёт fabric.Canvas, монтирует
// frontRect, инициализирует все панели/обработчики, ставит дефолтную
// подпись, открывает BroadcastChannel для editor.html.
// Подключается из <script type="module"> в back.html.
// ============================================================

import { startPreloader } from './back-loader.js';
import { initRotateHint } from './rotate-hint.js';
import { initContextMenu } from './context-menu.js';
import { initSelectionStyle, styleNewObject } from './selection-style.js';
import { snapState, attachSmartGuides, resnapGuidesToViewport } from './smart-guides.js';
import { attachSnapPanel } from './snap-panel.js';
import { initLogoPanel } from './logo-panel.js';
import { initFontPanel, addTextWithFont, FONT_OPTIONS } from './font-panel.js';
import { initEmojiHint } from './emoji-hint.js';
import { attachRearChannel } from './rear-channel.js';
import { initFrameOverlay } from './clamp-objects.js';
import { initFinalActions } from './final-actions.js';
import { initGuide } from './back-guide.js';

const PLATE_W = 1224;
const PLATE_H = 252;
const SCALE_FACTOR = PLATE_W / 720;
const SETTINGS_MARGIN = 7;
const SETTINGS_INNER_RADIUS = 18;

const scaledMargin = SETTINGS_MARGIN * SCALE_FACTOR;
const scaledInnerRadius = SETTINGS_INNER_RADIUS * SCALE_FACTOR;

// ----------------------------------------------------------------
// Прелоадер + rotate-hint — стартуем ДО создания fabric.Canvas, чтобы
// спиннер висел пока инициализируется сцена.
// ----------------------------------------------------------------
startPreloader();
initRotateHint();

// ----------------------------------------------------------------
// fabric.Canvas — единый для всей сцены.
// ----------------------------------------------------------------
const canvas = new fabric.Canvas('c', {
    backgroundColor: '#000000',
    preserveObjectStacking: true,
    clipPath: new fabric.Rect({
        left: 0,
        top: 0,
        width: PLATE_W,
        height: PLATE_H,
        rx: scaledInnerRadius,
        ry: scaledInnerRadius,
        absolutePositioned: true
    })
});
window.__backCanvas = canvas;

// ----------------------------------------------------------------
// frontRect — белый прямоугольник под номер+регион. Лежит в самом
// низу z-стека, selectable:false, помечен __isFrontRect для сериализатора.
// ----------------------------------------------------------------
const topMargin = scaledMargin + 1;
const bottomMargin = scaledMargin + 2;
const frontRect = new fabric.Rect({
    left: scaledMargin,
    top: topMargin,
    width: PLATE_W - (scaledMargin * 2),
    height: PLATE_H - topMargin - bottomMargin,
    fill: '#ffffff',
    rx: scaledInnerRadius,
    ry: scaledInnerRadius,
    selectable: false,
    evented: false,
    __isFrontRect: true
});
canvas.add(frontRect);

// ----------------------------------------------------------------
// Контекстное меню (ПКМ / долгий тап).
// ----------------------------------------------------------------
initContextMenu(canvas);

// ----------------------------------------------------------------
// Стилизация выделения + кастомный mtr + delete/menu.
// Принимает onMenuClick — клик по иконочной кнопке «menu» открывает
// контекстное меню (см. context-menu.js).
// ----------------------------------------------------------------
function openMenuAt(x, y) {
    const active = canvas.getActiveObject();
    if (!active) return;
    // Делегируем контекстному меню через общее событие: вызываем showContextMenu
    // из context-menu.js. Сам показ инкапсулирован в initContextMenu,
    // здесь дёргаем глобально: создаём объект Menu API прямо из fabric.
    // Чтобы не дублировать код, используем window-фабрику.
    if (typeof window.__showContextMenu === 'function') {
        window.__showContextMenu(x, y);
    }
}
initSelectionStyle(canvas, {
    onMenuClick: openMenuAt,
    snapState
});
// Делаем showContextMenu доступным для иконочной кнопки menu.
// Чтобы не плодить дубль, initContextMenu уже подвязал обработчики;
// даём внешний хук через клик по виртуальной точке.
canvas.__requestContextMenu = openMenuAt;

// ----------------------------------------------------------------
// Smart guides + snap-панель.
// ----------------------------------------------------------------
attachSmartGuides(canvas, PLATE_W, PLATE_H);
attachSnapPanel(canvas, frontRect);

// ----------------------------------------------------------------
// Режим рамки: clamp (по умолчанию) — объекты внутри плашки; cover —
// рамка поверх всего. Управляется тоглом «Границы» в snap-панели
// (см. snap-panel.js + clamp-objects.js).
// ----------------------------------------------------------------
initFrameOverlay(canvas, PLATE_W, PLATE_H, scaledInnerRadius, frontRect);

// ----------------------------------------------------------------
// Fit canvas to viewport — реагирует на resize/orientationchange,
// сохраняет пропорции 1224×252, дополнительно сжимает frontCanvas
// в мобильном ландшафте.
// ----------------------------------------------------------------
const FRONT_LANDSCAPE_SHRINK = 0.8;
function fitCanvasToViewport() {
    const wrap = document.getElementById('canvas-wrap');
    if (!wrap) return;
    const isNarrow = window.matchMedia('(max-width: 768px), (orientation: landscape) and (max-height: 600px)').matches;
    const isLandscapeMobile = window.matchMedia('(orientation: landscape) and (max-height: 600px)').matches;
    const reservedBottom = isNarrow ? 80 : 0;
    const reservedTop = isNarrow ? 24 : 0;
    const availW = Math.max(160, wrap.clientWidth);
    const availH = Math.max(120, window.innerHeight - reservedTop - reservedBottom);
    const scale = Math.min(
        availW / PLATE_W,
        availH / PLATE_H,
        isNarrow ? 1 : 1.5
    );
    const displayW = Math.max(160, Math.floor(PLATE_W * scale));
    const displayH = Math.max(40, Math.floor(PLATE_H * scale));
    canvas.setDimensions({ width: displayW, height: displayH }, { cssOnly: false });
    canvas.setZoom(displayW / PLATE_W);
    resnapGuidesToViewport(canvas, PLATE_W, PLATE_H);
    canvas.requestRenderAll();
    const frontCanvas = document.getElementById('frontCanvas');
    if (frontCanvas) {
        const shrink = isLandscapeMobile ? FRONT_LANDSCAPE_SHRINK : 1;
        const frontW = Math.floor(displayW * shrink);
        const frontH = Math.floor(displayH * shrink);
        frontCanvas.style.width = frontW + 'px';
        frontCanvas.style.height = frontH + 'px';
    }
}
window.addEventListener('resize', fitCanvasToViewport);
setTimeout(fitCanvasToViewport, 0);

// ----------------------------------------------------------------
// back.js — фон body. Вызываем applyBackToBody ради idempotency,
// хотя inline CSS уже задаёт background-image на body.
// ----------------------------------------------------------------
window.applyBackToBody?.();

// ----------------------------------------------------------------
// Emoji-hint + панель логотипов + панель шрифтов.
// ----------------------------------------------------------------
initEmojiHint(canvas);
initLogoPanel(canvas, PLATE_W, PLATE_H, frontRect);
initFontPanel(canvas, frontRect).then(() => {
    // Дефолтная подпись при загрузке — после того как панель шрифтов
    // прогрела font-faces (await в initFontPanel).
    const defaultFont = FONT_OPTIONS.find((f) => f.name === 'Everlasting')
        || FONT_OPTIONS[FONT_OPTIONS.length - 1];
    addTextWithFont(canvas, frontRect, defaultFont, { fontSize: 56, width: 720 });
});

// ----------------------------------------------------------------
// BroadcastChannel для editor.html.
// ----------------------------------------------------------------
attachRearChannel();

// ----------------------------------------------------------------
// Финальный пересчёт размеров после построения сцены.
// ----------------------------------------------------------------
requestAnimationFrame(fitCanvasToViewport);
window.addEventListener('load', fitCanvasToViewport);
canvas.requestRenderAll();

// ----------------------------------------------------------------
// Инициализация тоггла передней/задней стороны — динамический
// импорт модуля side-toggle.js (сам подтянет drawing-front.js + utils).
// ----------------------------------------------------------------
import('./side-toggle.js').then(({ initSideToggle }) => {
    initSideToggle({
        canvas,
        sideLabel: document.getElementById('canvas-label'),
        frontCanvas: document.getElementById('frontCanvas'),
        frontCanvasWrap: document.getElementById('front-canvas-wrap'),
        frontPlateInput: document.getElementById('frontPlateInput'),
        getFrontRect: () => frontRect,
        fitCanvasToViewport
    });
});

// ----------------------------------------------------------------
// Действия пользователя: create-maket / debug / config импорт-экспорт /
// onboarding гайд. Делаем доступной initConfigFile через
// window.__importConfigFile, чтобы при необходимости UI-кнопка могла
// переиспользовать.
// ----------------------------------------------------------------
initFinalActions();
window.__importConfigFile = (file) => import('./final-actions.js').then((m) => m.importConfigFile(file));
initGuide();

// Экспорт для отладки / тестов.
export { canvas, frontRect, fitCanvasToViewport };