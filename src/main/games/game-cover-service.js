const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { createCircuitBreaker } = require('../network/circuit-breaker');
const MAX_BYTES = 5 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const SHARED_TIMEOUT = 450;
const CHECK_INTERVAL = 10 * 60 * 1000;
function ryuuCover(appId) { return `https://generator.ryuu.lol/files/images/${appId}.jpg`; }
function steamCover(appId) { return `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`; }
function preferredCover(appId, value) {
    try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return ryuuCover(appId);
        if (host.endsWith('.steamstatic.com') || host === 'steamstatic.com' || host === 'steamcdn-a.akamaihd.net') return url.href;
        if (host === 'api-merlin.com' || host === 'staging.api-merlin.com') return url.href;
        if (host === 'generator.ryuu.lol' && /^\/files\/images\/\d{1,12}\.jpg$/.test(url.pathname)) return url.href;
    } catch { /* Missing/retired cover URL uses the original Ryuu fallback. */ }
    return ryuuCover(appId);
}
function validImage(bytes) {
    return (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
        bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
        (bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') ||
        (bytes.toString('ascii',4,8) === 'ftyp' && /avif|avis/.test(bytes.toString('ascii',8,32)));
}
function limitConcurrency(concurrency) {
    let active = 0;
    const waiting = [];
    return async operation => {
        if (active >= concurrency) await new Promise(resolve => waiting.push(resolve));
        else active++;
        try {
            return await operation();
        } finally {
            const next = waiting.shift();
            if (next) next();
            else active--;
        }
    };
}

function createGameCoverService({ axios, cacheDirectory, now = Date.now, circuit = createCircuitBreaker({now}), simulateRyuuFailure = false, shared }) {
    const pending = new Map();
    const sharedChecks = new Map();
    const localProbes = new Set();
    const limitDownload = limitConcurrency(4);
    const limitProbe = limitConcurrency(2);
    async function cached(appId) {
        const file = path.join(cacheDirectory(), `${appId}.jpg`);
        try {
            const stat = await fs.stat(file);
            if (!stat.size || stat.size > MAX_BYTES) return null;
            return { url: pathToFileURL(file).href, file, stale: now()-stat.mtimeMs > DAY_MS };
        } catch { return null; }
    }
    function rememberSharedCheck(appId, interval = CHECK_INTERVAL) {
        sharedChecks.delete(appId);
        sharedChecks.set(appId, now() + interval);
        if (sharedChecks.size > 2000) sharedChecks.delete(sharedChecks.keys().next().value);
    }

    function reportMissing(appId, sourceUrl) {
        if (!shared || sharedChecks.get(appId) > now()) return;
        rememberSharedCheck(appId);
        void Promise.resolve().then(() => shared.report(appId, sourceUrl)).catch(() => {
            rememberSharedCheck(appId, 60 * 1000);
        });
    }

    async function fetchImage(url, timeout) {
        const response = await axios.get(url, {
            timeout, responseType: 'arraybuffer', maxContentLength: MAX_BYTES, maxBodyLength: MAX_BYTES,
            maxRedirects: 0, validateStatus: () => true, headers: { Accept: 'image/*', 'User-Agent': 'Merlin/2.0' }
        });
        if (response.status !== 200) throw Object.assign(new Error('Cover unavailable'), { status: response.status });
        const bytes = Buffer.from(response.data);
        const contentType = String(response.headers?.['content-type'] || '').split(';')[0].toLowerCase();
        if (!bytes.length || bytes.length > MAX_BYTES || !['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(contentType) || !validImage(bytes)) {
            throw new Error('Invalid cover response');
        }
        return { bytes, contentType };
    }

    async function saveImage(appId, image) {
        const directory = cacheDirectory();
        const file = path.join(directory, appId + '.jpg');
        const temporary = path.join(directory, appId + '.' + randomUUID() + '.tmp');
        try {
            await fs.mkdir(directory, { recursive: true });
            await fs.writeFile(temporary, image.bytes);
            try {
                await fs.rename(temporary, file);
            } catch {
                // Windows may reject renaming over a cached image that is in use.
                await fs.copyFile(temporary, file);
                await fs.unlink(temporary);
            }
            return { url: pathToFileURL(file).href, cached: false };
        } catch {
            await fs.unlink(temporary).catch(() => {});
            return { url: 'data:' + image.contentType + ';base64,' + image.bytes.toString('base64'), cached: false };
        }
    }

    function checkLocalImage(appId, sourceUrl) {
        if (!shared || sharedChecks.get(appId) > now() || localProbes.has(appId)) return;
        localProbes.add(appId);
        void limitProbe(async () => {
            const response = await axios.head(shared.url + '/' + appId, {
                timeout: SHARED_TIMEOUT, maxRedirects: 0, validateStatus: () => true,
            });
            if (response.status === 404) reportMissing(appId, sourceUrl);
            else rememberSharedCheck(appId, response.status === 200 ? CHECK_INTERVAL : 60 * 1000);
        }).catch(() => rememberSharedCheck(appId, 60 * 1000)).finally(() => localProbes.delete(appId));
    }

    function refresh(appId, sourceUrl, { allowRyuu = true, localAvailable = false } = {}) {
        if (pending.has(appId)) return pending.get(appId);
        const task = limitDownload(async () => {
            if (shared) {
                try {
                    const image = await fetchImage(shared.url + '/' + appId, SHARED_TIMEOUT);
                    rememberSharedCheck(appId);
                    return saveImage(appId, image);
                } catch (error) {
                    if (localAvailable && error.status === 404) reportMissing(appId, sourceUrl);
                }
            }
            const preferred = preferredCover(appId,sourceUrl);
            const urls = [...new Set(allowRyuu ? [preferred, ryuuCover(appId)] : [preferred, steamCover(appId)])]
                .filter(url => allowRyuu || new URL(url).hostname !== 'generator.ryuu.lol');
            for (const url of urls) {
                const ryuu = new URL(url).hostname === 'generator.ryuu.lol';
                // A Ryuu outage must not block an already known Steam/Merlin
                // photo. Only requests to Ryuu share this circuit.
                if (ryuu && circuit.state().paused) continue;
                try {
                    const download = async () => {
                        if (ryuu && simulateRyuuFailure) throw new Error('Simulated Ryuu outage');
                        return fetchImage(url, 4000);
                    };
                    const image = await (ryuu ? circuit.run(download) : download());
                    reportMissing(appId, url);
                    return saveImage(appId, image);
                } catch { /* Preserve the local photo; a failed origin never clears it. */ }
            }
            return {url:null,cached:false,paused:circuit.state().paused};
        });
        pending.set(appId,task);
        void task.finally(()=>pending.delete(appId)).catch(()=>{});
        return task;
    }
    async function load(appId, sourceUrl, options = {}) {
        if (typeof appId !== 'string' || !/^\d{1,12}$/.test(appId)) throw new Error('Invalid App ID');
        const local = await cached(appId);
        if (local) {
            if (local.stale) void refresh(appId, sourceUrl, { ...options, localAvailable: true }).catch(() => {});
            else checkLocalImage(appId, sourceUrl);
            return {url:local.url,cached:true};
        }
        return refresh(appId,sourceUrl,options);
    }
    return { load, state: circuit.state };
}
module.exports = { createGameCoverService, preferredCover };
