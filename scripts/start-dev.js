const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const electron = require('electron');
const { createDevShutdownRequest } = require('../src/main/process/dev-shutdown-request');

const appDataPath = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const shutdownRequest = createDevShutdownRequest({ fs, path, appDataPath });
shutdownRequest.clear();

const child = spawn(electron, ['.'], { cwd: path.join(__dirname, '..'), detached: true, stdio: 'inherit', windowsHide: true });
let stopping = false;

const stopGracefully = signal => {
    if (stopping) return;
    stopping = true;
    console.info(`Merlin dev controller: ${signal}; requesting graceful shutdown`);
    shutdownRequest.request();
    const timeout = setTimeout(() => process.exit(0), 3000);
    child.once('exit', () => { clearTimeout(timeout); process.exit(0); });
};

process.once('SIGINT', () => stopGracefully('SIGINT'));
process.once('SIGTERM', () => stopGracefully('SIGTERM'));
child.once('exit', code => process.exit(code ?? 0));
