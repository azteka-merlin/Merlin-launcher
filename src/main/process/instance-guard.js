function createInstanceGuard({ fs, path, appDataPath, pid = process.pid, isProcessRunning, terminateProcess = () => false }) {
    const lockDirectory = path.join(appDataPath, 'Merlin');
    const lockPath = path.join(lockDirectory, 'merlin.instance.lock');
    let ownsLock = false;

    const readOwner = () => {
        try {
            const value = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
            return Number.isInteger(value?.pid) && value.pid > 0 ? value.pid : null;
        } catch {
            return null;
        }
    };

    const removeStaleLock = () => {
        try {
            fs.unlinkSync(lockPath);
            return true;
        } catch {
            return false;
        }
    };

    const acquire = ({ replaceExisting = false } = {}) => {
        fs.mkdirSync(lockDirectory, { recursive: true });
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                fs.writeFileSync(lockPath, JSON.stringify({ pid }), { encoding: 'utf8', flag: 'wx' });
                ownsLock = true;
                return true;
            } catch (error) {
                if (error?.code !== 'EEXIST') return false;
                const ownerPid = readOwner();
                if (ownerPid && isProcessRunning(ownerPid)) {
                    if (!replaceExisting || ownerPid === pid || !terminateProcess(ownerPid) || isProcessRunning(ownerPid)) return false;
                }
                if (!removeStaleLock()) return false;
            }
        }
        return false;
    };

    const release = () => {
        if (!ownsLock) return;
        if (readOwner() === pid) removeStaleLock();
        ownsLock = false;
    };

    return { acquire, release, lockPath };
}

module.exports = { createInstanceGuard };
