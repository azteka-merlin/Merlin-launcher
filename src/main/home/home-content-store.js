const { normalizeHomeContent } = require('./home-content-client');

function createHomeContentStore({ fs, path, getFilePath }) {
    function load() {
        try {
            const filePath = getFilePath();
            if (!fs.existsSync(filePath)) return null;
            const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return normalizeHomeContent(payload?.home, payload?.baseUrl);
        } catch (error) {
            console.warn('Unable to load Home content cache:', error.message);
            return null;
        }
    }

    function save(home, baseUrl) {
        const normalized = normalizeHomeContent(home, baseUrl);
        if (!normalized) return null;
        const filePath = getFilePath();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({ version: 1, savedAt: new Date().toISOString(), baseUrl, home: normalized }, null, 2), 'utf8');
        return normalized;
    }

    return { load, save };
}

module.exports = { createHomeContentStore };
