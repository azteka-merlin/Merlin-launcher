const fs = require('node:fs');
const { Readable } = require('node:stream');

// Uses zlib-streams 1.4.0's WASM codec (Gildas Lormeau, BSD-3-Clause;
// zlib/Chromium notices are included in THIRD_PARTY_NOTICES.txt). This adapter
// supplies bounded, pull-based backpressure instead of the upstream JS driver.
const BUFFER_BYTES = 64 * 1024;
let instance;
function codec() {
    if (!instance) {
        const module = new WebAssembly.Module(fs.readFileSync(require.resolve('zlib-streams/zlib-streams.wasm')));
        const api = new WebAssembly.Instance(module).exports;
        api._initialize?.();
        instance = api;
    }
    return instance;
}

function inflateDeflate64(source) {
    const api = codec();
    const reader = source.getReader();
    let handle = 0, input = 0, output = 0;
    let inputOffset = 0, inputLength = 0;
    let pending, pendingOffset = 0;
    let sourceEnded = false, finished = false, disposed = false;
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        if (handle) api.inflate9_end(handle);
        if (input) api.free(input);
        if (output) api.free(output);
        handle = input = output = 0;
        pending = undefined;
        try { reader.releaseLock(); } catch { /* A pending read settles after cancellation. */ }
    };
    try {
        handle = api.inflate9_new(); input = api.malloc(BUFFER_BYTES); output = api.malloc(BUFFER_BYTES);
        if (!handle || !input || !output || api.inflate9_init_raw(handle) !== 0) throw new Error('deflate64_init_failed');
    } catch (error) {
        void reader.cancel(error).catch(() => {});
        dispose();
        throw error;
    }
    async function fillInput() {
        if (inputOffset < inputLength || sourceEnded || finished) return;
        inputOffset = inputLength = 0;
        while (!pending || pendingOffset === pending.byteLength) {
            pending = undefined; pendingOffset = 0;
            const next = await reader.read();
            if (finished) return;
            if (next.done) { sourceEnded = true; return; }
            pending = next.value;
            if (!(pending instanceof Uint8Array)) throw new Error('invalid_deflate64_data');
            if (pending.byteLength) break;
        }
        const length = Math.min(BUFFER_BYTES, pending.byteLength - pendingOffset);
        new Uint8Array(api.memory.buffer).set(pending.subarray(pendingOffset, pendingOffset + length), input);
        pendingOffset += length; inputLength = length;
    }
    async function requireEndOfSource() {
        if (inputOffset < inputLength || (pending && pendingOffset < pending.byteLength)) throw new Error('deflate64_trailing_data');
        pending = undefined;
        while (!sourceEnded && !finished) {
            const next = await reader.read();
            if (next.done) sourceEnded = true;
            else if (next.value.byteLength) throw new Error('deflate64_trailing_data');
        }
    }
    return new ReadableStream({
        async pull(controller) {
            try {
                while (!finished) {
                    await fillInput();
                    if (finished) return;
                    const remaining = inputLength - inputOffset;
                    const result = api.inflate9_process(handle, remaining ? input + inputOffset : 0,
                        remaining, output, BUFFER_BYTES, 0);
                    const status = result >> 24;
                    const produced = result & 0x00ffffff;
                    const consumed = api.inflate9_last_consumed(handle);
                    if (produced > BUFFER_BYTES || consumed > remaining || consumed < 0) throw new Error('invalid_deflate64_state');
                    inputOffset += consumed;
                    if (status < 0 && status !== -5) throw new Error('invalid_deflate64_data');
                    if (status === 1) {
                        await requireEndOfSource();
                        if (finished) return;
                        const chunk = produced ? new Uint8Array(api.memory.buffer).slice(output, output + produced) : undefined;
                        finished = true; dispose();
                        if (chunk) controller.enqueue(chunk);
                        controller.close();
                        return;
                    }
                    if (!produced && !consumed) throw new Error(sourceEnded ? 'deflate64_truncated' : 'deflate64_no_progress');
                    if (produced) {
                        controller.enqueue(new Uint8Array(api.memory.buffer).slice(output, output + produced));
                        return;
                    }
                }
            } catch (error) {
                finished = true;
                await reader.cancel(error).catch(() => {});
                dispose();
                controller.error(error);
            }
        },
        async cancel(reason) {
            finished = true;
            await reader.cancel(reason).catch(() => {});
            dispose();
        },
    }, { highWaterMark: 0 });
}

function decodeDeflate64(source) {
    try {
        return Readable.fromWeb(inflateDeflate64(Readable.toWeb(source)), { highWaterMark: BUFFER_BYTES });
    } catch (error) {
        source.destroy();
        throw error;
    }
}

module.exports = { decodeDeflate64, inflateDeflate64 };
