window.merlinI18n.register({
    ptbr: {
        service_status_normal: 'Serviços normais',
        service_status_badge: 'Serviço instável',
        service_status_title: 'Serviço Merlin instável',
        service_status_message: 'O serviço online do Merlin falhou em duas verificações seguidas. Algumas funções que dependem dele podem ficar indisponíveis.',
        service_status_hint: 'Erros isolados continuam sendo mostrados na própria tela da função.',
        service_status_acknowledge: 'Entendi'
    },
    en: {
        service_status_normal: 'Services normal',
        service_status_badge: 'Service issue',
        service_status_title: 'Merlin service is unstable',
        service_status_message: 'The Merlin online service failed two consecutive health checks. Some features that depend on it may be unavailable.',
        service_status_hint: 'Isolated feature errors are still shown on that feature’s screen.',
        service_status_acknowledge: 'Understood'
    },
    es: {
        service_status_normal: 'Servicios normales',
        service_status_badge: 'Servicio inestable',
        service_status_title: 'El servicio Merlin está inestable',
        service_status_message: 'El servicio en línea de Merlin falló dos verificaciones de salud consecutivas. Algunas funciones que dependen de él podrían no estar disponibles.',
        service_status_hint: 'Los errores aislados de una función siguen apareciendo en su propia pantalla.',
        service_status_acknowledge: 'Entendido'
    },
    fr: {
        service_status_normal: 'Services normaux',
        service_status_badge: 'Service instable',
        service_status_title: 'Le service Merlin est instable',
        service_status_message: 'Le service en ligne de Merlin a échoué à deux vérifications consécutives. Certaines fonctions qui en dépendent peuvent être indisponibles.',
        service_status_hint: 'Les erreurs isolées restent affichées sur l’écran de la fonction concernée.',
        service_status_acknowledge: 'Compris'
    },
    de: {
        service_status_normal: 'Dienste normal',
        service_status_badge: 'Dienst gestört',
        service_status_title: 'Der Merlin-Dienst ist instabil',
        service_status_message: 'Der Merlin-Onlinedienst hat zwei aufeinanderfolgende Statusprüfungen nicht bestanden. Einige davon abhängige Funktionen sind möglicherweise nicht verfügbar.',
        service_status_hint: 'Einzelfehler werden weiterhin direkt auf dem jeweiligen Funktionsbildschirm angezeigt.',
        service_status_acknowledge: 'Verstanden'
    }
});

(() => {
    const HEALTH_CHECK_URL = 'https://generator.ryuu.lol/api/health';
    const HEALTH_CHECK_INTERVAL_MS = 120000;
    const HEALTH_CHECK_TIMEOUT_MS = 5000;
    const HEALTH_CHECK_RETRY_DELAY_MS = 1500;
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

    function waitForRetry() {
        return new Promise(resolve => window.setTimeout(resolve, HEALTH_CHECK_RETRY_DELAY_MS));
    }

    function isHealthy(payload) {
        return payload
            && payload.status === 'ok'
            && payload.downloads_available === true;
    }

    async function checkHealthOnce() {
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
                return false;
            }

            const payload = await response.json();
            return isHealthy(payload);
        } catch (_) {
            return false;
        } finally {
            if (timeoutId) window.clearTimeout(timeoutId);
        }
    }

    async function checkHealth() {
        if (await checkHealthOnce()) {
            clear('service-health');
            return;
        }

        // A single timeout or lost packet should not trigger a global warning.
        await waitForRetry();
        if (await checkHealthOnce()) {
            clear('service-health');
            return;
        }

        report('service-health');
    }

    window.merlinServiceStatus = {
        markServiceResponsive() {
            clear('service-health');
        }
    };

    function startLegacyMonitor() {
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
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (window.electronAPI?.serviceStatusV1?.enabled && window.merlinStatusV1) {
            void window.merlinStatusV1.start(window.electronAPI.serviceStatusV1.apiBaseUrl).then(started => {
                if (!started) startLegacyMonitor();
            }).catch(startLegacyMonitor);
        } else startLegacyMonitor();
    });
})();
