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

    const tpl = document.createElement('img');
    tpl.className = 'rp-template';
    tpl.src = 'images/template.png';
    tpl.alt = 'Шаблон брелка';
    modal.appendChild(tpl);

    const hint = document.createElement('div');
    hint.className = 'rp-hint';
    hint.textContent = 'Так будет выглядеть твой брелок';
    modal.appendChild(hint);

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

    modal.appendChild(actions);
    overlay.appendChild(modal);

    return { overlay, modal, close, sendBtn, cancelBtn };
}

/**
 * Открывает модалку предпросмотра. Принимает готовые PNG-снимки плашек.
 * backDataURL === null → нижний карман — заглушка, кнопка «Отправить на печать» отключена.
 * onSendToPrint — async callback, вызывается при клике на «Отправить на печать».
 * Возвращает Promise, который резолвится в { sent: boolean } после закрытия модалки.
 */
export function openResultPreview({ frontDataURL, backDataURL, onSendToPrint }) {
    return new Promise((resolve) => {
        const { overlay, close, sendBtn, cancelBtn } = buildModalMarkup();
        const modal = overlay.querySelector('.rp-modal');

        // Слой передней стороны.
        const front = document.createElement('img');
        front.className = 'rp-layer';
        front.style.setProperty('--rp-layer-x', 'var(--rp-front-x)');
        front.style.setProperty('--rp-layer-y', 'var(--rp-front-y)');
        front.style.setProperty('--rp-layer-w', 'var(--rp-front-w)');
        front.style.setProperty('--rp-layer-h', 'var(--rp-front-h)');
        front.src = frontDataURL;
        front.alt = 'Передняя сторона';
        modal.appendChild(front);

        // Слой задней стороны или заглушка.
        if (backDataURL) {
            const back = document.createElement('img');
            back.className = 'rp-layer';
            back.style.setProperty('--rp-layer-x', 'var(--rp-back-x)');
            back.style.setProperty('--rp-layer-y', 'var(--rp-back-y)');
            back.style.setProperty('--rp-layer-w', 'var(--rp-back-w)');
            back.style.setProperty('--rp-layer-h', 'var(--rp-back-h)');
            back.src = backDataURL;
            back.alt = 'Задняя сторона';
            modal.appendChild(back);
            sendBtn.disabled = false;
        } else {
            const stub = document.createElement('div');
            stub.className = 'rp-layer rp-layer--missing';
            stub.style.setProperty('--rp-layer-x', 'var(--rp-back-x)');
            stub.style.setProperty('--rp-layer-y', 'var(--rp-back-y)');
            stub.style.setProperty('--rp-layer-w', 'var(--rp-back-w)');
            stub.style.setProperty('--rp-layer-h', 'var(--rp-back-h)');
            stub.textContent = 'Открой редактор задней стороны (test.html)';
            modal.appendChild(stub);
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
