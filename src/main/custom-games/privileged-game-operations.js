const net = require('node:net');

const PIPE_PATH = '\\\\.\\pipe\\Merlin.GameOperations.v1';

function createPrivilegedGameOperations({ connect = net.createConnection, timeoutMs = 15000 } = {}) {
    async function request(payload) {
        if (process.platform !== 'win32') return { success: false, code: 'helper_unsupported' };
        return new Promise(resolve => {
            let settled = false;
            let response = '';
            const finish = result => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                try { socket.destroy(); } catch { /* The pipe may already be closed. */ }
                resolve(result);
            };

            const socket = connect(PIPE_PATH);
            const timer = setTimeout(() => finish({ success: false, code: 'helper_timeout' }), timeoutMs);
            socket.setEncoding('utf8');
            socket.on('connect', () => {
                socket.end(JSON.stringify(payload) + '\n');
            });
            socket.on('data', chunk => {
                response += chunk;
                if (response.length > 8192) return finish({ success: false, code: 'invalid_response' });
                const newline = response.indexOf('\n');
                if (newline < 0) return;
                try {
                    const result = JSON.parse(response.slice(0, newline));
                    finish({ success: result?.success === true, code: String(result?.code || 'invalid_response') });
                } catch { finish({ success: false, code: 'invalid_response' }); }
            });
            socket.on('error', error => finish({ success: false,
                code: error.code === 'ENOENT' || error.code === 'ECONNREFUSED' ? 'helper_unavailable' : 'helper_unavailable' }));
            socket.on('close', () => {
                if (!settled) finish({ success: false, code: 'helper_unavailable' });
            });
        });
    }

    async function closeGame({ root, executable, graceMilliseconds = 12000 }) {
        if (typeof root !== 'string' || typeof executable !== 'string') {
            return { success: false, code: 'invalid_request' };
        }
        return request({ operation: 'close-game', root, executable,
            graceMilliseconds: Math.max(0, Math.min(12000, Number(graceMilliseconds) || 0)) });
    }

    async function prepareDrive(letter) {
        const drive = String(letter || '').trim().toUpperCase();
        if (!/^[C-Z]$/.test(drive)) return { success: false, code: 'drive_not_allowed' };
        return request({ operation: 'prepare-drive', drive });
    }

    return { closeGame, prepareDrive };
}

const privilegedGameOperations = createPrivilegedGameOperations();

module.exports = { createPrivilegedGameOperations, privilegedGameOperations, PIPE_PATH };
