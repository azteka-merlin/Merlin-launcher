(function () {
    'use strict';

    const messages = {
        ptbr: {
            release_notes_menu: 'Novidades', release_notes_unread: 'Novidade não vista', release_notes_close: 'Fechar novidades',
            release_notes_version: 'VERSÃO {version}', release_notes_explore: 'Explorar o Merlin {version}',
            release_notes_all_changes: 'Ver todas as mudanças', release_notes_understood: 'Entendi', release_notes_back: 'Voltar',
            release_notes_full_title: 'Todas as mudanças', release_notes_available_again: 'Disponível novamente em Minha conta > Novidades.',
            release_notes_standard_heading: 'Novidades do Merlin', release_notes_empty: 'Nenhuma novidade publicada.'
        },
        en: {
            release_notes_menu: 'What’s new', release_notes_unread: 'Unread update', release_notes_close: 'Close what’s new',
            release_notes_version: 'VERSION {version}', release_notes_explore: 'Explore Merlin {version}',
            release_notes_all_changes: 'See all changes', release_notes_understood: 'Got it', release_notes_back: 'Back',
            release_notes_full_title: 'All changes', release_notes_available_again: 'Available again in My Account > What’s new.',
            release_notes_standard_heading: 'What’s new in Merlin', release_notes_empty: 'No published updates.'
        },
        es: {
            release_notes_menu: 'Novedades', release_notes_unread: 'Novedad no vista', release_notes_close: 'Cerrar novedades',
            release_notes_version: 'VERSIÓN {version}', release_notes_explore: 'Explorar Merlin {version}',
            release_notes_all_changes: 'Ver todos los cambios', release_notes_understood: 'Entendido', release_notes_back: 'Volver',
            release_notes_full_title: 'Todos los cambios', release_notes_available_again: 'Disponible de nuevo en Mi cuenta > Novedades.',
            release_notes_standard_heading: 'Novedades de Merlin', release_notes_empty: 'No hay novedades publicadas.'
        },
        fr: {
            release_notes_menu: 'Nouveautés', release_notes_unread: 'Nouveauté non lue', release_notes_close: 'Fermer les nouveautés',
            release_notes_version: 'VERSION {version}', release_notes_explore: 'Explorer Merlin {version}',
            release_notes_all_changes: 'Voir tous les changements', release_notes_understood: 'Compris', release_notes_back: 'Retour',
            release_notes_full_title: 'Tous les changements', release_notes_available_again: 'Disponible à nouveau dans Mon compte > Nouveautés.',
            release_notes_standard_heading: 'Nouveautés de Merlin', release_notes_empty: 'Aucune nouveauté publiée.'
        },
        de: {
            release_notes_menu: 'Neuigkeiten', release_notes_unread: 'Ungelesene Neuigkeit', release_notes_close: 'Neuigkeiten schließen',
            release_notes_version: 'VERSION {version}', release_notes_explore: 'Merlin {version} erkunden',
            release_notes_all_changes: 'Alle Änderungen anzeigen', release_notes_understood: 'Verstanden', release_notes_back: 'Zurück',
            release_notes_full_title: 'Alle Änderungen', release_notes_available_again: 'Erneut verfügbar unter Mein Konto > Neuigkeiten.',
            release_notes_standard_heading: 'Neu in Merlin', release_notes_empty: 'Keine veröffentlichten Neuigkeiten.'
        }
    };

    window.merlinI18n?.register?.(messages);
    const tr = (key, values = {}) => {
        const language = window.merlinI18n?.current?.() || 'ptbr';
        let value = window.merlinI18n?.t?.(key) || messages[language]?.[key] || messages.ptbr[key] || key;
        for (const [name, replacement] of Object.entries(values)) value = value.replaceAll(`{${name}}`, replacement);
        return value;
    };

    const iconPaths = {
        home: 'node_modules/lucide-static/icons/house.svg',
        steam: 'assets/icons/steam-mark.svg',
        library: 'node_modules/lucide-static/icons/library.svg',
        settings: 'node_modules/lucide-static/icons/settings.svg',
        sparkles: 'node_modules/lucide-static/icons/sparkles.svg',
        wrench: 'node_modules/lucide-static/icons/wrench.svg',
        gift: 'node_modules/lucide-static/icons/gift.svg',
        megaphone: 'node_modules/lucide-static/icons/megaphone.svg'
    };

    function displayVersion(version) {
        return String(version || '').replace(/^v/i, '').replace(/\.0$/, '');
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function button(className, label, iconPath) {
        const node = element('button', className);
        node.type = 'button';
        if (iconPath) {
            const icon = document.createElement('img');
            icon.src = iconPath;
            icon.alt = '';
            node.append(icon);
        }
        node.append(document.createTextNode(label));
        return node;
    }

    function accentTitle(title, version) {
        const heading = element('h1', 'release-notes-title');
        heading.id = 'releaseNotesTitle';
        const accent = displayVersion(version);
        const index = title.indexOf(accent);
        if (index < 0) {
            heading.textContent = title;
            return heading;
        }
        heading.append(document.createTextNode(title.slice(0, index)));
        heading.append(element('span', 'release-notes-title-accent', accent));
        heading.append(document.createTextNode(title.slice(index + accent.length)));
        return heading;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const api = window.electronAPI?.releaseNotes;
        const overlay = document.getElementById('releaseNotesOverlay');
        const dialog = document.getElementById('releaseNotesDialog');
        const summary = document.getElementById('releaseNotesSummary');
        const full = document.getElementById('releaseNotesFull');
        const closeButton = document.getElementById('releaseNotesCloseBtn');
        const menuButton = document.getElementById('accountNewsBtn');
        const unreadDot = document.getElementById('accountNewsUnreadDot');
        if (!api || !overlay || !dialog || !summary || !full || !closeButton || !menuButton || !unreadDot) return;

        let payload = null;
        let activeRelease = null;
        let seenTargetRelease = null;
        let previousFocus = null;
        let autoOpenTimer = null;
        let lastRefreshAt = 0;
        let languageReady = false;

        function updateDot() {
            const available = Boolean(payload && !payload.stale && payload.releases?.length);
            menuButton.hidden = !available;
            unreadDot.hidden = !available || !payload.hasUnread;
        }

        function brandBlock() {
            const brand = element('div', 'release-notes-brand');
            const logo = document.createElement('img');
            logo.src = 'assets/merlin-icon-compact.png';
            logo.alt = '';
            brand.append(logo, element('strong', '', 'MERLIN'));
            return brand;
        }

        function featureCard(item) {
            const card = element('article', 'release-notes-feature');
            const iconWrap = element('div', 'release-notes-feature-icon');
            const icon = document.createElement('img');
            icon.src = iconPaths[item.icon] || iconPaths.sparkles;
            icon.alt = '';
            iconWrap.append(icon);
            const copy = element('div', 'release-notes-feature-copy');
            copy.append(element('h2', '', item.title), element('p', '', item.description));
            card.append(iconWrap, copy);
            return card;
        }

        function renderMajor(release) {
            const layout = element('div', 'release-notes-major-layout');
            const copy = element('div', 'release-notes-major-copy');
            const header = element('header', 'release-notes-major-header');
            header.append(brandBlock());
            header.append(element('span', 'release-notes-version', tr('release_notes_version', { version: displayVersion(release.version) })));
            header.append(accentTitle(release.title, release.version));
            header.append(element('p', 'release-notes-subtitle', release.subtitle));
            copy.append(header);
            const highlights = element('div', 'release-notes-features');
            release.highlights.slice(0, 5).forEach((item) => highlights.append(featureCard(item)));
            copy.append(highlights);
            const actions = element('div', 'release-notes-actions');
            const explore = button('release-notes-primary', tr('release_notes_explore', { version: displayVersion(release.version) }), iconPaths.sparkles);
            const changes = button('release-notes-secondary', tr('release_notes_all_changes'));
            explore.addEventListener('click', () => close({ markSeen: true }));
            changes.addEventListener('click', showFull);
            actions.append(explore, changes);
            copy.append(actions);

            const art = element('div', 'release-notes-major-art');
            if (release.heroAssetUrl) {
                const image = document.createElement('img');
                image.src = release.heroAssetUrl;
                image.alt = '';
                image.decoding = 'async';
                art.append(image);
            }
            const reminder = element('div', 'release-notes-reminder');
            const mark = element('span', '', '✓');
            mark.setAttribute('aria-hidden', 'true');
            reminder.append(mark, element('p', '', tr('release_notes_available_again')));
            art.append(reminder);
            layout.append(copy, art);
            return layout;
        }

        function renderStandard(release) {
            const card = element('div', 'release-notes-standard-layout');
            card.append(brandBlock());
            card.append(element('p', 'release-notes-standard-eyebrow', tr('release_notes_standard_heading')));
            card.append(element('span', 'release-notes-version', tr('release_notes_version', { version: displayVersion(release.version) })));
            card.append(accentTitle(release.title, release.version));
            card.append(element('p', 'release-notes-subtitle', release.summary));
            const list = element('ul', 'release-notes-standard-list');
            release.fullContent.slice(0, 4).forEach((item) => list.append(element('li', '', item)));
            card.append(list);
            const actions = element('div', 'release-notes-actions');
            const changes = button('release-notes-secondary', tr('release_notes_all_changes'));
            const understood = button('release-notes-primary', tr('release_notes_understood'));
            changes.addEventListener('click', showFull);
            understood.addEventListener('click', () => close({ markSeen: true }));
            actions.append(changes, understood);
            card.append(actions);
            return card;
        }

        function renderSummary() {
            if (!activeRelease) return;
            summary.replaceChildren(activeRelease.type === 'major' ? renderMajor(activeRelease) : renderStandard(activeRelease));
            dialog.dataset.variant = activeRelease.type;
            full.hidden = true;
            summary.hidden = false;
        }

        function showFull() {
            if (!activeRelease) return;
            const content = element('div', 'release-notes-full-content');
            content.append(brandBlock());
            content.append(element('span', 'release-notes-version', tr('release_notes_version', { version: displayVersion(activeRelease.version) })));
            content.append(element('h1', '', tr('release_notes_full_title')));
            content.append(element('p', 'release-notes-full-summary', activeRelease.summary));
            if (payload?.releases?.length > 1) {
                const versions = element('div', 'release-notes-version-history');
                payload.releases.forEach((release) => {
                    const versionButton = button(`release-notes-version-chip${release.version === activeRelease.version ? ' is-active' : ''}`, `v${release.version}`);
                    versionButton.setAttribute('aria-pressed', String(release.version === activeRelease.version));
                    versionButton.addEventListener('click', () => { activeRelease = release; showFull(); });
                    versions.append(versionButton);
                });
                content.append(versions);
            }
            const list = element('ul', 'release-notes-full-list');
            activeRelease.fullContent.forEach((item) => list.append(element('li', '', item)));
            content.append(list);
            const actions = element('div', 'release-notes-actions');
            const back = button('release-notes-secondary', tr('release_notes_back'));
            const understood = button('release-notes-primary', tr('release_notes_understood'));
            back.addEventListener('click', renderSummary);
            understood.addEventListener('click', () => close({ markSeen: true }));
            actions.append(back, understood);
            content.append(actions);
            full.replaceChildren(content);
            summary.hidden = true;
            full.hidden = false;
            back.focus();
        }

        async function markSeen(release) {
            payload.lastSeenVersion = release.version;
            payload.hasUnread = payload.latest?.version !== release.version;
            payload.shouldAutoOpen = false;
            updateDot();
            await api.markSeen(release.version).catch(() => undefined);
        }

        function close({ markSeen: shouldMark = true } = {}) {
            if (overlay.hidden) return;
            const release = seenTargetRelease || activeRelease;
            overlay.hidden = true;
            document.body.classList.remove('release-notes-open');
            activeRelease = null;
            seenTargetRelease = null;
            summary.replaceChildren();
            full.replaceChildren();
            if (shouldMark && release) void markSeen(release);
            if (previousFocus?.isConnected) previousFocus.focus();
            previousFocus = null;
        }

        function open(release) {
            if (!release) return;
            activeRelease = release;
            seenTargetRelease = release;
            previousFocus = document.activeElement;
            renderSummary();
            overlay.hidden = false;
            document.body.classList.add('release-notes-open');
            closeButton.focus();
        }

        function visibleBlockingDialog() {
            return [...document.querySelectorAll('[role="dialog"]')].some((node) => node !== dialog && !node.hidden && node.offsetParent !== null);
        }

        function scheduleAutoOpen(attempt = 0) {
            window.clearTimeout(autoOpenTimer);
            if (!payload?.shouldAutoOpen || !payload.current || !overlay.hidden) return;
            if (visibleBlockingDialog() && attempt < 30) {
                autoOpenTimer = window.setTimeout(() => scheduleAutoOpen(attempt + 1), 500);
                return;
            }
            if (!visibleBlockingDialog()) open(payload.current);
        }

        async function load({ force = false, allowAutoOpen = true } = {}) {
            const result = await api.get({ locale: window.merlinI18n?.current?.() || 'ptbr', force }).catch(() => null);
            lastRefreshAt = Date.now();
            // Cached content is useful for a later successful refresh, but must never
            // make the entry point or unread marker visible while the API is offline.
            if (!result?.success || result.stale || !result.releases?.length) {
                payload = null;
                updateDot();
                return null;
            }
            payload = result;
            updateDot();
            if (allowAutoOpen) scheduleAutoOpen();
            return result;
        }

        async function openManual() {
            const result = payload || await load({ force: true, allowAutoOpen: false });
            const release = result?.latest || result?.current || result?.releases?.[0];
            if (release) open(release);
        }

        closeButton.addEventListener('click', () => close({ markSeen: true }));
        menuButton.addEventListener('click', () => { void openManual(); });
        document.addEventListener('keydown', (event) => {
            if (overlay.hidden) return;
            if (event.key === 'Escape') {
                event.preventDefault();
                close({ markSeen: true });
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = [...dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((node) => node.offsetParent !== null);
            if (!focusable.length) { event.preventDefault(); dialog.focus(); return; }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }, true);
        window.addEventListener('merlin-authenticated', () => {
            if (languageReady) void load({ force: true });
        });
        window.addEventListener('merlin-language-ready', () => {
            languageReady = true;
            void load({ force: true });
        });
        window.addEventListener('merlin-language-changed', async () => {
            if (!languageReady) return;
            const wasOpen = !overlay.hidden;
            const version = activeRelease?.version;
            const result = await load({ force: true, allowAutoOpen: false });
            if (wasOpen && result) {
                activeRelease = result.releases.find((release) => release.version === version) || result.current || result.latest;
                renderSummary();
            }
        });
        window.addEventListener('merlin-view-changed', () => {
            if (!languageReady || Date.now() - lastRefreshAt < 15000) return;
            void load({ force: true, allowAutoOpen: false });
        });
        window.merlinReleaseNotes = { open: openManual, refresh: () => load({ force: true, allowAutoOpen: false }) };
        // renderer.js resolves the persisted language asynchronously. Waiting for its
        // ready event prevents a first request/render in the temporary English default.
        if (document.documentElement.dataset.merlinLanguageReady === 'true') {
            languageReady = true;
            void load({ force: true });
        }
    });
}());
