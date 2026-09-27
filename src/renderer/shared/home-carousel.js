(() => {
    const games = [
        {
            title: 'CONTROL Resonant',
            kicker: 'LANÇAMENTO • 24 SET 2026',
            description: 'Uma nova ameaça paranormal transforma Manhattan em um campo de batalha sobrenatural.',
            image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3669870/bcda7ae5b393697f658d82aa5ffedaac7511130d/page_bg_raw.jpg'
        },
        {
            title: 'Graveyard Keeper 2',
            kicker: 'LANÇAMENTO • 22 SET 2026',
            description: 'Construa, automatize e proteja uma cidade medieval com seu próprio exército de mortos-vivos.',
            image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4358690/b3d62f77a0c9fa2f59c6baaba11a9af5eada2927/ss_b3d62f77a0c9fa2f59c6baaba11a9af5eada2927.1920x1080.jpg'
        },
        {
            title: 'SILENT HILL: Townfall',
            kicker: 'LANÇAMENTO • 23 SET 2026',
            description: 'Uma experiência de terror psicológico envolta em mistério, culpa e segredos inquietantes.',
            image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1636440/0ed1cb4bc30631f95b92f7f13bb06c15d49b4afa/header.jpg'
        },
        {
            title: 'Phantom Blade Zero',
            kicker: 'EM BREVE • 28 OUT 2026',
            description: 'Combate veloz, fantasia sombria e a elegância marcial do Wuxia em uma jornada cinematográfica.',
            image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4115450/8477e332081c0d28657885bf4b3c509823e289c9/page_bg_raw.jpg'
        },
        {
            title: 'Permafrost',
            kicker: 'EM BREVE • 09 OUT 2026',
            description: 'Sobreviva a um mundo congelado, explore ruínas e reconstrua seu abrigo em meio ao inverno eterno.',
            image: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2254990/30644896ad16ac56ca9bb9f006999e731c81902b/page_bg_raw.jpg'
        }
    ];

    document.addEventListener('DOMContentLoaded', () => {
        const carousel = document.getElementById('homeCarousel');
        if (!carousel) return;

        const carouselFrame = carousel.closest('.home-carousel-frame') || carousel;
        const layers = [...carousel.querySelectorAll('.home-carousel-layer')];
        const copy = document.getElementById('homeCarouselCopy');
        const title = document.getElementById('homeTitle');
        const kicker = document.getElementById('homeCarouselKicker');
        const description = document.getElementById('homeCarouselDescription');
        const dots = document.getElementById('homeCarouselDots');
        const previous = document.getElementById('homeCarouselPrevious');
        const next = document.getElementById('homeCarouselNext');
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let activeIndex = 0;
        let activeLayer = 0;
        let rotationTimer = null;

        const dotButtons = games.map((game, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'home-carousel-dot';
            button.setAttribute('aria-label', `Exibir ${game.title}`);
            button.addEventListener('click', () => {
                show(index);
                restartRotation();
            });
            dots.appendChild(button);
            return button;
        });

        const renderCopy = (game) => {
            kicker.textContent = game.kicker;
            title.textContent = game.title;
            description.textContent = game.description;
        };

        const show = (index, immediate = false) => {
            const nextIndex = (index + games.length) % games.length;
            const game = games[nextIndex];
            const nextLayer = immediate ? activeLayer : 1 - activeLayer;
            const image = new Image();

            image.addEventListener('load', () => {
                layers[nextLayer].style.backgroundImage = `url("${game.image}")`;
                if (!immediate) {
                    layers[nextLayer].classList.add('is-active');
                    layers[activeLayer].classList.remove('is-active');
                    activeLayer = nextLayer;
                }
            }, { once: true });
            image.src = game.image;

            if (!immediate) copy.classList.add('is-changing');
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
        };

        const stopRotation = () => {
            if (rotationTimer) window.clearInterval(rotationTimer);
            rotationTimer = null;
        };

        const startRotation = () => {
            if (reducedMotion || document.hidden) return;
            stopRotation();
            rotationTimer = window.setInterval(() => show(activeIndex + 1), 6500);
        };

        const restartRotation = () => {
            stopRotation();
            startRotation();
        };

        previous.addEventListener('click', () => {
            show(activeIndex - 1);
            restartRotation();
        });
        next.addEventListener('click', () => {
            show(activeIndex + 1);
            restartRotation();
        });
        carouselFrame.addEventListener('mouseenter', stopRotation);
        carouselFrame.addEventListener('mouseleave', startRotation);
        carouselFrame.addEventListener('focusin', stopRotation);
        carouselFrame.addEventListener('focusout', event => {
            if (!carouselFrame.contains(event.relatedTarget)) startRotation();
        });
        carousel.addEventListener('keydown', event => {
            if (event.key === 'ArrowLeft') previous.click();
            if (event.key === 'ArrowRight') next.click();
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stopRotation();
            else startRotation();
        });

        layers[0].style.backgroundImage = `url("${games[0].image}")`;
        show(0, true);
        startRotation();
    });
})();
