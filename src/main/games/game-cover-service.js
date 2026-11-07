const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { createCircuitBreaker } = require('../network/circuit-breaker');
const MAX_BYTES = 5 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
function ryuuCover(appId) { return `https://generator.ryuu.lol/files/images/${appId}.jpg`; }
function preferredCover(appId, value) {
    try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return ryuuCover(appId);
        if (host.endsWith('.steamstatic.com') || host === 'steamstatic.com' || host === 'steamcdn-a.akamaihd.net') return url.href;
        if (host === 'api-merlin.com' || host === 'staging.api-merlin.com') return url.href;
        if (host === 'generator.ryuu.lol' && url.pathname === `/files/images/${appId}.jpg`) return url.href;
    } catch { /* Missing/retired cover URL uses the original Ryuu fallback. */ }
    return ryuuCover(appId);
}
function validImage(bytes) {
    return (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ||
        bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
        (bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') ||
        (bytes.toString('ascii',4,8) === 'ftyp' && /avif|avis/.test(bytes.toString('ascii',8,32)));
}
function createGameCoverService({ axios, cacheDirectory, now = Date.now, circuit = createCircuitBreaker({now}), simulateRyuuFailure = false }) {
    const pending = new Map();
    let active = 0;
    const waiting = [];
    async function limited(operation) {
        if (active >= 4) await new Promise(resolve => waiting.push(resolve));
        active++;
        try { return await operation(); }
        finally { active--; waiting.shift()?.(); }
    }
    async function cached(appId) {
        const file = path.join(cacheDirectory(), `${appId}.jpg`);
        try {
            const stat = await fs.stat(file);
            if (!stat.size || stat.size > MAX_BYTES) return null;
            return { url: pathToFileURL(file).href, file, stale: now()-stat.mtimeMs > DAY_MS };
        } catch { return null; }
    }
    function refresh(appId, sourceUrl) {
        if (pending.has(appId)) return pending.get(appId);
        const task = limited(async () => {
            const preferred = preferredCover(appId,sourceUrl);
            const urls = [...new Set([preferred,ryuuCover(appId)])];
            for (const url of urls) {
                const ryuu = new URL(url).hostname === 'generator.ryuu.lol';
                // A Ryuu outage must not block an already known Steam/Merlin
                // photo. Only requests to Ryuu share this circuit.
                if (ryuu && circuit.state().paused) continue;
                try {
                    const download = async () => {
                        if (ryuu && simulateRyuuFailure) throw new Error('Simulated Ryuu outage');
                        const response = await axios.get(url,{timeout:4000,responseType:'arraybuffer',maxContentLength:MAX_BYTES,maxBodyLength:MAX_BYTES,maxRedirects:0,validateStatus:()=>true,headers:{Accept:'image/*','User-Agent':'Merlin/2.0'}});
                        if (response.status !== 200) throw Object.assign(new Error('Cover unavailable'),{status:response.status});
                        const bytes = Buffer.from(response.data);
                        const contentType = String(response.headers?.['content-type']||'').split(';')[0].toLowerCase();
                        if (!bytes.length || bytes.length > MAX_BYTES || !['image/jpeg','image/png','image/webp','image/avif'].includes(contentType) || !validImage(bytes)) throw new Error('Invalid cover response');
                        return {bytes,contentType};
                    };
                    const image = await (ryuu ? circuit.run(download) : download());
                    const directory=cacheDirectory();
                    const file=path.join(directory,`${appId}.jpg`);
                    const temporary=path.join(directory,`${appId}.${randomUUID()}.tmp`);
                    try {
                        await fs.mkdir(directory,{recursive:true});
                        await fs.writeFile(temporary,image.bytes);
                        await fs.rename(temporary,file);
                        return {url:pathToFileURL(file).href,cached:false};
                    } catch {
                        await fs.unlink(temporary).catch(()=>{});
                        return {url:`data:${image.contentType};base64,${image.bytes.toString('base64')}`,cached:false};
                    }
                } catch { /* Preserve the local photo; a failed origin never clears it. */ }
            }
            return {url:null,cached:false,paused:circuit.state().paused};
        });
        pending.set(appId,task);
        void task.finally(()=>pending.delete(appId)).catch(()=>{});
        return task;
    }
    async function load(appId, sourceUrl) {
        if (typeof appId !== 'string' || !/^\d{1,12}$/.test(appId)) throw new Error('Invalid App ID');
        const local = await cached(appId);
        if (local) {
            if (local.stale) void refresh(appId,sourceUrl).catch(()=>{});
            return {url:local.url,cached:true};
        }
        return refresh(appId,sourceUrl);
    }
    return { load, state: circuit.state };
}
module.exports = { createGameCoverService, preferredCover };
