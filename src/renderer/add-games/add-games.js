window.merlinI18n.register({
    ptbr: {
        add_games_description: 'Adicione jogos à sua biblioteca Steam pelo Merlin. O download e a instalação são feitos pela própria Steam.',
        add_games_link_label: 'Link da Steam, nome do jogo ou AppID',
        add_games_link_placeholder: 'https://store.steampowered.com/app/... ou nome do jogo',
        games_searching: 'Pesquisando jogos...',
        games_suggestions_empty: 'Nenhum jogo encontrado para essa busca.',
        games_select_game: 'Selecione um jogo da lista antes de continuar.',
        games_error_selection_required: 'Selecione um jogo da lista antes de continuar.',
        games_error_search_failed: 'Não foi possível pesquisar jogos agora.',
        auto_update_title: 'Atualizar automaticamente',
        auto_update_description: 'Recomendado para a maioria dos jogos. Se estiver em dúvida, deixe ativado.',
        auto_update_locked_hint: 'Este jogo está fixado em uma versão específica para garantir o funcionamento da correção disponível.'
    },
    en: {
        add_games_description: 'Add games to your Steam Library with Merlin. Steam handles game downloads and installation.',
        add_games_link_label: 'Steam link, game name, or AppID',
        add_games_link_placeholder: 'https://store.steampowered.com/app/... or game name',
        games_searching: 'Searching games...',
        games_suggestions_empty: 'No games found for this search.',
        games_select_game: 'Select a game from the list before continuing.',
        games_error_selection_required: 'Select a game from the list before continuing.',
        games_error_search_failed: 'Could not search games right now.',
        auto_update_title: 'Update automatically',
        auto_update_description: 'Recommended for most games. If you are not sure, leave this enabled.',
        auto_update_locked_hint: 'This game is pinned to a specific version to help the available correction work properly.'
    },
    es: {
        add_games_description: 'Agrega juegos a tu biblioteca de Steam con Merlin. Steam realiza la descarga e instalación del juego.',
        add_games_link_label: 'Enlace de Steam, nombre del juego o AppID',
        add_games_link_placeholder: 'https://store.steampowered.com/app/... o nombre del juego',
        games_searching: 'Buscando juegos...',
        games_suggestions_empty: 'No se encontraron juegos para esta búsqueda.',
        games_select_game: 'Seleccione un juego de la lista antes de continuar.',
        games_error_selection_required: 'Seleccione un juego de la lista antes de continuar.',
        games_error_search_failed: 'No se pudieron buscar juegos ahora.',
        auto_update_title: 'Actualizar automáticamente',
        auto_update_description: 'Recomendado para la mayoría de los juegos. Si no está seguro, déjelo activado.',
        auto_update_locked_hint: 'Este juego está fijado en una versión específica para garantizar el funcionamiento de la corrección disponible.'
    },
    fr: {
        add_games_description: 'Ajoutez des jeux à votre bibliothèque Steam avec Merlin. Steam assure le téléchargement et l’installation du jeu.',
        add_games_link_label: 'Lien Steam, nom du jeu ou AppID',
        add_games_link_placeholder: 'https://store.steampowered.com/app/... ou nom du jeu',
        games_searching: 'Recherche de jeux...',
        games_suggestions_empty: 'Aucun jeu trouvé pour cette recherche.',
        games_select_game: 'Sélectionnez un jeu dans la liste avant de continuer.',
        games_error_selection_required: 'Sélectionnez un jeu dans la liste avant de continuer.',
        games_error_search_failed: 'Impossible de rechercher des jeux pour le moment.',
        auto_update_title: 'Mettre à jour automatiquement',
        auto_update_description: 'Recommandé pour la plupart des jeux. En cas de doute, laissez cette option activée.',
        auto_update_locked_hint: 'Ce jeu est bloqué sur une version spécifique afin de garantir le bon fonctionnement du correctif disponible.'
    },
    de: {
        add_games_description: 'Fügen Sie Spiele mit Merlin zu Ihrer Steam-Bibliothek hinzu. Steam übernimmt Download und Installation des Spiels.',
        add_games_link_label: 'Steam-Link, Spielname oder AppID',
        add_games_link_placeholder: 'https://store.steampowered.com/app/... oder Spielname',
        games_searching: 'Spiele werden gesucht...',
        games_suggestions_empty: 'Keine Spiele für diese Suche gefunden.',
        games_select_game: 'Wählen Sie ein Spiel aus der Liste aus, bevor Sie fortfahren.',
        games_error_selection_required: 'Wählen Sie ein Spiel aus der Liste aus, bevor Sie fortfahren.',
        games_error_search_failed: 'Spiele konnten gerade nicht gesucht werden.',
        auto_update_title: 'Automatisch aktualisieren',
        auto_update_description: 'Für die meisten Spiele empfohlen. Wenn Sie unsicher sind, lassen Sie dies aktiviert.',
        auto_update_locked_hint: 'Dieses Spiel ist auf eine bestimmte Version festgelegt, damit die verfügbare Korrektur korrekt funktioniert.'
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const api = window.electronAPI.games;
    const siteSelector = document.getElementById('siteSelector');
    const addGamesNavBtn = document.getElementById('addGamesNavBtn');
    const linkModeBtn = document.getElementById('linkModeBtn');
    const steamStoreModeBtn = document.getElementById('steamStoreModeBtn');
    const webview = document.getElementById('webview');
    const addGamesView = document.getElementById('addGamesView');
    const browserToolbar = document.querySelector('.browser-toolbar');
    const steamContextBar = document.getElementById('steamContextBar');
    const linkInput = document.getElementById('gameLinkInput');
    const suggestions = document.getElementById('gameSuggestions');
    const autoUpdateToggle = document.getElementById('autoUpdateToggle');
    const autoUpdateOption = document.querySelector('.auto-update-option');
    const queueList = document.getElementById('gameQueueList');
    const queueCount = document.getElementById('queueCount');
    const installAllCount = document.getElementById('installAllCount');
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    const installNowBtn = document.getElementById('installNowBtn');
    const addToQueueBtn = document.getElementById('addToQueueBtn');
    const installAllBtn = document.getElementById('installAllBtn');
    const feedback = document.getElementById('addGamesFeedback');

    let queueState = { items: [], count: 0, locked: false, installing: false };
    let requestBusy = false;
    let suggestionItems = [];
    let selectedGame = null;
    let searchTimer = null;
    let searchRequestId = 0;
    let searchLoading = false;
    let feedbackTranslation = null;

    const localErrorTranslations = {
        ptbr: {
            games_error_catalog_not_found: 'Nenhum jogo foi encontrado para essa busca.',
            games_error_resolve_failed: 'Não foi possível interpretar esse link da Steam.',
            games_error_test_limit_normal: 'O limite de ativações normais desta licença de teste foi atingido.'
        },
        en: {
            games_error_catalog_not_found: 'No game was found for this search.',
            games_error_resolve_failed: 'Could not understand this Steam link.',
            games_error_test_limit_normal: 'This test license has reached its normal activation limit.'
        },
        es: {
            games_error_catalog_not_found: 'No se encontró ningún juego para esta búsqueda.',
            games_error_resolve_failed: 'No se pudo interpretar este enlace de Steam.',
            games_error_test_limit_normal: 'Esta licencia de prueba alcanzó su límite de activaciones normales.'
        },
        fr: {
            games_error_catalog_not_found: 'Aucun jeu n’a été trouvé pour cette recherche.',
            games_error_resolve_failed: 'Impossible d’interpréter ce lien Steam.',
            games_error_test_limit_normal: 'Cette licence de test a atteint sa limite d’activations normales.'
        },
        de: {
            games_error_catalog_not_found: 'Für diese Suche wurde kein Spiel gefunden.',
            games_error_resolve_failed: 'Dieser Steam-Link konnte nicht verarbeitet werden.',
            games_error_test_limit_normal: 'Diese Testlizenz hat ihr Limit für normale Aktivierungen erreicht.'
        }
    };

    function resetAutoUpdate() {
        autoUpdateToggle.checked = true;
        autoUpdateToggle.disabled = false;
        if (autoUpdateOption) autoUpdateOption.title = '';
    }

    function tr(key, values = {}) {
        const template = window.merlinI18n?.t(key) || key;
        return Object.entries(values).reduce(
            (text, [name, value]) => text.replaceAll(`{${name}}`, value),
            template
        );
    }

    function errorMessage(result, fallbackKey = 'games_error_generic') {
        const code = result?.code || result?.reason;
        const key = code ? `games_error_${code}` : fallbackKey;
        const translated = tr(key);
        if (translated !== key) return translated;

        const language = window.merlinI18n?.current?.() || document.documentElement.lang || 'en';
        const localTranslation = localErrorTranslations[language]?.[key]
            || localErrorTranslations.en[key];

        return localTranslation || tr(fallbackKey);
    }

    function progressMessage(message, stage) {
        if (stage === 'downloading' || /download attempt|downloading manifests/i.test(message)) {
            return tr('games_progress_downloading');
        }
        if (/extracting/i.test(message)) return tr('games_progress_extracting');
        if (/installing/i.test(message)) return tr('games_progress_installing');
        if (/cleaning/i.test(message)) return tr('games_progress_cleaning');
        if (/complete/i.test(message)) return tr('games_progress_complete');
        return message;
    }

    function showFeedback(message = '', type = 'info') {
        feedbackTranslation = null;
        feedback.textContent = message;
        feedback.dataset.type = type;
        feedback.hidden = !message;
    }

    function showFeedbackTranslation(key, values = {}, type = 'info') {
        feedbackTranslation = { key, values, type };
        feedback.textContent = tr(key, values);
        feedback.dataset.type = type;
        feedback.hidden = false;
    }

    function isSteamLink(value) {
        return /^https?:\/\/store\.steampowered\.com\/app\//i.test(String(value || '').trim());
    }

    function fallbackCoverUrl(appId) {
        const normalizedAppId = String(appId || '').trim();
        return /^\d+$/.test(normalizedAppId)
            ? `https://generator.ryuu.lol/files/images/${normalizedAppId}.jpg`
            : null;
    }

    function clearSuggestions() {
        searchLoading = false;
        suggestionItems = [];
        suggestions.replaceChildren();
        suggestions.hidden = true;
    }

    function renderSearchLoading() {
        searchLoading = true;
        suggestionItems = [];
        suggestions.replaceChildren();

        const content = document.createElement('div');
        content.className = 'game-suggestions-loading';

        const spinner = document.createElement('span');
        spinner.className = 'game-suggestions-spinner';
        spinner.setAttribute('aria-hidden', 'true');

        const label = document.createElement('span');
        label.textContent = tr('games_searching');

        content.append(spinner, label);
        suggestions.append(content);
        suggestions.hidden = false;
    }

    function queueCoverElement(game) {
        if (game.coverUrl) {
            const image = document.createElement('img');
            image.className = 'game-queue-cover';
            image.src = game.coverUrl;
            image.alt = '';
            image.loading = 'lazy';
            image.decoding = 'async';
            image.addEventListener('error', () => {
                const fallbackUrl = fallbackCoverUrl(game.appId);
                if (fallbackUrl && !image.dataset.ryuuFallbackApplied && image.src !== fallbackUrl) {
                    image.dataset.ryuuFallbackApplied = 'true';
                    image.src = fallbackUrl;
                    return;
                }
                const placeholder = document.createElement('div');
                placeholder.className = 'game-queue-cover game-queue-cover-placeholder';
                image.replaceWith(placeholder);
            });
            return image;
        }
        const placeholder = document.createElement('div');
        placeholder.className = 'game-queue-cover game-queue-cover-placeholder';
        return placeholder;
    }

    function renderSuggestions(items) {
        searchLoading = false;
        suggestionItems = items || [];
        suggestions.replaceChildren();

        for (const item of suggestionItems) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `game-suggestion-item${selectedGame?.appId === item.appId ? ' active' : ''}`;
            button.dataset.appId = item.appId;

            const cover = queueCoverElement(item);
            cover.classList.add('game-suggestion-cover');

            const meta = document.createElement('span');
            meta.className = 'game-suggestion-meta';

            const name = document.createElement('span');
            name.className = 'game-suggestion-name';
            name.textContent = item.name;

            const appId = document.createElement('span');
            appId.className = 'game-suggestion-appid';
            appId.textContent = `AppID ${item.appId}`;

            meta.append(name, appId);
            button.append(cover, meta);
            suggestions.append(button);
        }

        suggestions.hidden = suggestionItems.length === 0;
    }

    function setSelectedGame(game) {
        selectedGame = game ? {
            appId: game.appId,
            name: game.name,
            coverUrl: game.coverUrl || null,
            requiresVersionPin: game.requiresVersionPin === true
        } : null;
        if (selectedGame) {
            linkInput.value = selectedGame.name;
        }
        renderSuggestions(suggestionItems);
        updateControls();
    }

    function currentInputPayload() {
        return {
            selected: selectedGame ? { ...selectedGame } : null,
            raw: selectedGame ? '' : linkInput.value,
            autoUpdate: autoUpdateToggle.checked
        };
    }

    function setRequestBusy(value) {
        requestBusy = value;
        updateControls();
    }

    function updateControls() {
        const locked = requestBusy || queueState.locked || queueState.installing;
        const hasSelected = Boolean(selectedGame);
        const hasLink = isSteamLink(linkInput.value);
        const canSubmit = hasSelected || hasLink;
        const requiresVersionPin = selectedGame?.requiresVersionPin === true;
        linkInput.disabled = locked;
        installNowBtn.disabled = locked || queueState.count > 0 || !canSubmit;
        addToQueueBtn.disabled = locked || !canSubmit;
        installAllBtn.disabled = locked || queueState.count === 0;
        clearQueueBtn.disabled = locked || queueState.count === 0;
        queueList.querySelectorAll('.remove-game-btn').forEach(button => {
            button.disabled = locked;
        });
        if (requiresVersionPin) {
            autoUpdateToggle.checked = false;
        }
        autoUpdateToggle.disabled = locked || requiresVersionPin;
        if (autoUpdateOption) {
            autoUpdateOption.title = requiresVersionPin ? tr('auto_update_locked_hint') : '';
        }
    }

    function renderQueue(nextState) {
        queueState = nextState || queueState;
        queueList.replaceChildren();

        for (const game of queueState.items) {
            const item = document.createElement('li');
            item.className = 'game-queue-item';

            const info = document.createElement('div');
            info.className = 'game-queue-info';

            const cover = queueCoverElement(game);

            const name = document.createElement('span');
            name.className = 'game-queue-name';
            name.textContent = game.name;
            name.title = `${game.name} (${game.appId})`;

            info.append(cover, name);

            const removeButton = document.createElement('button');
            removeButton.className = 'remove-game-btn';
            removeButton.type = 'button';
            removeButton.setAttribute('aria-label', tr('remove_from_queue', { name: game.name }));
            removeButton.dataset.appId = game.appId;
            removeButton.innerHTML = `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6"></path>
                </svg>`;

            item.append(info, removeButton);
            queueList.append(item);
        }

        queueCount.textContent = `(${queueState.count})`;
        installAllCount.textContent = `(${queueState.count})`;
        clearQueueBtn.hidden = queueState.count === 0;
        updateControls();
    }

    function updateVisibleView() {
        const currentView = window.merlinView?.get?.() || 'add-games';
        const showAddGames = currentView === 'add-games';
        const showSteamStore = currentView === 'steam-store';
        addGamesView.hidden = !showAddGames;
        webview.hidden = !showSteamStore;
        if (!showSteamStore) webview.blur();
        browserToolbar.hidden = !showAddGames && !showSteamStore;
        browserToolbar.classList.toggle('native-content-active', showAddGames);
        if (steamContextBar) steamContextBar.hidden = !showSteamStore || !window.merlinSteamContext?.hasAppId?.();
        addGamesNavBtn.classList.toggle('active', showAddGames || showSteamStore);
        addGamesNavBtn.setAttribute('aria-pressed', String(showAddGames || showSteamStore));
        linkModeBtn.classList.toggle('active', showAddGames);
        linkModeBtn.setAttribute('aria-pressed', String(showAddGames));
        steamStoreModeBtn.classList.toggle('active', showSteamStore);
        steamStoreModeBtn.setAttribute('aria-pressed', String(showSteamStore));
    }

    function selectMode(value) {
        window.merlinView?.set?.(value === 'add-games' ? 'add-games' : 'steam-store');
        siteSelector.value = value;
        siteSelector.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function runSearch(query) {
        const requestId = ++searchRequestId;
        if (!query) {
            clearSuggestions();
            return;
        }

        if (isSteamLink(query)) {
            const result = await api.resolveLink(query);
            if (requestId !== searchRequestId) return;
            if (!result.success) {
                setSelectedGame(null);
                showFeedback(errorMessage(result), 'error');
                return;
            }
            setSelectedGame(result.item);
            clearSuggestions();
            showFeedback('');
            return;
        }

        renderSearchLoading();
        showFeedback('');
        const result = await api.search(query);
        if (requestId !== searchRequestId) return;

        if (!result.success) {
            if (result.code === 'search_failed') {
                window.merlinServiceStatus?.report?.('catalog-search');
            }
            clearSuggestions();
            showFeedback(errorMessage(result), 'error');
            return;
        }

        window.merlinServiceStatus?.clear?.('catalog-search');
        renderSuggestions(result.items);
        if (result.items.length === 0) {
            showFeedback(tr('games_suggestions_empty'));
        } else {
            showFeedback('');
        }
    }

    function scheduleSearch() {
        clearTimeout(searchTimer);
        const query = linkInput.value.trim();
        if (!query || isSteamLink(query)) {
            clearSuggestions();
            if (!query) showFeedback('');
            return;
        }
        showFeedback('');
        searchTimer = setTimeout(() => {
            renderSearchLoading();
            runSearch(query).catch(() => {
                window.merlinServiceStatus?.report?.('catalog-search');
                showFeedback(tr('games_error_search_failed'), 'error');
            });
        }, 300);
    }

    async function addToQueue() {
        setRequestBusy(true);
        showFeedback(tr('games_resolving'));
        try {
            const result = await api.addToQueue(currentInputPayload());
            if (!result.success) {
                showFeedback(errorMessage(result), 'error');
                return;
            }
            renderQueue(result.queue);
            linkInput.value = '';
            setSelectedGame(null);
            resetAutoUpdate();
            clearSuggestions();
            showFeedback(tr('games_added', { name: result.item.name }), 'success');
        } catch (_) {
            showFeedback(tr('games_add_failed'), 'error');
        } finally {
            setRequestBusy(false);
        }
    }

    async function installNow() {
        setRequestBusy(true);
        showFeedback(tr('games_install_preparing'));
        try {
            const result = await api.installNow(currentInputPayload());
            if (!result.success) {
                showFeedback(errorMessage(result, 'games_install_failed'), 'error');
                return;
            }
            linkInput.value = '';
            setSelectedGame(null);
            resetAutoUpdate();
            clearSuggestions();
            showFeedbackTranslation('games_install_success', { name: result.item.name }, 'success');
            await window.merlinCorrections?.offerFor?.(result.item.appId);
            setRequestBusy(false);
            if (await window.merlinRestartPrompt.ask({
                titleKey: 'restart_prompt_title',
                title: window.merlinI18n.t('restart_prompt_title'),
                message: tr('games_restart_prompt'),
                cancelKey: 'restart_prompt_later',
                cancelLabel: window.merlinI18n.t('restart_prompt_later'),
                actionKey: 'restart_prompt_action',
                actionLabel: window.merlinI18n.t('restart_prompt_action')
            })) {
                const restart = await api.restartSteam();
                showFeedback(
                    tr(restart.success ? 'games_restart_success' : 'games_restart_failed'),
                    restart.success ? 'success' : 'error'
                );
            }
            requestAnimationFrame(() => {
                if (!linkInput.disabled) linkInput.focus();
            });
        } catch (_) {
            showFeedback(tr('games_install_failed'), 'error');
        } finally {
            setRequestBusy(false);
        }
    }

    async function installAll() {
        setRequestBusy(true);
        showFeedback(tr('games_batch_start'));
        try {
            const result = await api.installAll();
            if (result.code) {
                showFeedback(errorMessage(result), 'error');
                return;
            }

            const installed = result.installed.length;
            const failed = result.failed.length;
            const summary = tr('games_batch_summary', { installed, failed });
            showFeedback(summary, failed > 0 ? 'error' : 'success');

            for (const item of result.installed) {
                await window.merlinCorrections?.offerFor?.(item.appId);
            }

            setRequestBusy(false);
            if (installed > 0 && await window.merlinRestartPrompt.ask({
                titleKey: 'restart_prompt_title',
                title: window.merlinI18n.t('restart_prompt_title'),
                message: tr('games_batch_restart_prompt', { summary }),
                cancelKey: 'restart_prompt_later',
                cancelLabel: window.merlinI18n.t('restart_prompt_later'),
                actionKey: 'restart_prompt_action',
                actionLabel: window.merlinI18n.t('restart_prompt_action')
            })) {
                const restart = await api.restartSteam();
                showFeedback(
                    tr(restart.success ? 'games_restart_success' : 'games_restart_failed'),
                    restart.success ? 'success' : 'error'
                );
            }
            requestAnimationFrame(() => {
                if (!linkInput.disabled) linkInput.focus();
            });
        } catch (_) {
            showFeedback(tr('games_batch_failed'), 'error');
        } finally {
            setRequestBusy(false);
        }
    }

    siteSelector.addEventListener('change', updateVisibleView);
    addGamesNavBtn.addEventListener('click', () => selectMode('add-games'));
    linkModeBtn.addEventListener('click', () => selectMode('add-games'));
    steamStoreModeBtn.addEventListener('click', () => selectMode('https://store.steampowered.com'));
    window.addEventListener('merlin-view-changed', updateVisibleView);
    window.addEventListener('merlin-language-changed', () => {
        renderQueue(queueState);
        if (searchLoading) {
            renderSearchLoading();
        } else {
            renderSuggestions(suggestionItems);
        }
    });
    addToQueueBtn.addEventListener('click', addToQueue);
    installNowBtn.addEventListener('click', installNow);
    installAllBtn.addEventListener('click', installAll);
    linkInput.addEventListener('input', () => {
        if (selectedGame && linkInput.value.trim() !== selectedGame.name) {
            setSelectedGame(null);
        }
        scheduleSearch();
        updateControls();
    });
    linkInput.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            clearSuggestions();
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            if (!selectedGame && suggestionItems.length > 0) {
                setSelectedGame(suggestionItems[0]);
                clearSuggestions();
                showFeedback('');
                return;
            }
            if (!addToQueueBtn.disabled) addToQueue();
        }
    });

    suggestions.addEventListener('click', event => {
        const button = event.target.closest('.game-suggestion-item');
        if (!button) return;
        const selected = suggestionItems.find(item => item.appId === button.dataset.appId);
        if (!selected) return;
        setSelectedGame(selected);
        clearSuggestions();
        showFeedback('');
    });

    queueList.addEventListener('click', async event => {
        const button = event.target.closest('.remove-game-btn');
        if (!button || button.disabled) return;
        const result = await api.removeFromQueue(button.dataset.appId);
        if (result.success) renderQueue(result.queue);
        else showFeedback(errorMessage(result), 'error');
    });

    clearQueueBtn.addEventListener('click', async () => {
        const result = await api.clearQueue();
        if (result.success) {
            renderQueue(result.queue);
            showFeedback(tr('games_queue_cleared'));
        } else {
            showFeedback(errorMessage(result), 'error');
        }
    });

    api.onQueueUpdated(renderQueue);
    api.onInstallProgress(progress => {
        showFeedback(tr('games_progress', {
            current: progress.current,
            total: progress.total,
            name: progress.name,
            message: progressMessage(progress.message, progress.stage),
            percent: progress.percent
        }));
    });
    window.addEventListener('merlin-language-changed', () => {
        if (!feedbackTranslation) return;
        feedback.textContent = tr(feedbackTranslation.key, feedbackTranslation.values);
        feedback.dataset.type = feedbackTranslation.type;
    });

    try {
        renderQueue(await api.listQueue());
    } catch (_) {
        showFeedback(tr('games_queue_load_failed'), 'error');
    }
    updateVisibleView();
    updateControls();
});
