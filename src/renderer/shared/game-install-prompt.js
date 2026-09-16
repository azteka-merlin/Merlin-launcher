window.merlinI18n.register({
    ptbr: {
        game_install_prompt_title: 'Adicionar à Steam?',
        game_install_prompt_cancel: 'Cancelar',
        game_install_prompt_action: 'Adicionar à Steam'
    },
    en: {
        game_install_prompt_title: 'Add to Steam?',
        game_install_prompt_cancel: 'Cancel',
        game_install_prompt_action: 'Add to Steam'
    },
    es: {
        game_install_prompt_title: '¿Agregar a Steam?',
        game_install_prompt_cancel: 'Cancelar',
        game_install_prompt_action: 'Agregar a Steam'
    },
    fr: {
        game_install_prompt_title: 'Ajouter à Steam ?',
        game_install_prompt_cancel: 'Annuler',
        game_install_prompt_action: 'Ajouter à Steam'
    },
    de: {
        game_install_prompt_title: 'Zu Steam hinzufügen?',
        game_install_prompt_cancel: 'Abbrechen',
        game_install_prompt_action: 'Zu Steam hinzufügen'
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('gameInstallConfirmModal');
    const message = document.getElementById('gameInstallConfirmMessage');
    const cancel = document.getElementById('gameInstallCancelBtn');
    const confirm = document.getElementById('gameInstallConfirmBtn');
    let resolvePrompt = null;
    let previousFocus = null;

    function close(value) {
        modal.hidden = true;
        const resolve = resolvePrompt;
        resolvePrompt = null;
        resolve?.(value);
        requestAnimationFrame(() => previousFocus?.focus());
    }

    function ask(options = {}) {
        if (resolvePrompt) close(false);
        previousFocus = document.activeElement;
        message.textContent = options.message || '';
        modal.hidden = false;
        confirm.focus();
        return new Promise(resolve => { resolvePrompt = resolve; });
    }

    cancel.addEventListener('click', () => close(false));
    confirm.addEventListener('click', () => close(true));
    modal.addEventListener('click', event => {
        if (event.target === modal) close(false);
    });
    window.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !modal.hidden) close(false);
    });

    window.merlinGameInstallPrompt = { ask };
});
