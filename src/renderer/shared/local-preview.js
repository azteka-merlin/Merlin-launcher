(() => {
    const isLocalBrowserPreview = !window.electronAPI?.auth
        && ['localhost', '127.0.0.1'].includes(window.location.hostname);

    if (!isLocalBrowserPreview) return;

    document.addEventListener('DOMContentLoaded', () => {
        const settingsView = document.getElementById('settingsView');
        const settingsMainView = document.getElementById('settingsMainView');
        if (settingsView && settingsMainView) settingsMainView.appendChild(settingsView);

        const routes = {
            home: { button: 'homeNavBtn', view: 'homeView' },
            'add-games': { button: 'addGamesNavBtn', view: 'addGamesView' },
            library: { button: 'libraryBtn', view: 'libraryView' },
            corrections: { button: 'correctionsBtn', view: 'correctionsView' },
            premium: { button: 'premiumBtn', view: 'premiumView' },
            access: { button: 'accessNavBtn', view: 'accessView' },
            settings: { button: 'settingsNavBtn', view: 'settingsMainView' }
        };

        const showView = (route) => {
            if (!routes[route]) return;

            Object.entries(routes).forEach(([name, config]) => {
                const isActive = name === route;
                const button = document.getElementById(config.button);
                const view = document.getElementById(config.view);
                if (view) view.hidden = !isActive;
                button?.classList.toggle('active', isActive);
                button?.setAttribute('aria-pressed', String(isActive));
            });

            if (settingsView) settingsView.hidden = route !== 'settings';
            const modeSwitch = document.getElementById('addGameModeSwitch');
            if (modeSwitch) modeSwitch.hidden = route !== 'add-games';
            document.body.dataset.merlinView = route;
        };

        Object.entries(routes).forEach(([route, config]) => {
            document.getElementById(config.button)?.addEventListener('click', () => showView(route));
        });

        document.getElementById('homePremiumBtn')?.addEventListener('click', () => showView('premium'));
        document.getElementById('homeCampaignPremiumBtn')?.addEventListener('click', () => showView('premium'));
        document.getElementById('homeAddGameBtn')?.addEventListener('click', () => showView('add-games'));

        showView(document.body.dataset.merlinView || 'home');
    });
})();
