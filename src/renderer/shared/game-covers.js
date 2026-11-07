(() => {
    function url(appId) {
        const id = String(appId || '').trim();
        return /^\d{1,12}$/.test(id) ? `https://generator.ryuu.lol/files/images/${id}.jpg` : null;
    }
    const loads = new WeakMap();
    const active = new Set();
    if (typeof MutationObserver !== 'undefined') {
        new MutationObserver(records => {
            for (const state of active) {
                if (state.image.isConnected) continue;
                if (records.some(record => [...record.removedNodes].some(node => node === state.image || node.contains?.(state.image)))) state.stop();
            }
        }).observe(document.documentElement, {childList:true,subtree:true});
    }
    function load(image, appId, sourceUrl) {
        const src = url(appId);
        if (!src) return;
        const previous = loads.get(image);
        previous?.stop();
        image.dataset.merlinCoverAppId = String(appId).trim();
        image.classList.add('merlin-game-cover-pending');
        const state = { image, src, done: false, started: false, timer: null, observer: null, stop: null };
        const onLoad = () => { stop(); image.classList.remove('merlin-game-cover-pending'); };
        const stop = () => {
            state.done = true;
            clearTimeout(state.timer);
            state.observer?.disconnect();
            image.removeEventListener('load', onLoad);
            image.removeEventListener('error', stop);
            active.delete(state);
        };
        state.stop = stop;
        loads.set(image, state);
        active.add(state);
        image.addEventListener('load', onLoad, { once: true });
        image.addEventListener('error', stop, { once: true });
        const start = async () => {
            state.observer?.disconnect();
            if (state.started || state.done) return;
            state.started = true;
            state.timer = setTimeout(() => {
                if (loads.get(image) !== state || state.done) return;
                image.dispatchEvent(new Event('error'));
                if (image.getAttribute('src') === src) image.removeAttribute('src');
            }, 10000);
            try {
                const result = await window.electronAPI?.gameCovers?.load?.(String(appId).trim(), sourceUrl);
                if (state.done || loads.get(image) !== state) return;
                if (result?.url) image.src = result.url;
                else image.dispatchEvent(new Event('error'));
            } catch {
                if (!state.done && loads.get(image) === state) image.dispatchEvent(new Event('error'));
            }
        };
        if (image.loading === 'lazy' && typeof IntersectionObserver !== 'undefined') {
            state.observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) start(); });
            state.observer.observe(image);
        } else start();
    }
    function retain(container) {
        const images = new Map();
        container.querySelectorAll('img[data-merlin-cover-app-id]').forEach(image => {
            const appId = image.dataset.merlinCoverAppId;
            const state = loads.get(image);
            if (appId && ((state && !state.done) || image.naturalWidth)) images.set(appId, image);
        });
        return images;
    }
    window.merlinGameCovers = { url, load, retain };
})();
