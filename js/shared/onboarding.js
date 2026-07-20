// js/onboarding.js
//
// Простая пошаговая инструкция для пользователя — без жаргона.
// Три набора шагов: index (лендинг), front (передняя сторона),
// back (задняя сторона). API:
//   startGuide('index' | 'front' | 'back')  — открыть инструкцию
//   closeGuide()                            — закрыть текущую
//
// Файл — ES-модуль, подключается inline-импортом из index.html и
// back.html. После import'а window.startGuide / window.closeGuide
// доступны обоим страницам.

const STEPS = {
    // ====================================================================
    // ИНСТРУКЦИЯ ДЛЯ ЛЕНДИНГА (index.html)
    // ====================================================================
    index: [
        {
            target: '[href$="back.html"]:not([href*="autoload"])',
            title: 'Сделать брелок с нуля',
            body: 'Нажмите «Номер РФ» — откроется редактор: ' +
                  'номер, регион, задняя сторона брелка с подписью. ' +
                  'Когда будете готовы — нажмите «Посмотреть результат».',
        },
        {
            target: '#load-config-card',
            title: 'Загрузить готовый макет',
            body: 'Если у вас уже есть готовый брелок — нажмите ' +
                  '«Загрузить макет», выберите файл. Редактор ' +
                  'откроется сразу с вашими настройками.',
        },
    ],

    // ====================================================================
    // ИНСТРУКЦИЯ ДЛЯ ПЕРЕДНЕЙ СТОРОНЫ (back.html, активна сторона «front»)
    // ====================================================================
    front: [
        {
            target: '#frontPlateInput',
            title: 'Введите номер и регион',
            body: 'Вверху — поле ввода. Сначала напишите номер ' +
                  '(до 6 символов: буквы или цифры), потом — ' +
                  'код региона 2–3 цифры. Можно вставить всё ' +
                  'сразу через «копировать — вставить».',
        },
        {
            // Десктоп: панель #front-panel раскрыта постоянно — указываем
            // на неё (видно «Показывать флаг» / «Точки по бокам»).
            // Мобильный/альбомный ≤600h: панель свёрнута за тоглом
            // #front-toggle («⚙ Настройки») — указываем на тогл.
            target: '#front-panel',
            targetNarrow: '#front-toggle',
            title: 'Флажок и точки по бокам',
            body: 'В этой панели две кнопки-тумблера. «Российский ' +
                  'флаг» — добавляет маленький триколор на номер. ' +
                  '«Точки по бокам» — добавляет круглые точки, ' +
                  'как на настоящем номере. Включайте и выключайте ' +
                  'как вам нравится.',
        },
        {
            // Шаг A: показать тогл #front-advanced-toggle («🔧»).
            // Панель ещё свёрнута — рассказываем, что эта кнопка её откроет.
            target: '#front-advanced-toggle',
            targetNarrow: '#front-advanced-toggle',
            title: 'Точная подстройка',
            body: 'Внизу справа — кнопка с гаечным ключом «🔧». ' +
                  'По ней открывается панель расширенных настроек: ' +
                  'там можно двигать RUS, флаг, цифры номера и региона.',
        },
        {
            // Шаг B: открыть панель и выделить самую верхнюю настройку.
            // В ADVANCED_PANEL первый слайдер — RUS X. Указываем на сам
            // input ползунка (узкая зона в центре строки) — шторки вокруг
            // него будут компактные, и карточка встанет рядом. Если
            // указать на всю строку (.sp-slider-row) — шторка получается
            // слишком большой, и карточка упирается в край экрана.
            target: '#front-advanced-panel [data-slider-key="rusX"]',
            targetNarrow: '#front-advanced-panel [data-slider-key="rusX"]',
            // Открываем панель программно и обновляем иконку тогла
            // (иначе останется 🔧 при открытой панели). Возвращаем true —
            // это сигнал renderStep, что состояние панели изменилось и
            // нужно повторить placeSpotlight после завершения
            // CSS-транзишна (~250ms), иначе стрелка/шторки промажут.
            // Открываем после завершения текущего клика «Дальше».
            // Иначе мобильный document.click обработает тот же клик как
            // внешний и сразу закроет только что открытую панель.
            onEnter: () => {
                requestAnimationFrame(() => {
                    if (open && currentSide === 'front' && currentStep === 3) {
                        setFrontAdvancedPanelOpen(true);
                    }
                });
                return true;
            },
            spotlightDelay: 500,
            title: 'Ползунки и картинки',
            body: 'В каждой строке — картинка того, что настраивается, ' +
                  'и ползунок. Картинка показывает, какая часть номера ' +
                  'двигается или меняет размер; ползунок задаёт её ' +
                  'положение или ширину. Здесь выделен верхний ползунок — ' +
                  'RUS X: он двигает надпись «RUS» влево-вправо.',
        },
        {
            // Шаг C: та же кнопка теперь показывает «✕ Закрыть» (тогл
            // переключился). Панель всё ещё открыта, чтобы пользователь
            // увидел, что закрывать её нужно той же кнопкой. Закрытие
            // панели происходит на СЛЕДУЮЩЕМ шаге — это плавный переход.
            target: '#front-advanced-toggle',
            targetNarrow: '#front-advanced-toggle',
            title: 'Закрыть панель',
            body: 'Эта же кнопка «🔧» теперь превратилась в «✕» — ' +
                  'нажмите её, чтобы закрыть панель расширенных настроек. ' +
                  'Иконка переключается туда-обратно: «🔧» — закрыть, ' +
                  '«✕» — открыть.',
        },
        {
            // При появлении шага 6 закрываем расширенную панель после
            // завершения текущего клика «Дальше». На мобильном это не даёт
            // обработчикам одного события конфликтовать между собой.
            target: '#history-controls',
            onEnter: () => {
                requestAnimationFrame(() => {
                    if (open && currentSide === 'front' && currentStep === 5) {
                        setFrontAdvancedPanelOpen(false);
                        placeSpotlight();
                    }
                });
                return true;
            },
            title: 'Отменить или вернуть действие',
            body: 'Кнопки ↶ и ↷ в одном блоке отменяют последнее ' +
                  'изменение и возвращают отменённое. Они работают ' +
                  'для той стороны брелка, которая открыта сейчас. ' +
                  'На компьютере также можно нажать Ctrl+Z.',
        },
        {
            target: '#canvas-label',
            title: 'Перейти к задней стороне',
            body: 'Нажмите «🚗 Передняя сторона» вверху — ' +
                  'откроется задняя сторона брелка. Здесь можно ' +
                  'поменять подпись и добавить логотип.',
        },
        {
            target: '#create-maket',
            title: 'Отправить брелок',
            body: 'Когда всё будет готово, нажмите «Посмотреть ' +
                  'результат». Откроется окно предпросмотра: ' +
                  'если всё хорошо — нажмите «Отправить на печать», ' +
                  'заполните имя и контакт, нажмите «Подтвердить». ' +
                  'Готовый брелок уйдёт производителю.',
        },
    ],

    // ====================================================================
    // ИНСТРУКЦИЯ ДЛЯ ЗАДНЕЙ СТОРОНЫ (back.html, активна сторона «back»)
    // ====================================================================
    back: [
        {
            target: '#canvas-wrap',
            title: 'Задняя сторона',
            body: 'Здесь — подпись и логотипы. Надпись по центру ' +
                  'уже добавлена — это пример. Можно её оставить, ' +
                  'отредактировать или добавить новые надписи ' +
                  'другим шрифтом.',
        },
        {
            // Десктоп: панель #font-panel раскрыта — указываем на неё.
            // Мобильный: панель за тоглом #font-toggle («✎ Текст»).
            target: '#font-panel',
            targetNarrow: '#font-toggle',
            title: 'Изменить шрифт',
            body: 'Кнопка «✎ Текст» на экране открывает панель ' +
                  'со шрифтами. Нажмите на понравившийся — ' +
                  'по центру появится новая надпись этим шрифтом. ' +
                  'Старые надписи при этом не меняются — их можно ' +
                  'удалить отдельно.',
        },
        {
            // Десктоп: панель #logo-panel раскрыта — указываем на неё.
            // Мобильный: панель за тоглом #logo-toggle («☰ Логотипы»).
            target: '#logo-panel',
            targetNarrow: '#logo-toggle',
            title: 'Добавить логотип',
            body: 'Кнопка «☰ Логотипы» открывает каталог значков ' +
                  'марок. Можно искать через строку поиска. ' +
                  'Выберите картинку — она появится на брелке ' +
                  'и её можно поставить в любое место.',
        },
        {
            target: { fabric: 'textbox-or-image' },
            targetNarrow: { fabric: 'textbox-or-image' },
            title: 'Перетащить и изменить размер',
            body: 'Выделенный объект можно перетаскивать мышкой или ' +
                  'пальцем. Чтобы изменить размер — потяните за углы ' +
                  'рамки, которую показывает редактор.',
        },
        {
            desktopOnly: true,
            target: { fabric: 'textbox-or-image', control: 'mtr' },
            title: 'Повернуть объект',
            body: 'Круглая иконка над объектом отвечает за поворот. ' +
                  'Потяните её мышкой, чтобы повернуть объект.',
        },
        {
            desktopOnly: true,
            target: { fabric: 'textbox-or-image', control: 'delete' },
            title: 'Удалить объект',
            body: 'Крестик справа над рамкой сразу удаляет выделенную ' +
                  'надпись или картинку. Ошибочное удаление можно вернуть ' +
                  'кнопкой отмены.',
        },
        {
            desktopOnly: true,
            target: { fabric: 'textbox-or-image', control: 'menu' },
            title: 'Открыть меню объекта',
            body: 'Кнопка с тремя точками слева открывает дополнительные ' +
                  'действия для выделенного объекта.',
        },
        {
            desktopOnly: true,
            target: '#ctx-menu',
            beforeSpotlight: () => openGuideContextMenu(),
            title: 'Функции контекстного меню',
            body: 'Здесь можно удалить объект, выровнять его поворот до 0° ' +
                  'и поменять цвет надписи. Для картинок выбор цвета ' +
                  'автоматически скрывается.',
        },
        {
            mobileOnly: true,
            target: '#ctx-menu',
            beforeSpotlight: () => openGuideContextMenu(),
            title: 'Меню объекта',
            body: 'Нажмите и удерживайте объект, чтобы открыть это меню. ' +
                  'В нём можно удалить объект, выровнять поворот до 0° ' +
                  'и — для надписей — поменять цвет текста.',
        },
        {
            target: { group: [
                '#snap-panel input[name="background-type"][value="color"]',
                '#snap-panel [data-background-control="color"]'
            ] },
            snapPanelStep: true,
            opensSnapPanel: true,
            onEnter: () => {
                clearBackCanvasSelection();
                return openGuideSnapPanel();
            },
            beforeSpotlight: () => setGuideBackgroundType('color'),
            title: 'Однотонный цвет фона',
            body: 'Выберите режим «Цвет», затем нажмите на образец цвета. ' +
                  'Так можно задать один цвет для всей задней стороны.',
        },
        {
            target: { group: [
                '#snap-panel input[name="background-type"][value="gradient"]',
                '#snap-panel .sp-gradient-controls'
            ] },
            snapPanelStep: true,
            beforeSpotlight: () => setGuideBackgroundType('gradient'),
            title: 'Градиентный фон',
            body: 'В режиме «Градиент» отдельно задаются начальный и ' +
                  'конечный цвета, а также направление перехода между ними.',
        },
        {
            target: '#snap-frame',
            targetContainer: '.sp-row',
            snapPanelStep: true,
            title: 'Границы',
            body: 'Эта настройка удерживает объекты внутри плашки. ' +
                  'Отключите её, если объект должен выходить за края.',
        },
        {
            target: '#snap-position',
            targetContainer: '.sp-row',
            snapPanelStep: true,
            title: 'Положение',
            body: 'При перемещении объектов появляются линии краёв и ' +
                  'центров. Они помогают точно выровнять элементы.',
        },
        {
            target: '#snap-showHint',
            targetContainer: '.sp-row',
            snapPanelStep: true,
            title: 'Подсказки',
            body: 'Включает всплывающий текст в момент срабатывания ' +
                  'привязки к краю или центру.',
        },
        {
            target: '#history-controls',
            onEnter: () => restoreSolidBackground(),
            title: 'Отменить или вернуть действие',
            body: 'Кнопки ↶ и ↷ в одном блоке отменяют последнее ' +
                  'изменение и возвращают отменённое. Они работают ' +
                  'для той стороны брелка, которая открыта сейчас. ' +
                  'На компьютере также можно нажать Ctrl+Z.',
        },
        {
            target: '#canvas-label',
            title: 'Вернуться на переднюю сторону',
            body: 'Нажмите «🎨 Задняя сторона» вверху — откроется ' +
                  'передняя. Все изменения задней стороны сохранятся.',
        },
        {
            target: '#create-maket',
            title: 'Отправить брелок',
            body: 'Когда задняя сторона готова, нажмите «Посмотреть ' +
                  'результат» внизу экрана. В окне предпросмотра — ' +
                  'если всё хорошо — «Отправить на печать», заполните ' +
                  'имя и контакт, нажмите «Подтвердить». Готовый ' +
                  'брелок уйдёт производителю.',
        },
    ],
};

