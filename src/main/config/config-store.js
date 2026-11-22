const { randomUUID } = require('node:crypto');

function createConfigStore({ fs, path, getFilePath, defaults }) {
    let config = { ...defaults };

    function load() {
        try {
            const configFile = getFilePath();
            if (fs.existsSync(configFile)) {
                const savedConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                config = { ...defaults, ...savedConfig };
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
        return config;
    }

    function save() {
        let temporary;
        try {
            const configFile = getFilePath();
            fs.mkdirSync(path.dirname(configFile), { recursive: true });
            temporary = `${configFile}.${process.pid}.${randomUUID()}.tmp`;
            fs.writeFileSync(temporary, JSON.stringify(config, null, 2), { flag: 'wx' });
            fs.renameSync(temporary, configFile);
        } catch (error) {
            console.error('Error saving config:', error);
        } finally {
            if (temporary) {
                try { fs.unlinkSync(temporary); }
                catch (error) { if (error.code !== 'ENOENT') console.error('Error cleaning config temporary file:', error); }
            }
        }
    }

    function get() {
        return config;
    }

    function update(values) {
        config = { ...config, ...values };
        save();
        return config;
    }

    return { get, load, save, update };
}

module.exports = { createConfigStore };
