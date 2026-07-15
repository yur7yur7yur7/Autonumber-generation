// ============================================
// ПРЕВЬЮ МАКЕТА НА ШАБЛОНЕ БРЕЛКА
// ============================================

import { CONFIG } from './config.js';

const { CANVAS_WIDTH, CANVAS_HEIGHT } = CONFIG;

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
    // Cache-busting query: заставляет браузер загрузить свежую версию template.png,
    // а не закешированную. Иначе после правок изображения пользователь видит
    // старую раскладку карманов и плашки «не попадают» в карманы.
    tpl.src = 'images/template.png?v=' + Date.now();
    tpl.alt = 'Шаблон брелка';
    stage.appendChild(tpl);

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

    return { overlay, modal, stage, close, sendBtn, cancelBtn };
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
        const { overlay, close, sendBtn, cancelBtn, stage } = buildModalMarkup();

        // Слой передней стороны. Если передан onSelectFront — карман кликабельный,
        // после клика модалка закрывается (onClose ссылается на finish ниже —
        // function declaration поднимается, поэтому ссылка валидна к моменту
        // срабатывания обработчика).
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
    });
}