// ────── состояние текущей инструкции ────────────────────────────
let currentSide = null;
let currentStep = 0;
let open = false;
let spotlightTimer = 0;

function buildOverlay() {
    // Новый каркас: 4 «шторки» вокруг target + отдельный SVG-слой для стрелки +
    // свободно позиционируемая карточка. Никакого сплошного затемнения —
    // фон страницы виден, тёмные только шторки и сами области, куда
    // инструкция не зовёт.
    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
        <div class="ob-shade ob-shade-top"></div>
        <div class="ob-shade ob-shade-right"></div>
        <div class="ob-shade ob-shade-bottom"></div>
        <div class="ob-shade ob-shade-left"></div>
        <svg class="ob-arrow" aria-hidden="true">
            <defs>
                <marker id="ob-arrow-head" viewBox="0 0 10 10" refX="9" refY="5"
                        markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="#ef4444"/>
                </marker>
            </defs>
            <path class="ob-arrow-line" fill="none" stroke="#ef4444"
                  stroke-width="3" stroke-linecap="round"
                  marker-end="url(#ob-arrow-head)"/>
        </svg>
        <div class="ob-card" role="document">
            <header class="ob-header">
                <span class="ob-step-indicator"></span>
                <button class="ob-close" type="button" aria-label="Закрыть">×</button>
            </header>
            <h2 class="ob-title"></h2>
            <p class="ob-body"></p>
            <footer class="ob-footer">
                <button class="ob-skip" type="button">Пропустить</button>
                <div class="ob-nav">
                    <button class="ob-prev" type="button">← Назад</button>
                    <button class="ob-next" type="button">Дальше →</button>
                </div>
            </footer>
        </div>
    `;
    return overlay;
}

// Старый .ob-spotlight-класс (outline на самом элементе) оставляем как
// дополнительный визуальный ярлык. Главная «подсветка» теперь — дырка
// в шторках через 4 absolutely-позиционированных блока + рамка вокруг
// target.
function setSpotlight(target) {
    const currentlyLit = document.querySelector('.ob-spotlight');
    if (currentlyLit === target) return;
    document.querySelectorAll('.ob-spotlight').forEach((el) => {
        el.classList.remove('ob-spotlight');
    });
    document.querySelectorAll('[data-onboarding-target]').forEach((el) => {
        delete el.dataset.onboardingTarget;
    });
    if (target?.classList.contains('ob-fabric-proxy')) {
        target.dataset.onboardingTarget = 'true';
    } else if (target) {
        target.classList.add('ob-spotlight');
    }
}

// Прячем стрелку — используется, когда у шага нет target (общая подсказка
// про сцену в целом).
function hideArrow() {
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    const svg = overlay.querySelector('.ob-arrow');
    if (svg) svg.style.display = 'none';
}

// Отступ от target до края дырки — чтобы «карман» был чуть больше
// самого элемента и обводка не прилипала к шторкам.
const SPOT_PAD = 10;

// Зазор между карточкой и target (или viewport-краем).
const CARD_GAP = 16;

// Максимальная ширина/высота карточки (в vw/vh, чтобы на мобиле карточка
// не вылезала за экран даже когда target стоит у края).
const CARD_MAX_W_VW = 0.9;
const CARD_MAX_H_VH = 0.7;

// ────── placement: дырка + карточка + стрелка ────────────────────────
// Флаг reentry, чтобы MutationObserver, который срабатывает на наши же
// изменения style.cssText, не зацикливал placeSpotlight.
let placing = false;
function placeSpotlight() {
    if (placing) return;
    placing = true;
    try {
        placeSpotlightImpl();
    } finally {
        placing = false;
    }
}

function placeSpotlightImpl() {
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;
    const target = document.querySelector('.ob-spotlight, [data-onboarding-target]');
    const card = overlay.querySelector('.ob-card');
    const shades = {
        top: overlay.querySelector('.ob-shade-top'),
        right: overlay.querySelector('.ob-shade-right'),
        bottom: overlay.querySelector('.ob-shade-bottom'),
        left: overlay.querySelector('.ob-shade-left'),
    };
    const arrowSvg = overlay.querySelector('.ob-arrow');
    const arrowPath = overlay.querySelector('.ob-arrow-line');

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (!target) {
        // Шаг без target: затемняем всю страницу одной шторкой-фоном,
        // карточку центрируем, стрелку прячем.
        shades.top.style.cssText = 'left:0;top:0;width:100vw;height:100vh;';
        shades.right.style.cssText = 'display:none;';
        shades.bottom.style.cssText = 'display:none;';
        shades.left.style.cssText = 'display:none;';
        card.style.cssText = 'left:50%;top:50%;transform:translate(-50%,-50%);';
        if (arrowSvg) arrowSvg.style.display = 'none';
        return;
    }

    const rect = target.getBoundingClientRect();
    // Проекция на viewport — все наши шторки в fixed, координаты без scroll.
    const holeLeft = Math.max(0, rect.left - SPOT_PAD);
    const holeTop = Math.max(0, rect.top - SPOT_PAD);
    const holeRight = Math.min(vw, rect.right + SPOT_PAD);
    const holeBottom = Math.min(vh, rect.bottom + SPOT_PAD);
    const holeW = Math.max(0, holeRight - holeLeft);
    const holeH = Math.max(0, holeBottom - holeTop);

    // Если target за пределами viewport (например, невидимый блок) — fallback
    // к «нет target».
    if (holeW <= 0 || holeH <= 0) {
        setSpotlight(null);
        // Переразложить в режиме «нет target» — но флаг placing уже
        // поднят, повторный вызов вернётся сразу. Дождёмся следующего кадра.
        requestAnimationFrame(() => placeSpotlight());
        return;
    }

    // Шторки = 4 прямоугольника вокруг дырки.
    shades.top.style.cssText =
        `left:0;top:0;width:100vw;height:${holeTop}px;`;
    shades.right.style.cssText =
        `left:${holeRight}px;top:${holeTop}px;` +
        `width:${vw - holeRight}px;height:${holeH}px;`;
    shades.bottom.style.cssText =
        `left:0;top:${holeBottom}px;width:100vw;` +
        `height:${vh - holeBottom}px;`;
    shades.left.style.cssText =
        `left:0;top:${holeTop}px;width:${holeLeft}px;height:${holeH}px;`;

    // ── Карточка: пробуем 4 стороны от target, выбираем ту, где больше
    //    свободного места и карточка не пересечётся с дыркой.
    const cardRect = card.getBoundingClientRect();
    const cardW = Math.min(cardRect.width || 360, vw * CARD_MAX_W_VW);
    const cardH = Math.min(cardRect.height || 200, vh * CARD_MAX_H_VH);

    const spaceRight = vw - holeRight - CARD_GAP;
    const spaceLeft = holeLeft - CARD_GAP;
    const spaceBottom = vh - holeBottom - CARD_GAP;
    const spaceTop = holeTop - CARD_GAP;

    // Выбираем сторону с максимальным запасом; на узком экране
    // предпочитаем низ (там обычно меньше других элементов).
    let side = 'right';
    const maxSpace = Math.max(spaceRight, spaceLeft, spaceBottom, spaceTop);
    if (maxSpace === spaceLeft) side = 'left';
    else if (maxSpace === spaceBottom) side = 'bottom';
    else if (maxSpace === spaceTop) side = 'top';
    else side = 'right';

    // Если ни на одной стороне карточка целиком не помещается по
    // короткой оси — ставим снизу на всю ширину.
    const canFitSide =
        (side === 'right' || side === 'left') ? cardH <= vh * CARD_MAX_H_VH
        : cardW <= vw * CARD_MAX_W_VW;
    if (!canFitSide) side = 'bottom';

    // Координаты карточки. Центр target (для стрелки).
    const targetCx = (rect.left + rect.right) / 2;
    const targetCy = (rect.top + rect.bottom) / 2;

    let cardLeft, cardTop, arrowFromX, arrowFromY, arrowToX, arrowToY;

    if (side === 'right') {
        cardLeft = holeRight + CARD_GAP;
        cardTop = Math.max(CARD_GAP,
            Math.min(vh - cardH - CARD_GAP, targetCy - cardH / 2));
        // Стрелка идёт от ближнего (левого) края карточки к ближнему
        // (правому) краю target — снаружи объекта, коротким отрезком.
        // Раньше цепляли к holeLeft — на широких кнопках (Index, .format-card)
        // получалась линия через весь target.
        arrowFromX = cardLeft;
        arrowFromY = cardTop + cardH / 2;
        arrowToX = holeRight;
        arrowToY = targetCy;
        // Если карточка ушла за экран по горизонтали — сдвинуть к левому
        // краю viewport.
        if (cardLeft + cardW > vw - 4) {
            cardLeft = Math.max(4, vw - cardW - 4);
            arrowFromX = cardLeft;
        }
    } else if (side === 'left') {
        cardLeft = holeLeft - CARD_GAP - cardW;
        cardTop = Math.max(CARD_GAP,
            Math.min(vh - cardH - CARD_GAP, targetCy - cardH / 2));
        // Стрелка от правого края карточки к левому (ближнему) краю target.
        arrowFromX = cardLeft + cardW;
        arrowFromY = cardTop + cardH / 2;
        arrowToX = holeLeft;
        arrowToY = targetCy;
        if (cardLeft < 4) {
            cardLeft = 4;
            arrowFromX = cardLeft + cardW;
        }
    } else if (side === 'bottom') {
        cardLeft = Math.max(4, Math.min(vw - cardW - 4, targetCx - cardW / 2));
        cardTop = holeBottom + CARD_GAP;
        arrowFromX = cardLeft + cardW / 2;
        arrowFromY = cardTop;
        arrowToX = targetCx;
        arrowToY = holeBottom;
        if (cardTop + cardH > vh - 4) {
            cardTop = Math.max(4, vh - cardH - 4);
            arrowFromY = cardTop;
        }
    } else { // top
        cardLeft = Math.max(4, Math.min(vw - cardW - 4, targetCx - cardW / 2));
        cardTop = holeTop - CARD_GAP - cardH;
        arrowFromX = cardLeft + cardW / 2;
        arrowFromY = cardTop + cardH;
        arrowToX = targetCx;
        arrowToY = holeTop;
        if (cardTop < 4) {
            cardTop = 4;
            arrowFromY = cardTop + cardH;
        }
    }

    card.style.cssText =
        `left:${cardLeft}px;top:${cardTop}px;width:${cardW}px;` +
        `max-height:${vh * CARD_MAX_H_VH}px;transform:none;`;

    // ── Стрелка: рисуем поверх всего (z-index выше карточки).
    if (arrowSvg) {
        // Чуть-чуть не доходим до target — иначе стрелка «упирается» в
        // сам элемент и выглядит как загогулина. И аналогично с карточкой.
        const insetTo = 6;
        const insetFrom = 8;
        // Корректируем «откуда»: для top/bottom inset двигает Y, для
        // left/right — X.
        const fx = (side === 'left' || side === 'right')
            ? (side === 'left' ? arrowFromX - insetFrom : arrowFromX + insetFrom)
            : arrowFromX;
        const fy = (side === 'top' || side === 'bottom')
            ? (side === 'top' ? arrowFromY - insetFrom : arrowFromY + insetFrom)
            : arrowFromY;
        // Куда: для top/bottom не доходим до holeBottom/holeTop; для
        // left/right — не доходим до holeLeft/holeRight.
        const tx = (side === 'left') ? arrowToX + insetTo
                 : (side === 'right') ? arrowToX - insetTo
                 : arrowToX;
        const ty = (side === 'top') ? arrowToY + insetTo
                 : (side === 'bottom') ? arrowToY - insetTo
                 : arrowToY;
        arrowPath.setAttribute('d', `M ${fx} ${fy} L ${tx} ${ty}`);
        // SVG занимает весь viewport, чтобы координаты стрелки совпадали
        // с пикселями окна.
        arrowSvg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
        arrowSvg.setAttribute('width', vw);
        arrowSvg.setAttribute('height', vh);
        arrowSvg.style.cssText =
            `display:block;position:fixed;left:0;top:0;` +
            `width:${vw}px;height:${vh}px;` +
            `pointer-events:none;z-index:1001;`;
    }
}

// Тот же media-query, что и в остальном проекте (см. css/back-background-panel.css
// и snap-panel.js): ≤768px или альбомный ≤600px по высоте — узкий layout
// (панели свёрнуты за тоглом). На десктопе панели раскрыты постоянно,
// и в онбординге мы указываем на сами панели, а не на тогл.
const NARROW_MQL = '(max-width: 768px), (orientation: landscape) and (max-height: 600px)';
function isNarrowLayout() {
    return window.matchMedia(NARROW_MQL).matches;
}

// ────── fabric target resolver ────────────────────────────────────
// Для шагов, которые должны указывать на конкретный объект на
// fabric.Canvas (текстбокс, логотип, …) — `setActiveObject` создаёт
// голубую рамку Fabric, а прокси-div с viewport-координатами объекта
// становится target для шторок/карточки/стрелки онбординга.
//
// На каждом вызове удаляем предыдущий прокси, чтобы DOM не
// накапливался.
let fabricProxyEl = null;
function clearFabricProxy() {
    if (fabricProxyEl && fabricProxyEl.parentNode) {
        fabricProxyEl.parentNode.removeChild(fabricProxyEl);
    }
    fabricProxyEl = null;
}

function createOnboardingProxy(rect, className = 'ob-fabric-proxy') {
    clearFabricProxy();
    const div = document.createElement('div');
    div.className = className;
    div.style.cssText =
        `position:fixed;left:${rect.left}px;top:${rect.top}px;` +
        `width:${rect.width}px;height:${rect.height}px;` +
        `pointer-events:none;z-index:1;`;
    document.body.appendChild(div);
    fabricProxyEl = div;
    return div;
}

function pickDomGroupTarget(selectors) {
    const elements = selectors
        .map((selector) => document.querySelector(selector))
        .filter((element) => element && element.getClientRects().length);
    if (!elements.length) return null;
    if (isNarrowLayout()) {
        elements[elements.length - 1].scrollIntoView({ block: 'nearest' });
    }
    const rects = elements.map((element) => {
        const target = element.closest('label') || element;
        return target.getBoundingClientRect();
    });
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return createOnboardingProxy({
        left,
        top,
        width: right - left,
        height: bottom - top
    });
}

// Стратегии для pickFabricTarget:
//   'textbox-or-image'  — сначала текстбокс, иначе первый Image, иначе null
//   'textbox-only'      — только текстбокс, иначе null
//   'image-only'        — только Image, иначе null
//   'any'               — первый пользовательский объект (не frontRect,
//                          не clamp-полосы, не frame-strips)
function fabricObjectViewportRect(obj) {
    if (!obj || !obj.canvas) return null;
    const canvas = obj.canvas;
    const el = canvas.getElement();
    if (!el) return null;
    const elRect = el.getBoundingClientRect();
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const b = obj.getBoundingRect(true, true);
    const left = elRect.left + vpt[4] + b.left * zoom;
    const top = elRect.top + vpt[5] + b.top * zoom;
    return {
        left, top,
        width: b.width * zoom,
        height: b.height * zoom
    };
}

function fabricControlViewportRect(obj, controlName) {
    const canvas = obj?.canvas;
    const control = obj?.controls?.[controlName];
    if (!canvas || !control) return null;
    const elRect = canvas.getElement().getBoundingClientRect();
    const zoom = canvas.getZoom();
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    const localPoint = new fabric.Point(
        control.x * obj.width + (control.offsetX || 0),
        control.y * obj.height + (control.offsetY || 0)
    );
    const worldPoint = fabric.util.transformPoint(localPoint, obj.calcTransformMatrix());
    const size = Math.max(control.sizeX || 26, control.sizeY || 26) * zoom;
    return {
        left: elRect.left + vpt[4] + worldPoint.x * zoom - size / 2,
        top: elRect.top + vpt[5] + worldPoint.y * zoom - size / 2,
        width: size,
        height: size
    };
}

function isUserObject(obj) {
    // Исключаем служебные объекты Fabric-сцены.
    if (!obj) return false;
    if (obj.__isFrontRect) return false;
    if (obj.__frameStrip) return false;
    if (obj.excludeFromExport) return false;
    return true;
}

function pickFabricTarget(strategy, controlName = null) {
    const canvas = window.__backCanvas;
    if (!canvas || typeof canvas.getObjects !== 'function') return null;
    const objs = canvas.getObjects().filter(isUserObject);
    let chosen = null;
    if (strategy === 'textbox-or-image') {
        chosen = objs.find((o) => o.type === 'textbox')
              || objs.find((o) => o.type === 'image')
              || null;
    } else if (strategy === 'textbox-only') {
        chosen = objs.find((o) => o.type === 'textbox') || null;
    } else if (strategy === 'image-only') {
        chosen = objs.find((o) => o.type === 'image') || null;
    } else if (strategy === 'any') {
        chosen = objs[0] || null;
    }
    if (!chosen) return null;
    // Подсветить объект синей рамкой Fabric (это рендерится внутри canvas,
    // шторки не закрывают — будет видно через «карман»).
    try {
        canvas.setActiveObject(chosen);
        canvas.requestRenderAll && canvas.requestRenderAll();
    } catch (_e) { /* no-op */ }
    // Прокси-div с viewport-координатами объекта, чтобы шторки
    // обходили именно его.
    const r = controlName
        ? fabricControlViewportRect(chosen, controlName)
        : fabricObjectViewportRect(chosen);
    if (!r) return null;
    return createOnboardingProxy(r);
}

// Выбираем target в зависимости от ширины. У шага может быть
//   target        — десктоп/по умолчанию (на что указываем стрелкой)
//   targetNarrow  — узкий layout (мобильный/альбомный)
//   fabricTarget  — функция/стратегия для fabric-объектов
//
// Значения target могут быть:
//   - null               — шаг без указания (карточка по центру)
//   - '#selector'        — обычный CSS-селектор DOM-элемента
//   - { fabric: '...' }  — вызов pickFabricTarget(...)
//
// Если указан только один из target/targetNarrow — используется в обоих
// режимах (старое поведение, обратная совместимость).
function resolveTargetValue(raw, targetContainer = null) {
    if (raw == null) return null;
    let target = null;
    if (typeof raw === 'string') {
        target = document.querySelector(raw);
    } else if (typeof raw === 'object' && raw.fabric) {
        target = pickFabricTarget(raw.fabric, raw.control || null);
    } else if (typeof raw === 'object' && Array.isArray(raw.group)) {
        target = pickDomGroupTarget(raw.group);
    }
    if (targetContainer && target?.closest) {
        return target.closest(targetContainer) || target;
    }
    return target;
}

// ────── Front-advanced panel: программное открытие/закрытие ────────────
// createFrontSliderPanel рисует иконку тогла (🔧/✕) только в ответ на
// клик (через свою локальную renderToggle). Если мы сами меняем класс
// .fp-open (например, в onEnter шага 4/6), иконка тогла остаётся
// прежней. Этот хелпер делает обе вещи синхронно: класс + иконка.
// Возвращает true, если панель реально перешла из одного состояния
// в другое — renderStep использует это, чтобы запланировать повторный
// placeSpotlight после завершения CSS-транзишна (transform: translateY,
// ~250ms).
const FRONT_ADVANCED_CLOSE_ICON_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<line x1="6" y1="6" x2="18" y2="18"/>' +
    '<line x1="6" y1="18" x2="18" y2="6"/></svg>';
function setFrontAdvancedPanelOpen(isOpen) {
    const panel = document.getElementById('front-advanced-panel');
    const toggleBtn = document.getElementById('front-advanced-toggle');
    if (!panel || !toggleBtn) return false;
    const hadOpen = panel.classList.contains('fp-open');
    if (isOpen === hadOpen) return false;
    if (isOpen) panel.classList.add('fp-open');
    else panel.classList.remove('fp-open');
    // Перерисовать иконку тогла под актуальное состояние. На
    // advanced-панели используется иконочный режим (toggleIconSvg='🔧'):
    // при открытии — крестик (CLOSE_ICON_SVG), при закрытии — 🔧.
    // createFrontSliderPanel делает то же самое при клике, но на
    // программное изменение .fp-open оно не реагирует. Не сохраняем
    // оригинальный innerHTML — иконка всегда выставляется явно под
    // текущее состояние, чтобы быть синхронной с .fp-open даже после
    // пользовательских кликов во время гайда.
    if (isOpen) {
        toggleBtn.innerHTML =
            '<span class="tg-icon" aria-hidden="true">' +
            FRONT_ADVANCED_CLOSE_ICON_SVG + '</span>';
    } else {
        // Исходный 🔧 (эмодзи wrench). createFrontSliderPanel рендерит
        // его обёрнутым в <span class="tg-icon">.
        toggleBtn.innerHTML =
            '<span class="tg-icon" aria-hidden="true">🔧</span>';
    }
    return true;
}

function hideGuideContextMenu() {
    const menu = document.getElementById('ctx-menu');
    if (!menu) return;
    menu.classList.remove('cm-show');
    menu.setAttribute('aria-hidden', 'true');
}

function openGuideContextMenu() {
    if (!open || currentSide !== 'back') return false;
    const canvas = window.__backCanvas;
    let active = canvas?.getActiveObject();
    if (!active) {
        active = canvas?.getObjects().find(isUserObject) || null;
        if (active) canvas.setActiveObject(active);
    }
    if (!active || typeof window.__showContextMenu !== 'function') return false;
    const r = fabricControlViewportRect(active, 'menu')
        || fabricObjectViewportRect(active);
    if (!r) return false;
    window.__showContextMenu(r.left + r.width / 2, r.top + r.height / 2);
    canvas.requestRenderAll?.();
    return true;
}

function clearBackCanvasSelection() {
    const canvas = window.__backCanvas;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.requestRenderAll?.();
}

function openGuideSnapPanel() {
    if (!isNarrowLayout()) return false;
    const panel = document.getElementById('snap-panel');
    const toggle = document.getElementById('snap-toggle');
    if (!panel || panel.classList.contains('sp-open')) return false;
    requestAnimationFrame(() => {
        if (!open || currentSide !== 'back') return;
        panel.classList.add('sp-open');
        if (toggle) toggle.textContent = '✕ Закрыть';
    });
    return true;
}

function setGuideBackgroundType(backgroundType) {
    const input = document.querySelector(
        `#snap-panel input[name="background-type"][value="${backgroundType}"]`
    );
    if (!input || input.checked) return false;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

