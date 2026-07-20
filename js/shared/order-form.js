// ============================================
// ФОРМА ЗАКАЗА
// ============================================
// Модалка с формой (имя, контакт, комментарий). После «Подтвердить» модалка
// закрывается сразу, resolve возвращает данные формы. Никакого success-state
// внутри — благодарность и контакты производителя показываются отдельно в
// thanks-modal (js/thanks-modal.js), открываемой из back.html.
//
// В модалке есть вторая кнопка «Подтвердить (тест)» — заглушка для отладки:
// резолвит форму так же, как и обычное «Подтвердить», но в payload добавляет
// флаг __test. Вызывающий код в back.html проверяет флаг и пропускает
// sendMaketToTelegram — данные не уходят в Telegram-бота, но thanks-модалка
// открывается как при обычном успехе. Это позволяет отлаживать поведение
// модалок (preview → thanks) без боевых запросов.
//
// openOrderForm() → Promise<{ name, contact, comment, __test?: boolean } | null>
//   resolve({...})         — пользователь нажал «Подтвердить»
//   resolve({__test: true, ...}) — пользователь нажал «Подтвердить (тест)»
//   resolve(null)          — пользователь закрыл модалку (Cancel / Esc / клик вне)

export function openOrderForm() {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'rp-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Оформление заказа');

        const windowEl = document.createElement('div');
        windowEl.className = 'rp-window of-window';

        const modal = document.createElement('div');
        modal.className = 'rp-modal of-modal';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'rp-close';
        closeBtn.setAttribute('aria-label', 'Закрыть');
        closeBtn.textContent = '✕';
        modal.appendChild(closeBtn);

        // Шапка формы с заголовком и подсказкой
        const header = document.createElement('div');
        header.className = 'of-header';
        const title = document.createElement('h2');
        title.className = 'of-title';
        title.textContent = 'Оформление заказа';
        const subtitle = document.createElement('p');
        subtitle.className = 'of-subtitle';
        subtitle.textContent = 'Все поля необязательные — заполните их, если хотите оставить пожелания или контакт для связи с производителем';
        const hint = document.createElement('p');
        hint.className = 'of-subtitle of-subtitle--hint';
        // Подсказка поясняет, что произойдёт после клика — иначе кнопка
        // «Подтвердить» выглядит абстрактной. «Задание» — слово из лексикона
        // производителя (заказ-наряд); можно поменять, если не подходит.
        hint.textContent = 'Ваш заказ отправится производителю после нажатия «Подтвердить».';
        header.appendChild(title);
        header.appendChild(subtitle);
        header.appendChild(hint);
        modal.appendChild(header);

        // Форма с тремя полями
        const form = document.createElement('form');
        form.className = 'of-form';
        form.noValidate = true;

        const fName = makeField({
            label: 'Как к вам обращаться',
            name: 'name',
            placeholder: 'Иван',
            autocomplete: 'given-name',
            maxlength: 80,
            required: false,
        });
        const fContact = makeField({
            label: 'Контакт (Telegram)',
            name: 'contact',
            placeholder: '@username или телефон',
            autocomplete: 'off',
            maxlength: 120,
            required: false,
        });
        const fComment = makeTextarea({
            label: 'Комментарий',
            name: 'comment',
            placeholder: 'Пожелания, что доделать или переделать…',
            maxlength: 800,
        });

        form.appendChild(fName.wrap);
        form.appendChild(fContact.wrap);
        form.appendChild(fComment.wrap);
        modal.appendChild(form);

        // Кнопки в нижней секции
        const actions = document.createElement('div');
        actions.className = 'rp-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'rp-btn rp-btn--secondary';
        cancelBtn.textContent = 'Отмена';
        const submitBtn = document.createElement('button');
        // type="button" — submit не сработает, потому что кнопка лежит ВНЕ
        // формы (форма в .rp-modal, actions — отдельный блок в .rp-window).
        // Обработчик вешаем напрямую через addEventListener ниже.
        submitBtn.type = 'button';
        submitBtn.className = 'rp-btn rp-btn--primary';
        submitBtn.textContent = 'Подтвердить';
        actions.appendChild(cancelBtn);
        actions.appendChild(submitBtn);

        // Тестовая кнопка-заглушка: имитирует успешную отправку без ухода
        // данных в Telegram-бот. Полезна, чтобы отладить поток модалок
        // (preview → order → thanks), не дёргая реальный sendMaketToTelegram
        // и не засоряя прод-бота тестовыми заказами.
        //
        // СКРЫТА ПО УМОЛЧАНИЮ: появляется только если на body есть класс
        // «debug» (выставляется через `window.__enableDebugButtons()` или
        // алиас `debug()` в консоли). Так обычные пользователи её не
        // видят, а разработчик может быстро включить одной командой.
        const debugEnabled = document.body.classList.contains('debug');
        let testBtn = null;
        if (debugEnabled) {
            testBtn = document.createElement('button');
            testBtn.type = 'button';
            testBtn.className = 'rp-btn rp-btn--test';
            testBtn.textContent = 'Подтвердить (тест)';
            // Вставляем перед submit, чтобы порядок был: Отмена · Тест · Подтвердить
            actions.insertBefore(testBtn, submitBtn);
        }

        windowEl.appendChild(modal);
        windowEl.appendChild(actions);
        overlay.appendChild(windowEl);

        // ============================================================
        // Состояние: форма → success
        // ============================================================
        let resolved = false;
        function finish(value) {
            if (resolved) return;
            resolved = true;
            document.removeEventListener('keydown', onKey);
            overlay.remove();
            resolve(value);
        }

        // ============================================================
        // Обработчики
        // ============================================================
        function onKey(e) {
            if (e.key === 'Escape') finish(null);
        }
        document.addEventListener('keydown', onKey);

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) finish(null);
        });
        closeBtn.addEventListener('click', () => finish(null));
        cancelBtn.addEventListener('click', () => finish(null));

        form.addEventListener('submit', (e) => {
            // На случай, если submit всё-таки сработает (например, Enter в поле)
            // — глушим нативный submit, чтобы страница не перезагрузилась.
            e.preventDefault();
        });

        // Кнопка «Подтвердить» лежит ВНЕ формы (actions — отдельный блок
        // в .rp-window), поэтому submit через HTML5 не сработает. Вешаем
        // обработчик напрямую на кнопку.
        function collect() {
            return {
                name: fName.input.value.trim(),
                contact: fContact.input.value.trim(),
                comment: fComment.input.value.trim(),
            };
        }
        submitBtn.addEventListener('click', () => {
            submitBtn.disabled = true;
            cancelBtn.disabled = true;
            if (testBtn) testBtn.disabled = true;
            finish(collect());
        });

        // Тестовая кнопка: резолвит так же, как и «Подтвердить», но с
        // флагом __test. back.html увидит флаг и пропустит
        // sendMaketToTelegram, оставив только открытие thanks-модалки —
        // этого достаточно для отладки UX-потока. Обработчик вешаем
        // только если кнопка реально создана (см. выше — кнопка скрыта
        // по умолчанию, появляется через `debug` в консоли).
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                submitBtn.disabled = true;
                cancelBtn.disabled = true;
                testBtn.disabled = true;
                finish({ ...collect(), __test: true });
            });
        }

        document.body.appendChild(overlay);

        // Фокус на первое поле
        setTimeout(() => fName.input.focus(), 0);
    });
}

