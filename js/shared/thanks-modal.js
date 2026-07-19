// ============================================
// МОДАЛКА БЛАГОДАРНОСТИ
// ============================================
// Показывается после успешной отправки макета. Содержит «Заказ успешно
// отправлен» + контакты производителя (Telegram сейчас, остальные —
// плейсхолдеры). Закрывается только пользователем (нет авто-закрытия,
// нет Esc).
//
// openThanksModal({ contacts, contactsIcons }) → Promise<void>
//   resolve() вызывается только когда пользователь явно нажал «Закрыть».

import { PRODUCER_CONTACTS, CONTACT_ICONS } from './contacts.js';

export function openThanksModal({ contacts = PRODUCER_CONTACTS, contactsIcons = CONTACT_ICONS } = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'rp-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Заказ отправлен');

        const windowEl = document.createElement('div');
        windowEl.className = 'rp-window tm-window';

        const modal = document.createElement('div');
        modal.className = 'rp-modal tm-modal';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'rp-close';
        closeBtn.setAttribute('aria-label', 'Закрыть');
        closeBtn.textContent = '✕';
        modal.appendChild(closeBtn);

        // Шапка
        const header = document.createElement('div');
        header.className = 'tm-header';
        const title = document.createElement('h2');
        title.className = 'tm-title';
        title.textContent = 'Заказ успешно отправлен ✨';
        const subtitle = document.createElement('p');
        subtitle.className = 'tm-subtitle';
        subtitle.textContent = 'Производитель получил ваш макет и свяжется с вами, если вы оставили контакт.';
        header.appendChild(title);
        header.appendChild(subtitle);
        modal.appendChild(header);

        // Блок контактов
        const contactsBlock = document.createElement('div');
        contactsBlock.className = 'tm-contacts';

        const contactsTitle = document.createElement('p');
        contactsTitle.className = 'tm-contacts__title';
        contactsTitle.textContent = 'Связаться с производителем:';
        contactsBlock.appendChild(contactsTitle);

        const list = document.createElement('div');
        list.className = 'tm-contacts__list';
        contactsBlock.appendChild(list);

        // Отрисовка только активных (не-null) контактов
        const SOCIAL_LABELS = {
            telegram: 'Telegram',
            whatsapp: 'WhatsApp',
            instagram: 'Instagram',
            tiktok: 'TikTok',
            vk: 'ВКонтакте',
        };
        // Контурные (stroke) иконки — отличаются от solid-fill (telegram,
        // instagram, whatsapp, vk) тем, что рисуются линиями. Для них `fill`
        // отключаем, иначе SVG не отрисует. Здесь перечисляем только те,
        // чьи пути в CONTACT_ICONS приходят из outline-наборов (Tabler).
        const STROKE_ICON_KEYS = new Set(['tiktok']);
        let hasAny = false;
        for (const [key, info] of Object.entries(contacts)) {
            if (!info) continue;
            hasAny = true;
            const a = document.createElement('a');
            a.className = `tm-contact tm-contact--${key}`;
            a.href = info.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.setAttribute('aria-label', `Открыть ${SOCIAL_LABELS[key] || key} ${info.label} в новой вкладке`);

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('aria-hidden', 'true');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            // Tabler-icons бывают solid-fill (как telegram/instagram/whatsapp/vk) и outline
            // (как brand-tiktok). Для outline на «fill» не остаётся заливки — нужно
            // переключиться на «stroke», иначе иконка не отрисуется. Какие именно
            // ключи outline — перечислим точечно через STROKE_ICON_KEYS.
            const isOutline = STROKE_ICON_KEYS.has(key);
            if (isOutline) {
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke', 'currentColor');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
            } else {
                path.setAttribute('fill', 'currentColor');
            }
            path.setAttribute('d', contactsIcons[key] || '');
            svg.appendChild(path);
            a.appendChild(svg);

            const label = document.createElement('span');
            label.className = 'tm-contact__label';
            label.textContent = SOCIAL_LABELS[key] || key;
            a.appendChild(label);

            const handle = document.createElement('span');
            handle.className = 'tm-contact__handle';
            handle.textContent = info.label;
            a.appendChild(handle);

            list.appendChild(a);
        }

        // Если вдруг все контакты null — показываем заглушку
        if (!hasAny) {
            const empty = document.createElement('p');
            empty.className = 'tm-contacts__empty';
            empty.textContent = 'Контакты скоро появятся.';
            contactsBlock.appendChild(empty);
        }

        modal.appendChild(contactsBlock);

        // Действия
        const actions = document.createElement('div');
        actions.className = 'rp-actions';
        const closeBtnBottom = document.createElement('button');
        closeBtnBottom.type = 'button';
        closeBtnBottom.className = 'rp-btn rp-btn--primary tm-close-bottom';
        closeBtnBottom.textContent = 'Закрыть';
        actions.appendChild(closeBtnBottom);

        windowEl.appendChild(modal);
        windowEl.appendChild(actions);
        overlay.appendChild(windowEl);

        let closed = false;
        function finish() {
            if (closed) return;
            closed = true;
            overlay.remove();
            resolve();
        }

        // Закрытие — только по явному действию пользователя: ✕ или «Закрыть».
        // Клик по оверлею и Esc НЕ закрывают (по требованию: модалка должна
        // висеть, пока пользователь сам не закроет). Это исключение из
        // стандартного UX-модального паттерна — намеренное.
        closeBtn.addEventListener('click', finish);
        closeBtnBottom.addEventListener('click', finish);

        document.body.appendChild(overlay);

        // Фокус на «Закрыть» — пользователь явно должен подтвердить прочтение
        setTimeout(() => closeBtnBottom.focus(), 0);
    });
}