function restoreSolidBackground() {
    const input = document.querySelector(
        '#snap-panel input[name="background-type"][value="color"]'
    );
    if (!input || input.checked) return false;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
}

function closeGuideSnapPanel() {
    if (!isNarrowLayout()) return;
    const panel = document.getElementById('snap-panel');
    const toggle = document.getElementById('snap-toggle');
    panel?.classList.remove('sp-open');
    if (toggle) toggle.textContent = '⚙ Настройки';
}

function getVisibleSteps(side) {
    const narrow = isNarrowLayout();
    return (STEPS[side] || []).filter((step) => {
        if (step.desktopOnly && narrow) return false;
        if (step.mobileOnly && !narrow) return false;
        return true;
    });
}

function pickStepTarget(step) {
    if (!step) return null;
    const isNarrow = isNarrowLayout();
    const raw = isNarrow
        ? (step.targetNarrow ?? step.target ?? step.fabricTarget)
        : (step.target ?? step.targetNarrow ?? step.fabricTarget);
    return resolveTargetValue(raw, step.targetContainer || null);
}

function renderStep() {
    const overlay = document.getElementById('onboarding-overlay');
    const steps = getVisibleSteps(currentSide);
    if (!steps || steps.length === 0) {
        closeGuide();
        return;
    }
    const step = steps[currentStep];
    if (step.target !== '#ctx-menu') hideGuideContextMenu();
    if (!step.snapPanelStep) closeGuideSnapPanel();
    overlay.querySelector('.ob-step-indicator').textContent =
        `Шаг ${currentStep + 1} из ${steps.length}`;
    overlay.querySelector('.ob-title').textContent = step.title;
    overlay.querySelector('.ob-body').textContent = step.body;
    // Side-effect для шага (например, открыть/закрыть панель перед
    // показом карточки). Вызывается ДО расчёта target — чтобы DOM
    // уже был в нужном состоянии к моменту querySelector.
    let layoutChanged = false;
    if (typeof step.onEnter === 'function') {
        try {
            layoutChanged = step.onEnter(currentSide, step) === true;
        } catch (_e) { /* no-op */ }
    }
    const renderSide = currentSide;
    const renderStepIndex = currentStep;
    clearTimeout(spotlightTimer);
    spotlightTimer = 0;

    const showSpotlight = () => {
        if (!open || currentSide !== renderSide || currentStep !== renderStepIndex) return;
        if (typeof step.beforeSpotlight === 'function') {
            try { step.beforeSpotlight(currentSide, step); } catch (_e) { /* no-op */ }
        }
        const target = pickStepTarget(step);
        if (step.snapPanelStep && target && isNarrowLayout()) {
            target.scrollIntoView({ block: 'nearest' });
        }
        setSpotlight(target);
        if (!target) hideArrow();
        if (typeof step.afterSpotlight === 'function') {
            try { step.afterSpotlight(currentSide, step); } catch (_e) { /* no-op */ }
        }
        requestAnimationFrame(() => placeSpotlight());
    };

    const spotlightDelay = step.spotlightDelay
        || (step.opensSnapPanel && isNarrowLayout() ? 500 : 0);
    if (spotlightDelay) {
        setSpotlight(null);
        hideArrow();
        requestAnimationFrame(() => placeSpotlight());
        spotlightTimer = setTimeout(showSpotlight, spotlightDelay);
    } else {
        showSpotlight();
    }
    // Если onEnter изменил состояние панели, после её CSS-транзишна
    // повторно сверяем конечную геометрию уже установленной подсветки.
    if (layoutChanged && !spotlightDelay) {
        spotlightTimer = setTimeout(() => {
            if (open && currentSide === renderSide && currentStep === renderStepIndex) {
                placeSpotlight();
            }
        }, 320);
    }
    overlay.querySelector('.ob-prev').disabled = currentStep === 0;
    const nextBtn = overlay.querySelector('.ob-next');
    if (currentStep === steps.length - 1) {
        nextBtn.textContent = 'Готово';
    } else {
        nextBtn.textContent = 'Дальше →';
    }
}

