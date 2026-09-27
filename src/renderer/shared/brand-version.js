(() => {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        const button = document.getElementById('brandVersionButton');
        if (!button) return;

        button.addEventListener('click', () => {
            const isPinned = button.getAttribute('aria-pressed') !== 'true';
            button.setAttribute('aria-pressed', String(isPinned));
            button.setAttribute('aria-label', isPinned
                ? 'Merlin, ocultar versão atual'
                : 'Merlin, exibir versão atual');
        });
    });
})();
