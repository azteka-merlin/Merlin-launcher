function normalizeItem(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const appId = String(value.appId || '').trim();
    const gameName = typeof value.gameName === 'string' ? value.gameName.trim() : '';
    const imageUrl = typeof value.imageUrl === 'string' ? value.imageUrl.trim() : '';
    const installSubpath = typeof value.installSubpath === 'string'
        ? value.installSubpath.trim()
        : '';
    const activationType = value.activationType === 'third_party'
        ? 'third_party'
        : 'steam_ticket';
    const launchExecutablePath = typeof value.launchExecutablePath === 'string'
        ? value.launchExecutablePath.trim()
        : '';
    const activationLimit = Math.max(1, Math.trunc(Number(value.activationLimit) || 0));
    const availability = value.availability && typeof value.availability === 'object'
        ? {
            activeCount: Math.max(0, Math.trunc(Number(value.availability.activeCount) || 0)),
            reservedCount: Math.max(0, Math.trunc(Number(value.availability.reservedCount) || 0)),
            occupiedSlots: Math.max(0, Math.trunc(Number(value.availability.occupiedSlots) || 0)),
            availableSlots: Math.max(0, Math.trunc(Number(value.availability.availableSlots) || 0)),
            nextSlotAt: typeof value.availability.nextSlotAt === 'string'
                ? value.availability.nextSlotAt.trim() || null
                : null,
            cooldownEntries: Array.isArray(value.availability.cooldownEntries)
                ? value.availability.cooldownEntries
                    .map(item => {
                        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
                        const availableAt = typeof item.availableAt === 'string'
                            ? item.availableAt.trim()
                            : '';
                        const kind = item.kind === 'reserved' ? 'reserved' : 'cooldown';
                        if (!availableAt) return null;
                        return { availableAt, kind };
                    })
                    .filter(Boolean)
                : []
        }
        : null;
    const viewer = value.viewer && typeof value.viewer === 'object'
        ? {
            status: ['available', 'cooldown', 'reserved', 'unavailable', 'locked'].includes(value.viewer.status)
                ? value.viewer.status
                : 'unavailable',
            wishlisted: value.viewer.wishlisted === true,
            slotWatching: value.viewer.slotWatching === true,
            contactEmail: typeof value.viewer.contactEmail === 'string' ? value.viewer.contactEmail : null,
            operationStatus: ['pending', 'review'].includes(value.viewer.operationStatus) ? value.viewer.operationStatus : null,
            pendingOperationId: typeof value.viewer.pendingOperationId === 'string' ? value.viewer.pendingOperationId : null,
            retry: value.viewer.retry && ['available', 'processing', 'review'].includes(value.viewer.retry.status)
                ? { id: String(value.viewer.retry.id), status: value.viewer.retry.status, expiresAt: value.viewer.retry.expiresAt || null } : null,
            canActivate: value.viewer.canActivate === true,
            cooldownUntil: typeof value.viewer.cooldownUntil === 'string'
                ? value.viewer.cooldownUntil.trim() || null
                : null,
            reservedUntil: typeof value.viewer.reservedUntil === 'string'
                ? value.viewer.reservedUntil.trim() || null
                : null,
            lastActivatedAt: typeof value.viewer.lastActivatedAt === 'string'
                ? value.viewer.lastActivatedAt.trim() || null
                : null,
            lockedReason: ['tier_release_pending', 'tier_disabled', 'bronze_limit', 'free_catalog_cutoff'].includes(value.viewer.lockedReason)
                ? value.viewer.lockedReason
                : null,
            releaseAvailableAt: typeof value.viewer.releaseAvailableAt === 'string'
                ? value.viewer.releaseAvailableAt.trim() || null
                : null,
            nearestAvailableTier: ['bronze', 'prata', 'ouro'].includes(value.viewer.nearestAvailableTier)
                ? value.viewer.nearestAvailableTier
                : null,
            planTier: ['bronze', 'prata', 'ouro'].includes(value.viewer.planTier)
                ? value.viewer.planTier
                : 'ouro',
            plansEnabled: value.viewer.plansEnabled === true,
            premiumActivationsUsed: value.viewer.premiumActivationsUsed === null || value.viewer.premiumActivationsUsed === undefined
                ? null
                : Math.max(0, Math.trunc(Number(value.viewer.premiumActivationsUsed) || 0)),
            premiumActivationLimit: value.viewer.premiumActivationLimit === null || value.viewer.premiumActivationLimit === undefined
                ? null
                : Math.max(0, Math.trunc(Number(value.viewer.premiumActivationLimit) || 0)),
            premiumActivationsResetAt: typeof value.viewer.premiumActivationsResetAt === 'string'
                ? value.viewer.premiumActivationsResetAt.trim() || null
                : null,
            tierAvailability: Array.isArray(value.viewer.tierAvailability)
                ? value.viewer.tierAvailability
                    .map(item => {
                        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
                        const tier = ['bronze', 'prata', 'ouro'].includes(item.tier) ? item.tier : null;
                        if (!tier) return null;
                        return {
                            tier,
                            availableNow: item.availableNow === true,
                            availableAt: typeof item.availableAt === 'string' ? item.availableAt.trim() || null : null
                        };
                    })
                    .filter(Boolean)
                : []
        }
        : null;

    if (!/^\d+$/.test(appId) || !gameName || !availability || !viewer) {
        return null;
    }

    return {
        appId,
        gameName,
        imageUrl: imageUrl || null,
        installSubpath: installSubpath || null,
        activationType,
        launchExecutablePath: launchExecutablePath || null,
        activationLimit,
        comingSoon: value.comingSoon === true,
        enabled: value.enabled === true,
        archiveAvailable: value.archiveAvailable === true,
        availability,
        viewer
    };
}

function cloneItem(item) {
    return {
        ...item,
        availability: {
            ...item.availability,
            cooldownEntries: item.availability.cooldownEntries.map(entry => ({ ...entry }))
        },
        viewer: { ...item.viewer }
    };
}

function createPremiumCatalogStore({ fs, path, getFilePath }) {
    let loaded = false;
    let items = [];
    let lastSync = null;
    let hadLoadError = false;

    function load() {
        if (loaded) return { items, lastSync, hadLoadError };
        loaded = true;

        try {
            const filePath = getFilePath();
            if (!fs.existsSync(filePath)) return { items, lastSync, hadLoadError };

            const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const storedItems = Array.isArray(payload?.items) ? payload.items : [];
            items = storedItems.map(normalizeItem).filter(Boolean);
            lastSync = typeof payload?.lastSync === 'string' ? payload.lastSync : null;
        } catch (error) {
            hadLoadError = true;
            console.warn('Unable to load premium catalog cache:', error.message);
        }

        return { items, lastSync, hadLoadError };
    }

    function save() {
        const filePath = getFilePath();
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({ version: 1, lastSync, items }, null, 2), 'utf8');
    }

    function replace(nextItems, syncedAt = new Date().toISOString()) {
        load();
        items = Array.isArray(nextItems)
            ? nextItems.map(normalizeItem).filter(Boolean)
            : [];
        lastSync = syncedAt;
        hadLoadError = false;
        save();
        return items;
    }

    function list() {
        return load().items.map(cloneItem);
    }

    function clear() {
        load();
        items = [];
        lastSync = null;
        hadLoadError = false;

        const filePath = getFilePath();
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (error) {
            console.warn('Unable to clear premium catalog cache:', error.message);
        }
    }

    return { clear, list, load, replace };
}

module.exports = { createPremiumCatalogStore };
