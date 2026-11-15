const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const LOG_NAME = 'merlin_game_add.log';
const MAX_BYTES = 1024 * 1024;

function createGameAddLog({ localAppData, requiredFiles, getSourcePath, fileSystem = fs }) {
    if (!localAppData) return () => {};
    const logDirectory = path.join(localAppData, 'Merlin', 'logs');
    const logPath = path.join(logDirectory, LOG_NAME);

    function runtimeState(steamPath) {
        if (!steamPath) return [];
        return requiredFiles.map(file => {
            const destination = path.join(steamPath, file.relativeDestination);
            try {
                const source = getSourcePath(file);
                const sourceStats = fileSystem.statSync(source);
                const installedStats = fileSystem.statSync(destination);
                if (!sourceStats.isFile() || !installedStats.isFile()) return { file: file.name, state: 'invalid' };
                if (sourceStats.size !== installedStats.size) return { file: file.name, state: 'different' };
                const digest = target => crypto.createHash('sha256').update(fileSystem.readFileSync(target)).digest('hex');
                return { file: file.name, state: digest(source) === digest(destination) ? 'matches' : 'different' };
            } catch (error) {
                return { file: file.name, state: error?.code === 'ENOENT' ? 'missing' : 'unreadable' };
            }
        });
    }

    return function record(event) {
        try {
            fileSystem.mkdirSync(logDirectory, { recursive: true });
            const entry = { at: new Date().toISOString(), ...event };
            if (event.stage === 'start') entry.runtime = runtimeState(event.steamPath);
            delete entry.steamPath;
            const line = `${JSON.stringify(entry)}\n`;
            if (fileSystem.existsSync(logPath)) {
                const stats = fileSystem.lstatSync(logPath);
                if (!stats.isFile() || stats.isSymbolicLink()) return;
                if (stats.size + Buffer.byteLength(line) > MAX_BYTES) {
                    if (fileSystem.existsSync(`${logPath}.1`)) {
                        const previous = fileSystem.lstatSync(`${logPath}.1`);
                        if (!previous.isFile() || previous.isSymbolicLink()) return;
                        fileSystem.unlinkSync(`${logPath}.1`);
                    }
                    fileSystem.renameSync(logPath, `${logPath}.1`);
                }
            }
            fileSystem.appendFileSync(logPath, line, 'utf8');
        } catch {
            // Diagnostics must never interrupt game installation.
        }
    };
}

module.exports = { LOG_NAME, createGameAddLog };
