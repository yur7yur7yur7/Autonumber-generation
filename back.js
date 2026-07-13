// back.js — загрузка фонового изображения images/back.png как фона СТРАНИЦЫ (body)
// (фон под канвой fabric НЕ ставится — пользователь явно попросил не дублировать)
(function () {
    'use strict';

    const BACK_IMAGE_URL = 'images/back.png';

    /**
     * Ставит images/back.png как background-image на document.body.
     * Идемпотентно: при повторном вызове просто переприменяет CSS.
     */
    function applyBackToBody() {
        const url = `url("${BACK_IMAGE_URL}")`;
        Object.assign(document.body.style, {
            backgroundImage: url,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center center',
            backgroundSize: 'cover',
            backgroundAttachment: 'fixed',
            backgroundColor: '#f0f0f0' // fallback на случай ошибки загрузки
        });
    }

    // Старый алиас оставлен для обратной совместимости с уже закоммиченными вызовами.
    // Ничего не делает — фон канвы НЕ ставится (идемпотентный no-op).
    function applyBackBackground(/* canvas */) {
        // Намеренно пусто: фон под канвой fabric не нужен.
        applyBackToBody();
        return Promise.resolve();
    }

    // Экспорт
    window.applyBackToBody = applyBackToBody;
    window.applyBackBackground = applyBackBackground;
})();
