const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function migrateConfig(source, destination) {
    if (path.resolve(source) === path.resolve(destination) || fs.existsSync(destination)) return false;
    let contents;
    try {
        if (!fs.lstatSync(source).isFile()) return false;
        contents = fs.readFileSync(source, 'utf8');
        const value = JSON.parse(contents);
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    } catch (error) {
        if (error.code === 'ENOENT' || error instanceof SyntaxError) return false;
        throw error;
    }

    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
    try {
        fs.writeFileSync(temporary, contents, { flag: 'wx' });
        // An exclusive hard link publishes the complete file atomically, including
        // when another process creates the destination while migration is running.
        try { fs.linkSync(temporary, destination); }
        catch (error) {
            if (error.code === 'EEXIST') return false;
            throw error;
        }
        return true;
    } finally {
        try { fs.unlinkSync(temporary); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
}

module.exports = { migrateConfig };