function closeGuide() {
    clearTimeout(spotlightTimer);
    spotlightTimer = 0;
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.remove();
    setSpotlight(null);
    clearFabricProxy();
    hideGuideContextMenu();
    // Если гайд закрыли посреди шага B (панель открыта), а шаг C
    // не успел её закрыть — закрываем здесь, чтобы экран вернулся
    // в нормальное состояние.
    const advPanel = document.getElementById('front-advanced-panel');
    if (advPanel && advPanel.classList.contains('fp-open')) {
        advPanel.classList.remove('fp-open');
    }
    if (typeof currentObserver === 'function') {
        try { currentObserver(); } catch (_e) {}
        currentObserver = null;
    }
    open = false;
}

let currentObserver = null;

function startGuide(side) {
    if (!STEPS[side] || STEPS[side].length === 0) return;
    if (open && currentSide === side) {
        currentStep = 0;
        renderStep();
        return;
    }
    if (open) closeGuide();

    open = true;
    currentSide = side;
    currentStep = 0;

    const overlay = buildOverlay();
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        // Клик по любой шторке = закрыть.
        if (e.target.classList.contains('ob-shade')) closeGuide();
        if (e.target.classList.contains('ob-close')) closeGuide();
        if (e.target.classList.contains('ob-skip')) closeGuide();
        if (e.target.classList.contains('ob-prev') && currentStep > 0) {
            const steps = getVisibleSteps(currentSide);
            if (steps[currentStep]?.snapPanelStep && steps[currentStep - 1]?.snapPanelStep) {
                e.stopPropagation();
            }
            currentStep -= 1;
            renderStep();
        }
        if (e.target.classList.contains('ob-next')) {
            const steps = getVisibleSteps(currentSide);
            if (steps[currentStep]?.snapPanelStep && steps[currentStep + 1]?.snapPanelStep) {
                e.stopPropagation();
            }
            if (currentStep === steps.length - 1) {
                closeGuide();
            } else {
                currentStep += 1;
                renderStep();
            }
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && open) closeGuide();
    });

    overlay.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;
        const focusables = Array.from(overlay.querySelectorAll(
            'button, [href], input, [tabindex]:not([tabindex="-1"])'
        )).filter((el) => !el.disabled && el.offsetParent !== null);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    });
    const firstFocusable = overlay.querySelector('button:not(:disabled)');
    if (firstFocusable) firstFocusable.focus();

    // Resize/scroll — переразложить шторки, карточку и стрелку. Используем
    // passive-слушатели; rAF-обёртка, чтобы не пересчитывать чаще
    // одного кадра.
    //
    // MutationObserver здесь намеренно НЕ подключаем: на тяжёлой странице
    // back.html любая правка inline-style (а мы их делаем постоянно —
    // shades.top.style.cssText = ...) триггерит observer, который снова
    // зовёт placeSpotlight, который снова меняет style — браузер
    // тратил всё время на перекомпоновку и UI зависал. Шаги меняются
    // только по кликам prev/next, renderStep() уже вызывает
    // placeSpotlight через rAF — этого достаточно.
    let raf = 0;
    const onLayout = () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            // При смене ширины viewport (поворот, ресайз окна) мог
            // измениться и выбор target (target ↔ targetNarrow).
            const steps = getVisibleSteps(currentSide);
            if (steps && steps[currentStep]) {
                const newTarget = pickStepTarget(steps[currentStep]);
                const currentLit = document.querySelector('.ob-spotlight, [data-onboarding-target]');
                if (newTarget !== currentLit) {
                    setSpotlight(newTarget);
                    if (!newTarget) hideArrow();
                }
            }
            placeSpotlight();
        });
    };
    window.addEventListener('resize', onLayout, { passive: true });
    window.addEventListener('scroll', onLayout, { passive: true });
    // ResizeObserver на сам target — нужен, чтобы дырка и стрелка
    // пересчитались, когда target меняет размер (например, snap-панель
    // раскрылась/схлопнулась).
    const ro = new ResizeObserver(onLayout);
    const liveTarget = () => document.querySelector('.ob-spotlight, [data-onboarding-target]');
    if (liveTarget()) ro.observe(liveTarget());

    currentObserver = () => {
        window.removeEventListener('resize', onLayout);
        window.removeEventListener('scroll', onLayout);
        ro.disconnect();
        if (raf) cancelAnimationFrame(raf);
    };

    renderStep();
}

function shouldAutoShow(side) {
    const key = `brelok-onboarding-${side}-seen`;
    try {
        return localStorage.getItem(key) !== '1';
    } catch (_e) {
        return false;
    }
}

function markSeen(side) {
    const key = `brelok-onboarding-${side}-seen`;
    try { localStorage.setItem(key, '1'); } catch (_e) {}
}

const originalClose = closeGuide;
closeGuide = function () {
    if (currentSide) markSeen(currentSide);
    originalClose();
};

window.startGuide = startGuide;
window.closeGuide = closeGuide;
window.shouldAutoShowGuide = shouldAutoShow;
