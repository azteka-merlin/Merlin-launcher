function createDevShutdownRequest({ fs, path, appDataPath }) {
    const requestPath = path.join(appDataPath, 'Merlin', 'merlin.dev-shutdown.request');

    const clear = () => {
        try { fs.unlinkSync(requestPath); } catch (error) { if (error?.code !== 'ENOENT') throw error; }
    };

    const request = () => {
        fs.mkdirSync(path.dirname(requestPath), { recursive: true });
        fs.writeFileSync(requestPath, String(Date.now()), 'utf8');
    };

    const consume = () => {
        if (!fs.existsSync(requestPath)) return false;
        clear();
        return true;
    };

    return { clear, request, consume, requestPath };
}

module.exports = { createDevShutdownRequest };
