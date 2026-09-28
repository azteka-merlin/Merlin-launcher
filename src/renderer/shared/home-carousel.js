(() => {
    const messages = {
        ptbr: { home_load_error: 'Não foi possível carregar a Home.', home_stale: 'Conteúdo salvo exibido. Não foi possível atualizar agora.', home_try_again: 'Tentar novamente', home_show_slide: 'Exibir {title}' },
        en: { home_load_error: 'The Home content could not be loaded.', home_stale: 'Saved content is being shown. It could not be refreshed now.', home_try_again: 'Try again', home_show_slide: 'Show {title}' },
        es: { home_load_error: 'No se pudo cargar el contenido de Inicio.', home_stale: 'Se muestra el contenido guardado. No se pudo actualizar ahora.', home_try_again: 'Intentar de nuevo', home_show_slide: 'Mostrar {title}' },
        fr: { home_load_error: 'Le contenu de l’accueil n’a pas pu être chargé.', home_stale: 'Le contenu enregistré est affiché. Actualisation impossible.', home_try_again: 'Réessayer', home_show_slide: 'Afficher {title}' },
        de: { home_load_error: 'Der Startinhalt konnte nicht geladen werden.', home_stale: 'Gespeicherte Inhalte werden angezeigt. Aktualisierung nicht möglich.', home_try_again: 'Erneut versuchen', home_show_slide: '{title} anzeigen' }
    };
    window.merlinI18n?.register(messages);
    const tr = (key, values = {}) => Object.entries(values).reduce(
        (text, [name, value]) => text.replace(`{${name}}`, String(value)),
        window.merlinI18n?.t(key) || messages.ptbr[key] || key
    );

    document.addEventListener('DOMContentLoaded', () => {
        const view = document.getElementById('homeView');
        const carousel = document.getElementById('homeCarousel');
        if (!view || !carousel || !window.electronAPI?.home) return;

        const carouselFrame = carousel.closest('.home-carousel-frame') || carousel;
        const layers = [...carousel.querySelectorAll('.home-carousel-layer')];
        const copy = document.getElementById('homeCarouselCopy');
        const title = document.getElementById('homeTitle');
        const kicker = document.getElementById('homeCarouselKicker');
        const description = document.getElementById('homeCarouselDescription');
        const dots = document.getElementById('homeCarouselDots');
        const previous = document.getElementById('homeCarouselPrevious');
        const next = document.getElementById('homeCarouselNext');
        const primaryButton = document.getElementById('homePremiumBtn');
        const secondaryButton = document.getElementById('homeAddGameBtn');
        const sideStack = view.querySelector('.home-featured-stack');
        const showcaseRow = view.querySelector('.home-game-row');
        const loadState = document.getElementById('homeLoadState');
        const loadStateText = document.getElementById('homeLoadStateText');
        const retryButton = document.getElementById('homeRetryBtn');
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let games = [];
        let activeIndex = 0;
        let activeLayer = 0;
        let rotationTimer = null;
        let dotButtons = [];
        let loading = false;
        let loaded = false;

        function setLoadState(kind) {
            if (!kind) {
                loadState.hidden = true;
                loadState.classList.remove('is-stale');
                return;
            }
            loadStateText.textContent = tr(kind === 'stale' ? 'home_stale' : 'home_load_error');
            retryButton.textContent = tr('home_try_again');
            loadState.classList.toggle('is-stale', kind === 'stale');
            loadState.hidden = false;
        }

        function preload(url) {
            return new Promise(resolve => {
                const image = new Image();
                const timeout = window.setTimeout(resolve, 8000);
                const finish = () => { window.clearTimeout(timeout); resolve(); };
                image.addEventListener('load', finish, { once: true });
                image.addEventListener('error', finish, { once: true });
                image.src = url;
            });
        }

        const positionStyle = item => `${item.imagePositionX}% ${item.imagePositionY}%`;
        const zoomStyle = item => {
            const zoom = Number(item.imageZoom);
            return Number.isFinite(zoom) ? Math.min(4, Math.max(1, zoom)) : 1;
        };

        function applyImageFrame(element, item) {
            const position = positionStyle(item);
            element.style.setProperty('--home-image-zoom', String(zoomStyle(item)));
            element.style.setProperty('--home-image-origin', position);
        }

        function createCard(item, type) {
            const article = document.createElement('article');
            article.className = type === 'side' ? 'home-featured-card' : 'home-game-card';
            if (type === 'side' && item.position === 1) article.classList.add('home-featured-card-main');
            const image = document.createElement('img');
            image.src = item.imageUrl;
            image.alt = '';
            image.style.objectPosition = positionStyle(item);
            applyImageFrame(image, item);
            const meta = document.createElement('div');
            if (type === 'showcase') meta.className = 'home-game-meta';
            const name = document.createElement('strong');
            name.textContent = item.title;
            meta.appendChild(name);
            if (item.secondaryText) {
                const secondary = document.createElement('small');
                secondary.textContent = item.secondaryText;
                meta.appendChild(secondary);
            }
            article.append(image, meta);
            return article;
        }

        const actionLabel = action => action === 'add_game' ? tr('home_add_game') : tr('home_view_premium');

        function configureAction(button, action) {
            button.hidden = action === 'none';
            button.dataset.homeAction = action;
            const label = button.querySelector('span');
            if (label && action !== 'none') label.textContent = actionLabel(action);
        }

        function renderCopy(game) {
            kicker.textContent = game.displayLabel || '';
            kicker.hidden = !game.displayLabel;
            title.textContent = game.title;
            description.textContent = game.description || '';
            description.hidden = !game.description;
            configureAction(primaryButton, game.primaryAction);
            configureAction(secondaryButton, game.secondaryAction);
        }

        function show(index, immediate = false) {
            if (!games.length) return;
            const nextIndex = (index + games.length) % games.length;
            const game = games[nextIndex];
            const nextLayer = immediate ? activeLayer : 1 - activeLayer;
            layers[nextLayer].style.backgroundImage = `url("${game.imageUrl}")`;
            layers[nextLayer].style.backgroundPosition = positionStyle(game);
            applyImageFrame(layers[nextLayer], game);
            if (!immediate) {
                layers[nextLayer].classList.add('is-active');
                layers[activeLayer].classList.remove('is-active');
                activeLayer = nextLayer;
                copy.classList.add('is-changing');
            }
            window.setTimeout(() => {
                renderCopy(game);
                copy.classList.remove('is-changing');
            }, immediate || reducedMotion ? 0 : 180);
            activeIndex = nextIndex;
            dotButtons.forEach((button, dotIndex) => {
                const isActive = dotIndex === activeIndex;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-current', isActive ? 'true' : 'false');
            });
        }

        function stopRotation() {
            if (rotationTimer) window.clearInterval(rotationTimer);
            rotationTimer = null;
        }

        function startRotation() {
            if (reducedMotion || document.hidden || games.length < 2) return;
            stopRotation();
            rotationTimer = window.setInterval(() => show(activeIndex + 1), 6500);
        }

        function restartRotation() {
            stopRotation();
            startRotation();
        }

        function render(home) {
            games = home.hero;
            sideStack.replaceChildren(...home.side.map(item => createCard(item, 'side')));
            showcaseRow.replaceChildren(...home.showcase.map(item => createCard(item, 'showcase')));
            dots.replaceChildren();
            dotButtons = games.map((game, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'home-carousel-dot';
                button.setAttribute('aria-label', tr('home_show_slide', { title: game.title }));
                button.addEventListener('click', () => { show(index); restartRotation(); });
                dots.appendChild(button);
                return button;
            });
            activeIndex = 0;
            activeLayer = 0;
            layers[0].classList.add('is-active');
            layers[1].classList.remove('is-active');
            show(0, true);
            view.classList.remove('is-loading');
            view.setAttribute('aria-busy', 'false');
            loaded = true;
            startRotation();
        }

        async function load({ force = false, showSkeleton = false } = {}) {
            if (loading) return;
            loading = true;
            retryButton.disabled = true;
            const hadContent = loaded;
            if (!hadContent || showSkeleton) {
                view.classList.add('is-loading');
                view.setAttribute('aria-busy', 'true');
            }
            setLoadState(null);
            try {
                const result = await window.electronAPI.home.get({ force });
                if (!result?.success || !result.home) {
                    if (result?.code === 'auth_required') return;
                    throw new Error(result?.message || 'home_load_failed');
                }
                const imageUrls = [...result.home.hero, ...result.home.side, ...result.home.showcase].map(item => item.imageUrl).filter(Boolean);
                await Promise.all(imageUrls.map(preload));
                render(result.home);
                setLoadState(result.stale ? 'stale' : null);
            } catch (_) {
                setLoadState('error');
                if (hadContent) {
                    view.classList.remove('is-loading');
                    view.setAttribute('aria-busy', 'false');
                }
            } finally {
                loading = false;
                retryButton.disabled = false;
            }
        }

        async function refreshWhenHomeReopens() {
            if (!loaded || loading) return;
            try {
                const update = await window.electronAPI.home.checkForUpdate();
                if (update?.success && update.changed) {
                    await load({ force: true, showSkeleton: true });
                }
            } catch (_) {
                // Keep the already-rendered Home when the lightweight revision check fails.
            }
        }

        previous.addEventListener('click', () => { show(activeIndex - 1); restartRotation(); });
        next.addEventListener('click', () => { show(activeIndex + 1); restartRotation(); });
        retryButton.addEventListener('click', () => load({ force: true }));
        carouselFrame.addEventListener('mouseenter', stopRotation);
        carouselFrame.addEventListener('mouseleave', startRotation);
        carouselFrame.addEventListener('focusin', stopRotation);
        carouselFrame.addEventListener('focusout', event => { if (!carouselFrame.contains(event.relatedTarget)) startRotation(); });
        carousel.addEventListener('keydown', event => {
            if (event.key === 'ArrowLeft') previous.click();
            if (event.key === 'ArrowRight') next.click();
        });
        document.addEventListener('visibilitychange', () => { if (document.hidden) stopRotation(); else startRotation(); });
        window.addEventListener('merlin-authenticated', () => { if (!loaded) void load({ force: true }); });
        window.addEventListener('merlin-view-changed', event => {
            if (event.detail?.view === 'home') void refreshWhenHomeReopens();
        });
        window.addEventListener('merlin-language-changed', () => {
            if (loaded && games[activeIndex]) renderCopy(games[activeIndex]);
            dotButtons.forEach((button, index) => button.setAttribute('aria-label', tr('home_show_slide', { title: games[index].title })));
            if (!loadState.hidden) setLoadState(loadState.classList.contains('is-stale') ? 'stale' : 'error');
        });
        void load();
    });
})();