function makeField({ label, name, placeholder, autocomplete, maxlength, required = false }) {
    const wrap = document.createElement('label');
    wrap.className = 'of-field';
    const lab = document.createElement('span');
    lab.className = 'of-field__label';
    lab.textContent = label;
    if (maxlength) {
        const counter = document.createElement('span');
        counter.className = 'of-field__counter';
        counter.textContent = '0/' + maxlength;
        lab.appendChild(counter);
    }
    if (required) {
        const star = document.createElement('span');
        star.className = 'of-field__required';
        star.setAttribute('aria-hidden', 'true');
        star.textContent = '*';
        lab.appendChild(star);
    }
    const input = document.createElement('input');
    input.className = 'of-field__input';
    input.type = 'text';
    input.name = name;
    input.placeholder = placeholder;
    if (maxlength) input.maxLength = maxlength;
    if (autocomplete) input.autocomplete = autocomplete;
    if (required) input.required = true;
    wrap.appendChild(lab);
    wrap.appendChild(input);
    if (maxlength) {
        input.addEventListener('input', () => {
            lab.querySelector('.of-field__counter').textContent = input.value.length + '/' + maxlength;
        });
    }
    return { wrap, input };
}

function makeTextarea({ label, name, placeholder, maxlength }) {
    const wrap = document.createElement('label');
    wrap.className = 'of-field';
    const lab = document.createElement('span');
    lab.className = 'of-field__label';
    lab.textContent = label;
    const input = document.createElement('textarea');
    input.className = 'of-field__textarea';
    input.name = name;
    input.placeholder = placeholder;
    input.rows = 3;
    if (maxlength) {
        const counter = document.createElement('span');
        counter.className = 'of-field__counter';
        counter.textContent = '0/' + maxlength;
        lab.appendChild(counter);
        input.maxLength = maxlength;
        input.addEventListener('input', () => {
            counter.textContent = input.value.length + '/' + maxlength;
        });
    }
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return { wrap, input };
}