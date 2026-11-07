window.merlinI18n.register({
    ptbr: {
        premium_offer_eyebrow: 'ATIVAÇÃO PREMIUM',
        premium_offer_title: 'Este jogo possui ativação Premium',
        premium_offer_title_many: 'Estes jogos possuem ativação Premium',
        premium_offer_description: 'Depois de instalar pela Steam, confira as instruções de ativação na aba Premium para jogar.',
        premium_offer_availability: 'A ativação depende do seu plano e das ativações disponíveis no momento.',
        premium_offer_later: 'Fazer depois',
        premium_offer_open: 'Ver na aba Premium'
    },
    en: {
        premium_offer_eyebrow: 'PREMIUM ACTIVATION',
        premium_offer_title: 'This game has Premium activation',
        premium_offer_title_many: 'These games have Premium activation',
        premium_offer_description: 'After installing through Steam, check the activation instructions in the Premium tab to play.',
        premium_offer_availability: 'Activation depends on your plan and the activations currently available.',
        premium_offer_later: 'Do it later',
        premium_offer_open: 'View in Premium'
    },
    es: {
        premium_offer_eyebrow: 'ACTIVACIÓN PREMIUM',
        premium_offer_title: 'Este juego tiene activación Premium',
        premium_offer_title_many: 'Estos juegos tienen activación Premium',
        premium_offer_description: 'Después de instalar mediante Steam, consulta las instrucciones de activación en la pestaña Premium para jugar.',
        premium_offer_availability: 'La activación depende de tu plan y de las activaciones disponibles en ese momento.',
        premium_offer_later: 'Hacerlo después',
        premium_offer_open: 'Ver en Premium'
    },
    fr: {
        premium_offer_eyebrow: 'ACTIVATION PREMIUM',
        premium_offer_title: 'Ce jeu dispose d’une activation Premium',
        premium_offer_title_many: 'Ces jeux disposent d’une activation Premium',
        premium_offer_description: 'Après l’installation via Steam, consultez les instructions d’activation dans l’onglet Premium pour jouer.',
        premium_offer_availability: 'L’activation dépend de votre forfait et des activations disponibles au moment concerné.',
        premium_offer_later: 'Plus tard',
        premium_offer_open: 'Voir dans Premium'
    },
    de: {
        premium_offer_eyebrow: 'PREMIUM-AKTIVIERUNG',
        premium_offer_title: 'Dieses Spiel bietet eine Premium-Aktivierung',
        premium_offer_title_many: 'Diese Spiele bieten eine Premium-Aktivierung',
        premium_offer_description: 'Nach der Installation über Steam findest du die Aktivierungsanleitung zum Spielen im Bereich Premium.',
        premium_offer_availability: 'Die Aktivierung hängt von deinem Tarif und den aktuell verfügbaren Aktivierungen ab.',
        premium_offer_later: 'Später',
        premium_offer_open: 'In Premium ansehen'
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const api = window.electronAPI.premium;
    const modal = document.getElementById('premiumAvailableModal');
    const title = document.getElementById('premiumAvailableTitle');
    const list = document.getElementById('premiumAvailableGames');
    const later = document.getElementById('premiumAvailableLaterBtn');
    const open = document.getElementById('premiumAvailableOpenBtn');
    let generation = 0;
    let busy = false;
    let pending = null;

    function close(action, restoreFocus = true) {
        const previous = pending;
        pending = null;
        modal.hidden = true;
        previous?.resolve(action);
        if (restoreFocus && previous?.focus) requestAnimationFrame(() => previous.focus.focus());
    }

    function renderGames(games) {
        const key = games.length === 1 ? 'premium_offer_title' : 'premium_offer_title_many';
        title.setAttribute('data-i18n', key);
        title.textContent = window.merlinI18n.t(key);
        list.replaceChildren();
        for (const game of games) {
            const row = document.createElement('li');
            row.className = 'correction-offer-game premium-offer-game';
            const image = document.createElement('img');
            image.alt = '';
            image.hidden = true;
            const fallback = window.merlinGameCovers?.url?.(game.appId) || `https://generator.ryuu.lol/files/images/${game.appId}.jpg`;
            const cover = game.coverUrl || game.imageUrl || fallback;
            image.onload = () => { image.hidden = false; };
            image.onerror = () => {
                image.hidden = true; image.onload = null; image.onerror = null;
            };
            if (window.merlinGameCovers?.load) window.merlinGameCovers.load(image, game.appId, cover);
            else image.src = cover;
            const name = document.createElement('strong');
            name.textContent = game.gameName;
            row.append(image, name);
            list.append(row);
        }
    }

    async function showForGames(games) {
        if (busy) return 'busy';
        const ids = new Set((Array.isArray(games) ? games : []).map(game => String(game?.appId || '').trim()).filter(id => /^\d+$/.test(id)));
        if (!ids.size) return 'not-found';
        const account = generation;
        busy = true;
        try {
            const matches = result => result?.success && Array.isArray(result.items)
                ? result.items.filter(game => ids.has(String(game.appId)) && game.enabled !== false && !game.comingSoon)
                : [];
            let result = await api.list();
            if (account !== generation) return 'cancelled';
            let offered = matches(result);
            // A cached catalog may predate this game. Do not repeat a fresh online lookup.
            if (result?.success && result.online !== true && offered.length < ids.size && api.refresh) {
                result = await api.refresh();
                if (account !== generation) return 'cancelled';
                offered = matches(result);
            }
            const unique = [...new Map(offered.map(game => [String(game.appId), game])).values()];
            if (!unique.length) return 'not-found';
            renderGames(unique);
            return await new Promise(resolve => {
                pending = { games: unique, resolve, focus: document.activeElement };
                modal.hidden = false;
                open.focus();
            });
        } catch (_) {
            // A notice lookup cannot turn a completed game installation into a failure.
            return 'unavailable';
        } finally {
            busy = false;
        }
    }

    later.addEventListener('click', () => close('later'));
    open.addEventListener('click', () => {
        if (!pending) return;
        const games = pending.games;
        close('open', false);
        const search = document.getElementById('premiumSearchInput');
        search.value = games.length === 1 ? games[0].gameName : '';
        search.dispatchEvent(new Event('input', { bubbles: true }));
        window.merlinView?.set?.('premium');
    });
    modal.addEventListener('click', event => { if (event.target === modal) close('later'); });
    document.addEventListener('keydown', event => {
        if (modal.hidden) return;
        if (event.key === 'Escape') { event.preventDefault(); close('later'); }
        if (event.key === 'Tab') {
            if (event.shiftKey && document.activeElement === later) { event.preventDefault(); open.focus(); }
            else if (!event.shiftKey && document.activeElement === open) { event.preventDefault(); later.focus(); }
        }
    });
    window.addEventListener('merlin-logout', () => { generation += 1; close('cancelled', false); });
    window.merlinPremiumOffer = Object.freeze({ showForGames });
});
