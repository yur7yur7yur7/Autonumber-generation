// ============================================
// ПРЕВЬЮ МАКЕТА НА ШАБЛОНЕ БРЕЛКА
// ============================================

import { CONFIG } from './config.js';

const { CANVAS_WIDTH, CANVAS_HEIGHT } = CONFIG;

// ============================================
// КЕШИРОВАНИЕ TEMPLATE.PNG
// ============================================
// template.png — это статичный фон брелка (карманы для плашек).
// Раньше src собирался с cache-busting ?v=Date.now() — это обнуляло
// кеш браузера на КАЖДОМ открытии модалки и заставляло тянуть ~150KB
// по сети. Реальная причина cache-busting'а была в правках изображения
// (чтобы пользователь видел новую раскладку карманов), но на проде это
// лишний запрос — и без того браузер сам инвалидирует кеш при изменении
// файла (ETag/Last-Modified).
//
// Решение: один раз загружаем template через new Image() и сохраняем
// объект в module-level переменной. Последующие открытия модалки
// переиспользуют тот же src (браузер отдаст 304 Not Modified без
// скачивания), а в DOM мы кладём <img> с тем же src.
//
// Чтобы template начал качаться сразу при загрузке back.html, а не
// только когда пользователь жмёт «Готовлю…», стартуем загрузку на
// уровне модуля (выполнится при первом import этого файла).

const TEMPLATE_SRC = 'images/template.png';

/** @type {HTMLImageElement | null} */
let cachedTemplate = null;
/** @type {Promise<HTMLImageElement> | null} */
let loadingPromise = null;

/**
 * Возвращает Promise<HTMLImageElement> для template.png. На первом
 * вызове создаёт Image() и грузит; на последующих — мгновенно
 * резолвится из кеша. Один и тот же Image-объект переиспользуется.
 * @returns {Promise<HTMLImageElement>}
 */
export function ensureTemplate() {
    if (cachedTemplate && cachedTemplate.complete && cachedTemplate.naturalWidth > 0) {
        return Promise.resolve(cachedTemplate);
    }
    if (loadingPromise) return loadingPromise;

    const img = new Image();
    img.decoding = 'async'; // не блокируем основной поток декодированием
    loadingPromise = new Promise((resolve, reject) => {
        img.onload = () => {
            cachedTemplate = img;
            loadingPromise = null;
            resolve(img);
        };
        img.onerror = (e) => {
            // Не очищаем loadingPromise полностью — повторные вызовы
            // в течение одной сессии вернут ту же rejected-промис, и
            // UI сможет показать осмысленную ошибку. Если хочется
            // повторить — нужен отдельный `retryTemplate()`.
            reject(new Error('Не удалось загрузить template.png'));
        };
        img.src = TEMPLATE_SRC;
    });
    return loadingPromise;
}

// Стартуем загрузку сразу при импорте модуля — пока пользователь
// возится с плашкой, template уже качается в фоне. Если вкладку
// закроют до того, как template докачается, ничего не сломается —
// кеш просто не наполнится.
ensureTemplate();

/**
 * Создаёт DOM модалки: шаблон + слоты для передней/задней стороны + кнопки.
 * Возвращает корневой элемент (ещё не вставлен в документ).
 */
