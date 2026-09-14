window.merlinI18n.register({
    ptbr: {
        service_status_normal: 'Serviços normais',
        service_status_badge: 'Instabilidade',
        service_status_title: 'Instabilidade temporária',
        service_status_message: 'Algumas magias do Merlin estão instáveis no momento. Buscas, ativações e correções podem falhar temporariamente.',
        service_status_hint: 'Tente novamente em instantes.',
        service_status_acknowledge: 'Entendi'
    },
    en: {
        service_status_normal: 'Services normal',
        service_status_badge: 'Instability',
        service_status_title: 'Temporary instability',
        service_status_message: 'Some Merlin features are unstable right now. Searches, activations, and corrections may fail temporarily.',
        service_status_hint: 'Please try again in a moment.',
        service_status_acknowledge: 'Understood'
    },
    es: {
        service_status_normal: 'Servicios normales',
        service_status_badge: 'Inestabilidad',
        service_status_title: 'Inestabilidad temporal',
        service_status_message: 'Algunas funciones de Merlin están inestables en este momento. Las búsquedas, activaciones y correcciones pueden fallar temporalmente.',
        service_status_hint: 'Vuelva a intentarlo en unos instantes.',
        service_status_acknowledge: 'Entendido'
    },
    fr: {
        service_status_normal: 'Services normaux',
        service_status_badge: 'Instabilité',
        service_status_title: 'Instabilité temporaire',
        service_status_message: 'Certaines fonctions de Merlin sont instables pour le moment. Les recherches, activations et correctifs peuvent échouer temporairement.',
        service_status_hint: 'Réessayez dans un instant.',
        service_status_acknowledge: 'Compris'
    },
    de: {
        service_status_normal: 'Dienste normal',
        service_status_badge: 'Instabilität',
        service_status_title: 'Vorübergehende Instabilität',
        service_status_message: 'Einige Merlin-Funktionen sind derzeit instabil. Suchen, Aktivierungen und Korrekturen können vorübergehend fehlschlagen.',
        service_status_hint: 'Bitte versuchen Sie es in einem Moment erneut.',
        service_status_acknowledge: 'Verstanden'
    }
});

(() => {
    const HEALTH_CHECK_URL = 'https://generator.ryuu.lol/api/health';
    const HEALTH_CHECK_INTERVAL_MS = 120000;
    const HEALTH_CHECK_TIMEOUT_MS = 5000;
    const issueMap = new Map();
    let hasShownModal = false;

    function t(key) {
        return window.merlinI18n?.t(key) || key;
    }

    function hasIssues() {
        return issueMap.size > 0;
    }

    function render() {
        const badge = document.getElementById('serviceStatusBadge');
        const badgeText = document.getElementById('serviceStatusBadgeText');
        const title = document.getElementById('serviceStatusTitle');
        const message = document.getElementById('serviceStatusMessage');
        const hint = document.getElementById('serviceStatusHint');
        const acknowledge = document.getElementById('serviceStatusAcknowledgeBtn');
        if (!title || !message || !hint || !acknowledge) return;

        // A healthy service deliberately has no header chip. The amber chip is
        // reserved for a real degradation, so it remains meaningful.
        if (badge) {
            const degraded = hasIssues();
            badge.hidden = !degraded;
            badge.classList.toggle('has-issues', degraded);
        }
        if (badgeText) badgeText.textContent = hasIssues() ? t('service_status_badge') : t('service_status_normal');
        title.textContent = t('service_status_title');
        message.textContent = t('service_status_message');
        hint.textContent = t('service_status_hint');
        acknowledge.textContent = t('service_status_acknowledge');
    }

    function openModal() {
        const modal = document.getElementById('serviceStatusModal');
        if (!modal || !hasIssues()) return;
        modal.hidden = false;
    }

    function closeModal() {
        const modal = document.getElementById('serviceStatusModal');
        if (!modal) return;
        modal.hidden = true;
    }

    function report(key) {
        if (!key) return;
        issueMap.set(String(key), Date.now());
        render();
        if (!hasShownModal) {
            hasShownModal = true;
            openModal();
        }
    }

    function clear(key) {
        if (!key) return;
        issueMap.delete(String(key));
        render();
        if (!hasIssues()) closeModal();
    }

    function clearAll() {
        issueMap.clear();
        render();
        closeModal();
    }

    function isHealthy(payload) {
        return payload
            && payload.status === 'ok'
            && payload.downloads_available === true;
    }

    async function checkHealth() {
        const controller = typeof AbortController === 'function'
            ? new AbortController()
            : null;
        const timeoutId = controller
            ? window.setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)
            : null;

        try {
            const response = await fetch(HEALTH_CHECK_URL, {
                cache: 'no-store',
                signal: controller?.signal
            });

            if (!response.ok) {
                report('service-health');
                return;
            }

            const payload = await response.json();
            if (isHealthy(payload)) {
                clear('service-health');
                return;
            }

            report('service-health');
        } catch (_) {
            report('service-health');
        } finally {
            if (timeoutId) window.clearTimeout(timeoutId);
        }
    }

    window.merlinServiceStatus = { report, clear, clearAll, hasIssues };

    document.addEventListener('DOMContentLoaded', () => {
        render();
        document.getElementById('serviceStatusBadge')?.addEventListener('click', openModal);
        document.getElementById('serviceStatusAcknowledgeBtn')?.addEventListener('click', closeModal);
        document.getElementById('serviceStatusCloseBtn')?.addEventListener('click', closeModal);
        document.getElementById('serviceStatusModal')?.addEventListener('click', event => {
            if (event.target === event.currentTarget) closeModal();
        });
        window.addEventListener('keydown', event => {
            const modal = document.getElementById('serviceStatusModal');
            if (event.key === 'Escape' && modal && !modal.hidden) closeModal();
        });
        window.addEventListener('merlin-language-changed', render);
        if (window.electronAPI?.qa?.simulateServiceIssue) {
            report('qa-service-health');
        } else {
            void checkHealth();
        }
        window.setInterval(() => {
            if (!window.electronAPI?.qa?.simulateServiceIssue) void checkHealth();
        }, HEALTH_CHECK_INTERVAL_MS);
    });
})();
