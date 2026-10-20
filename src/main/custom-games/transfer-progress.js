const WINDOW_MS = 30_000;

// Counts are cumulative for the whole installation, never for just the current ZIP.
function createTransferMeter({ windowMs = WINDOW_MS, minimumSampleMs = 8_000 } = {}) {
    const samples = [];
    let previous = null;
    return {
        update(bytes, totalBytes, files = 0, totalFiles = 0, now = Date.now()) {
            if (previous && (bytes < previous.bytes || files < previous.files || now - previous.at > windowMs)) samples.length = 0;
            else if (previous && now > previous.at) samples.push({ from: previous.at, at: now,
                bytes: bytes - previous.bytes, files: files - previous.files });
            previous = { bytes, files, at: now };
            while (samples.length && now - samples[0].at > windowMs) samples.shift();
            const elapsed = samples.length ? now - samples[0].from : 0;
            const speed = elapsed > 0 ? samples.reduce((sum, sample) => sum + sample.bytes, 0) * 1000 / elapsed : 0;
            const fileSpeed = elapsed > 0 ? samples.reduce((sum, sample) => sum + sample.files, 0) * 1000 / elapsed : 0;
            const estimates = [];
            if (totalBytes > bytes && speed > 0) estimates.push((totalBytes - bytes) / speed);
            if (totalFiles > files && fileSpeed > 0) estimates.push((totalFiles - files) / fileSpeed);
            return { speedBytesPerSecond: speed,
                etaSeconds: bytes >= totalBytes && files >= totalFiles ? 0
                    : elapsed >= minimumSampleMs && estimates.length ? Math.ceil(Math.max(...estimates)) : null };
        },
    };
}

function createTaskLimiter(concurrency) {
    let running = 0;
    const waiting = [];
    return async task => {
        if (running >= concurrency) await new Promise(resolve => waiting.push(resolve));
        else running++;
        try { return await task(); }
        finally {
            const next = waiting.shift();
            if (next) next();
            else running--;
        }
    };
}

module.exports = { createTransferMeter, createTaskLimiter };