function buildModalMarkup() {
    const overlay = document.createElement('div');
    overlay.className = 'rp-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Предпросмотр макета');

    const modal = document.createElement('div');
    modal.className = 'rp-modal';

    // Обёртка modal + actions — одно визуальное «окно» с общей рамкой и фоном.
    const windowEl = document.createElement('div');
    windowEl.className = 'rp-window';
    windowEl.appendChild(modal);

    // rp-stage — единый контейнер для шаблона и плашек. Все размеры плашек
    // считаются от него, а не от .rp-modal с container-type — это гарантирует,
    // что карманы template.png и плашки совпадают по ширине на любом viewport.
    const stage = document.createElement('div');
    stage.className = 'rp-stage';

    const tpl = document.createElement('img');
    tpl.className = 'rp-template';
    // Без cache-busting ?v=Date.now() — template кешируется браузером
    // и переиспользуется между открытиями модалки. Загрузка
    // инициируется через ensureTemplate() на уровне модуля, как
    // только импортируется result-preview.js. Если template уже в
    // кеше — присваиваем src синхронно, onload сработает в том же
    // тике. Если нет — присваиваем src здесь, но плашки .rp-layer
    // добавляются ПОЗЖЕ (после await ensureTemplate в openResultPreview)
    // иначе они бы показывались висящими в тёмном пространстве до
    // загрузки картинки.
    tpl.src = TEMPLATE_SRC;
    tpl.alt = 'Шаблон брелка';
    // Класс .rp-template--loading держит картинку прозрачной до
    // момента, когда openResultPreview вызовет .rp-template--ready
    // (плавное появление через transition в CSS).
    tpl.classList.add('rp-template--loading');
    stage.appendChild(tpl);

    // Спиннер по центру модалки — виден, пока template не загружен.
    // Класс .loading-spinner определён локально в result-preview.css
    // (свой @keyframes spin) — не зависим от других CSS-файлов.
    const loader = document.createElement('div');
    loader.className = 'rp-loader';
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    loader.appendChild(spinner);
    stage.appendChild(loader);

    const hint = document.createElement('div');
    hint.className = 'rp-hint';
    hint.textContent = 'Так будет выглядеть ваш брелок';
    stage.appendChild(hint);

    modal.appendChild(stage);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'rp-close';
    close.setAttribute('aria-label', 'Закрыть');
    close.textContent = '✕';
    modal.appendChild(close);

    const actions = document.createElement('div');
    actions.className = 'rp-actions';

    const sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.className = 'rp-btn rp-btn--primary';
    sendBtn.textContent = 'Отправить на печать';
    actions.appendChild(sendBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'rp-btn rp-btn--secondary';
    cancelBtn.textContent = 'Закрыть';
    actions.appendChild(cancelBtn);

    windowEl.appendChild(actions);
    overlay.appendChild(windowEl);

    return { overlay, modal, stage, close, sendBtn, cancelBtn, tpl, loader };
}

/**
 * Открывает модалку предпросмотра. Принимает готовые PNG-снимки плашек.
 * backDataURL === null → нижний карман — заглушка, кнопка «Отправить на печать» отключена.
 * onSendToPrint — async callback, вызывается при клике на «Отправить на печать».
 * onSelectFront / onSelectBack — опц. колбэки, вызываемые при клике на
 *   соответствующий карман плашки. Если заданы, карман становится кликабельным
 *   (ховер, cursor:pointer, focus-ring), а сама модалка после клика закрывается.
 *   Используется, чтобы из превью сразу перейти к редактору нужной стороны.
 * Возвращает Promise, который резолвится в { sent: boolean } после закрытия модалки.
 */
function makeLayer({ src, alt, x, y, w, h, missing, onClick, onClose }) {
    // Обёртка фиксированного размера — карман. <img> внутри занимает 100% × 100%
    // с object-fit: fill, поэтому плашка физически не может вылезти за карман,
    // даже если натуральный PNG шире/уже контейнера. Это убирает баг с альбомной
    // мобильной ориентацией, где раньше <img> тянулся к натуральному размеру
    // и вылезал за правый край модалки.
    const box = document.createElement('div');
    box.className = 'rp-layer';
    box.style.setProperty('--rp-layer-x', x);
    box.style.setProperty('--rp-layer-y', y);
    box.style.setProperty('--rp-layer-w', w);
    box.style.setProperty('--rp-layer-h', h);

    if (missing) {
        box.classList.add('rp-layer--missing');
        box.textContent = 'Открой редактор задней стороны (back.html)';
    } else {
        const img = document.createElement('img');
        img.className = 'rp-layer__img';
        img.src = src;
        img.alt = alt;
        img.draggable = false;
        box.appendChild(img);
    }

    // Кликабельный карман — модификатор .rp-layer--clickable в CSS добавляет
    // pointer-events/cursor/hover. По клику/Enter сначала вызывается onClick
    // (пользовательское действие, например переключение стороны), затем onClose
    // (закрытие модалки). stopPropagation не даёт событию закрыть модалку
    // через overlay click → finish ДО того, как отработает onClick.
    if (typeof onClick === 'function') {
        box.classList.add('rp-layer--clickable');
        box.setAttribute('role', 'button');
        box.setAttribute('tabindex', '0');
        box.setAttribute(
            'aria-label',
            missing ? 'Перейти к редактору задней стороны' : 'Открыть редактор этой стороны'
        );
        const fire = () => {
            try {
                onClick();
            } finally {
                if (typeof onClose === 'function') onClose();
            }
        };
        box.addEventListener('click', (e) => {
            e.stopPropagation();
            fire();
        });
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fire();
            }
        });
    }

    return box;
}

