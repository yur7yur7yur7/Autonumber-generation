// js/onboarding.js
//
// In-app onboarding guide для back.html. In-app overlay со списком шагов
// по работе с редактором: ввод номера → тоглы → расширенные настройки →
// side-toggle → задняя сторона → конфиг → отправка.
//
// Глобального экспорта не делаем — повесим startGuide() на window,
// чтобы back.html мог запускать его из inline-модуля.

const STEPS = [
    {
        // Шаг 1 — общий (без target): общая подсветка всего холста.
        target: null,
        title: 'Введите номер и регион',
        body: 'Вверху над плашкой — поле ввода. ' +
              'Первые 6 символов — буквы и цифры номера (кириллица ' +
              'транслитерируется автоматически), после них — код региона, ' +
              '2–3 цифры. Можно копировать и вставлять целиком.',
    },
];

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

// Текущий индекс шага — глобальная переменная модуля.
let currentStep = 0;
let open = false;

function setSpotlight(target) {
    // Удаляем старую подсветку.
    document.querySelectorAll('.ob-spotlight').forEach((el) => {
        el.classList.remove('ob-spotlight');
    });
    if (target) target.classList.add('ob-spotlight');
}

function renderStep() {
    const overlay = document.getElementById('onboarding-overlay');
    const step = STEPS[currentStep];
    overlay.querySelector('.ob-step-indicator').textContent =
        `Шаг ${currentStep + 1} из ${STEPS.length}`;
    overlay.querySelector('.ob-title').textContent = step.title;
    overlay.querySelector('.ob-body').textContent = step.body;
    const target = step.target
        ? document.querySelector(step.target)
        : null;
    setSpotlight(target);
    // Скрываем «Назад» на первом шаге и «Дальше» на последнем.
    overlay.querySelector('.ob-prev').disabled = currentStep === 0;
    const nextBtn = overlay.querySelector('.ob-next');
    if (currentStep === STEPS.length - 1) {
        nextBtn.textContent = 'Готово';
    } else {
        nextBtn.textContent = 'Дальше →';
    }
}

function closeGuide() {
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.remove();
    setSpotlight(null);
    open = false;
    currentStep = 0;
}

function startGuide() {
    if (open) return;
    open = true;
    currentStep = 0;
    const overlay = buildOverlay();
    document.body.appendChild(overlay);
    // Навешиваем обработчики ОДИН раз, чтобы не плодить listener'ы при
    // повторном открытии/закрытии.
    overlay.addEventListener('click', (e) => {
        if (e.target.classList.contains('ob-backdrop')) closeGuide();
        if (e.target.classList.contains('ob-close')) closeGuide();
        if (e.target.classList.contains('ob-skip')) closeGuide();
        if (e.target.classList.contains('ob-prev') && currentStep > 0) {
            currentStep -= 1;
            renderStep();
        }
        if (e.target.classList.contains('ob-next')) {
            if (currentStep === STEPS.length - 1) {
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
    renderStep();
}

window.startGuide = startGuide;
window.closeGuide = closeGuide;
