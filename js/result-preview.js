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
    // Полная реализация появится в Task 2. Сейчас — заглушка, чтобы можно было подключить файлы.
    return Promise.resolve({ sent: false });
}
