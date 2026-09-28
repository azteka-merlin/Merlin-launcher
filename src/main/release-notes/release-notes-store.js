const { normalizeReleaseList } = require('./release-notes-client');

function createReleaseNotesStore({ fs, path, getFilePath }) {
    function readPayload() {
        try {
            const filePath = getFilePath();
            if (!fs.existsSync(filePath)) return { version: 1, entries: {} };
            const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            return payload && payload.version === 1 && payload.entries && typeof payload.entries === 'object'
                ? payload
                : { version: 1, entries: {} };
        } catch (error) {
            console.warn('Unable to load release notes cache:', error.message);
            return { version: 1, entries: {} };
        }
    }

    function load(locale) {
        const entry = readPayload().entries?.[locale];
        if (!entry) return null;
        const releases = normalizeReleaseList(entry.releases, entry.baseUrl);
        return releases.length ? releases : null;
    }

    function save(locale, releases, baseUrl) {
        const normalized = normalizeReleaseList(releases, baseUrl);
        const payload = readPayload();
        payload.entries[locale] = { savedAt: new Date().toISOString(), baseUrl, releases: normalized };
        const filePath = getFilePath();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
        return normalized;
    }

    return { load, save };
}

module.exports = { createReleaseNotesStore };