export function openResultPreview({
    frontDataURL,
    backDataURL,
    onSendToPrint,
    onSelectFront,
    onSelectBack
}) {
    return new Promise((resolve) => {
        const { overlay, close, sendBtn, cancelBtn, stage, tpl, loader } = buildModalMarkup();

        // Плашки не добавляем в DOM сразу — иначе они будут видны висящими
        // в тёмном пространстве, пока template.png не загрузится. Ждём
        // ensureTemplate() (кеш на уровне модуля — повторные открытия
        // модалки резолвятся мгновенно), потом добавляем плашки и убираем
        // loader. Это обёрнуто в Promise.resolve().then() чтобы не
        // блокировать основной код модалки, если template уже в кеше
        // (резолв мгновенный, но всё равно асинхронный — иначе модалка
        // моргнёт «без плашек» на один кадр).

        const placeLayers = () => {
            // Слой передней стороны. Если передан onSelectFront — карман
            // кликабельный, после клика модалка закрывается (onClose
            // ссылается на finish ниже — function declaration поднимается).
            stage.appendChild(makeLayer({
                src: frontDataURL,
                alt: 'Передняя сторона',
                x: 'var(--rp-front-x)',
                y: 'var(--rp-front-y)',
                w: 'var(--rp-front-w)',
                h: 'var(--rp-front-h)',
                onClick: onSelectFront,
                onClose: finish,
            }));

            // Слой задней стороны или заглушка. onSelectBack работает в обоих
            // случаях — клик по заглушке тоже переводит в редактор задней.
            if (backDataURL) {
                stage.appendChild(makeLayer({
                    src: backDataURL,
                    alt: 'Задняя сторона',
                    x: 'var(--rp-back-x)',
                    y: 'var(--rp-back-y)',
                    w: 'var(--rp-back-w)',
                    h: 'var(--rp-back-h)',
                    onClick: onSelectBack,
                    onClose: finish,
                }));
                sendBtn.disabled = false;
            } else {
                stage.appendChild(makeLayer({
                    alt: '',
                    x: 'var(--rp-back-x)',
                    y: 'var(--rp-back-y)',
                    w: 'var(--rp-back-w)',
                    h: 'var(--rp-back-h)',
                    missing: true,
                    onClick: onSelectBack,
                    onClose: finish,
                }));
                sendBtn.disabled = true;
                sendBtn.title = 'Нужен снимок задней стороны';
            }
        };

        const onTemplateReady = () => {
            // Убираем loader и плавно проявляем template (через CSS
            // transition на .rp-template--ready). К моменту вызова
            // cachedTemplate.complete === true, так что tpl тоже уже
            // отрендерил картинку (его src указывает на тот же URL).
            if (loader.parentNode) loader.remove();
            tpl.classList.remove('rp-template--loading');
            tpl.classList.add('rp-template--ready');
            placeLayers();
        };

        let resolved = false;
        function finish(sent) {
            if (resolved) return;
            resolved = true;
            document.removeEventListener('keydown', onKey);
            overlay.remove();
            resolve({ sent });
        }

        function onKey(e) {
            if (e.key === 'Escape') finish(false);
        }
        document.addEventListener('keydown', onKey);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) finish(false);
        });
        close.addEventListener('click', () => finish(false));
        cancelBtn.addEventListener('click', () => finish(false));

        sendBtn.addEventListener('click', async () => {
            if (sendBtn.disabled) return;
            sendBtn.disabled = true;
            const original = sendBtn.textContent;
            sendBtn.textContent = '⏳ Отправка...';
            try {
                const ok = await onSendToPrint();
                finish(Boolean(ok));
            } catch (e) {
                console.error('sendToPrint failed:', e);
                sendBtn.disabled = false;
                sendBtn.textContent = '⚠️ Не отправлено';
                setTimeout(() => { sendBtn.textContent = original; }, 1800);
            }
        });

        document.body.appendChild(overlay);

        // Ждём template. Если он уже в кеше — резолв мгновенный, но всё
        // равно асинхронный (Promise.resolve().then() — микротаск).
        // На первом открытии модалки (template ещё не загружен) здесь
        // будет реальное ожидание HTTP-запроса, и loader виден всё это
        // время. Если запрос упал — показываем модалку с loader'ом и
        // текстом ошибки, плашки не появятся (но модалка откроется и
        // пользователь сможет её закрыть).
        ensureTemplate().then(onTemplateReady).catch((err) => {
            console.error('template load failed:', err);
            if (loader) {
                loader.innerHTML = '';
                const errText = document.createElement('p');
                errText.className = 'rp-loader__error';
                errText.textContent = 'Не удалось загрузить шаблон. Закройте и попробуйте ещё раз.';
                loader.appendChild(errText);
            }
            // Кнопку «Отправить» оставляем disabled — без template
            // оператору пришлют плашки без рамки.
            sendBtn.disabled = true;
            sendBtn.title = 'Шаблон не загружен';
        });
    });
}
