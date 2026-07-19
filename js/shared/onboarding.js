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
            target: null,
            title: 'Здесь две кнопки',
            body: '«Номер РФ» — открыть редактор и сделать брелок ' +
                  'с нуля. «Загрузить макет» — если у вас уже есть ' +
                  'готовый файл, брелок сразу откроется с вашими ' +
                  'настройками.',
        },
        {
            target: '[href$="back.html"]:not([href*="autoload"])',
            title: 'Сделать брелок с нуля',
            body: 'Нажмите «Номер РФ» — откроется редактор: ' +
                  'номер, регион, задняя сторона брелка с подписью. ' +
                  'Когда будете готовы — нажмите «Посмотреть результат».',
        },
        {
            target: '[href*="autoload"]',
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
            target: '#front-panel',
            title: 'Флажок и точки по бокам',
            body: 'В этой панели две кнопки-тумблера. «Российский ' +
                  'флаг» — добавляет маленький триколор на номер. ' +
                  '«Точки по бокам» — добавляет круглые точки, ' +
                  'как на настоящем номере. Включайте и выключайте ' +
                  'как вам нравится.',
        },
        {
            target: '#front-advanced-panel',
            title: 'Точная подстройка',
            body: 'Эти ползунки двигают надпись RUS, флаг, цифры ' +
                  'номера и региона и меняют ширину зон. Пользоваться ' +
                  'не обязательно — только если расположение по ' +
                  'умолчанию вас не устраивает.',
        },
        {
            target: '#history-controls',
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
            target: null,
            title: 'Задняя сторона',
            body: 'Здесь — подпись и логотипы. Надпись по центру ' +
                  'уже добавлена — это пример. Можно её оставить, ' +
                  'отредактировать или добавить новые надписи ' +
                  'другим шрифтом.',
        },
        {
            target: '#font-toggle',
            title: 'Изменить шрифт',
            body: 'Кнопка «✎ Текст» на экране открывает панель ' +
                  'со шрифтами. Нажмите на понравившийся — ' +
                  'по центру появится новая надпись этим шрифтом. ' +
                  'Старые надписи при этом не меняются — их можно ' +
                  'удалить отдельно.',
        },
        {
            target: '#logo-toggle',
            title: 'Добавить логотип',
            body: 'Кнопка «☰ Логотипы» открывает каталог значков ' +
                  'марок. Можно искать через строку поиска. ' +
                  'Выберите картинку — она появится на брелке ' +
                  'и её можно поставить в любое место.',
        },
        {
            target: null,
            title: 'Перетащить, покрутить, изменить размер',
            body: 'Любой объект на брелке можно тащить мышкой или ' +
                  'пальцем. Чтобы покрутить — потяните за маленькую ' +
                  'круглую иконку над объектом (поворот шагом 15°). ' +
                  'Чтобы изменить размер — потяните за углы ' +
                  'синей рамки вокруг объекта.',
        },
        {
            target: null,
            title: 'Привязка к центру и краям',
            body: 'Когда двигаете объект — появляются розовые ' +
                  'линии, которые показывают, где сейчас края или ' +
                  'центры относительно других объектов и самого ' +
                  'брелка. Это удобно для выравнивания. Отключить ' +
                  'можно в «⚙ Настройки» — тумблер «Положение».',
        },
        {
            target: null,
            title: 'Удалить, поменять цвет или поворот',
            body: 'Кликните по любому объекту на брелке — вокруг ' +
                  'него появится синяя рамка. На ней будут три ' +
                  'иконки: крестик справа (удалить), кружок ' +
                  'сверху (покрутить), три точки слева (меню). ' +
                  'Меню открывает «Удалить», «Выровнять поворот ' +
                  '(0°)» и — только для надписей — выбор цвета ' +
                  'текста. Углы рамки — растянуть или сжать объект.',
        },
        {
            target: '#snap-toggle',
            title: 'Настройки и удаление',
            body: 'Кнопка «⚙ Настройки» открывает панель: в разделе ' +
                  '«Фон» можно выбрать однотонный цвет или градиент ' +
                  'из двух цветов и задать его направление. Ниже можно ' +
                  'включить и выключить привязку к положению и подсказки, ' +
                  'а также удалить выделенный объект.',
        },
        {
            target: '#history-controls',
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

function buildOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
        <div class="ob-backdrop"></div>
        <div class="ob-card">
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

function setSpotlight(target) {
    const currentlyLit = document.querySelector('.ob-spotlight');
    if (currentlyLit === target) return;
    document.querySelectorAll('.ob-spotlight').forEach((el) => {
        el.classList.remove('ob-spotlight');
    });
    if (target) target.classList.add('ob-spotlight');
}

function renderStep() {
    const overlay = document.getElementById('onboarding-overlay');
    const steps = STEPS[currentSide];
    if (!steps || steps.length === 0) {
        closeGuide();
        return;
    }
    const step = steps[currentStep];
    overlay.querySelector('.ob-step-indicator').textContent =
        `Шаг ${currentStep + 1} из ${steps.length}`;
    overlay.querySelector('.ob-title').textContent = step.title;
    overlay.querySelector('.ob-body').textContent = step.body;
    const target = step.target
        ? document.querySelector(step.target)
        : null;
    setSpotlight(target);
    overlay.querySelector('.ob-prev').disabled = currentStep === 0;
    const nextBtn = overlay.querySelector('.ob-next');
    if (currentStep === steps.length - 1) {
        nextBtn.textContent = 'Готово';
    } else {
        nextBtn.textContent = 'Дальше →';
    }
}

function closeGuide() {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.remove();
    setSpotlight(null);
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
        if (e.target.classList.contains('ob-backdrop')) closeGuide();
        if (e.target.classList.contains('ob-close')) closeGuide();
        if (e.target.classList.contains('ob-skip')) closeGuide();
        if (e.target.classList.contains('ob-prev') && currentStep > 0) {
            currentStep -= 1;
            renderStep();
        }
        if (e.target.classList.contains('ob-next')) {
            const steps = STEPS[currentSide];
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

    const observer = new MutationObserver(() => {
        const steps = STEPS[currentSide];
        if (!steps) return;
        const step = steps[currentStep];
        const currentlyLit = document.querySelector('.ob-spotlight');
        if (!step || !step.target) {
            if (currentlyLit) setSpotlight(null);
            return;
        }
        const el = document.querySelector(step.target);
        if (el && el.offsetParent !== null) {
            if (currentlyLit !== el) setSpotlight(el);
        } else {
            if (currentlyLit) setSpotlight(null);
        }
    });
    observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
    });
    currentObserver = () => observer.disconnect();

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
