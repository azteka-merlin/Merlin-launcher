(() => {
    function openTutorial() {
        if (typeof window.openMerlinWelcomeWizard === 'function') {
            window.openMerlinWelcomeWizard();
        }
    }
    window.merlinTutorial = { open: openTutorial };
    window.electronAPI.onOpenTutorial(openTutorial);
})();
