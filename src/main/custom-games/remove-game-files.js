const fs = require('node:fs/promises');
const path = require('node:path');

// Stream both traversals so large installations do not require an in-memory file list.
async function removeGameFiles(root, report) {
    let totalItems = 0;
    let removedItems = 0;
    const checkDirectory = async directory => {
        const stat = await fs.lstat(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink() ||
            (await fs.realpath(directory)).toLowerCase() !== directory.toLowerCase()) {
            throw new Error('invalid_install_path');
        }
    };
    async function count(directory) {
        await checkDirectory(directory);
        for await (const entry of await fs.opendir(directory)) {
            if (directory === root && entry.name.toLowerCase() === '.merlin-install.json') continue;
            totalItems++;
            report({ phase: 'counting', totalItems, removedItems });
            if (entry.isDirectory()) await count(path.join(directory, entry.name));
        }
    }
    const removed = () => {
        removedItems++;
        report({ phase: 'removing', totalItems, removedItems });
    };
    async function remove(directory) {
        await checkDirectory(directory);
        const pending = [];
        const flush = async () => {
            const results = await Promise.allSettled(pending.splice(0));
            const failure = results.find(result => result.status === 'rejected');
            if (failure) throw failure.reason;
        };
        try {
            for await (const entry of await fs.opendir(directory)) {
                if (directory === root && entry.name.toLowerCase() === '.merlin-install.json') continue;
                const target = path.join(directory, entry.name);
                if (entry.isDirectory()) {
                    await flush();
                    await remove(target);
                    await fs.rmdir(target);
                    removed();
                } else {
                    // rm unlinks junctions and symlinks without traversing their targets.
                    const task = fs.rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).then(removed);
                    task.catch(() => {});
                    pending.push(task);
                    if (pending.length >= 16) await flush();
                }
            }
            await flush();
        } finally { await Promise.allSettled(pending); }
    }
    report({ phase: 'counting', totalItems, removedItems });
    await count(root);
    report({ phase: 'removing', totalItems, removedItems });
    await remove(root);
    return { totalItems, removedItems };
}

module.exports = { removeGameFiles };
