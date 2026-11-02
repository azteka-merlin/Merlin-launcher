const DEFAULT_PREMIUM_CATALOG_URL = 'https://api-merlin.com/api/premium/catalog';

function normalizeCatalogGame(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

    const appId = String(entry.appId || '').trim();
    const gameName = typeof entry.name === 'string' ? entry.name.trim() : '';
    const imageUrl = typeof entry.coverUrl === 'string' ? entry.coverUrl.trim() : '';
    const installSubpath = typeof entry.installSubpath === 'string'
        ? entry.installSubpath.trim()
        : '';
    const activationType = entry.activationType === 'third_party'
        ? 'third_party'
        : 'steam_ticket';
    const launchExecutablePath = typeof entry.launchExecutablePath === 'string'
        ? entry.launchExecutablePath.trim()
        : '';
    const activationLimit = Math.max(1, Math.trunc(Number(entry.activationLimit) || 0));
    const availability = entry.availability && typeof entry.availability === 'object'
        ? {
            activeCount: Math.max(0, Math.trunc(Number(entry.availability.activeCount) || 0)),
            reservedCount: Math.max(0, Math.trunc(Number(entry.availability.reservedCount) || 0)),
            occupiedSlots: Math.max(0, Math.trunc(Number(entry.availability.occupiedSlots) || 0)),
            availableSlots: Math.max(0, Math.trunc(Number(entry.availability.availableSlots) || 0)),
            nextSlotAt: typeof entry.availability.nextSlotAt === 'string'
                ? entry.availability.nextSlotAt.trim() || null
                : null,
            cooldownEntries: Array.isArray(entry.availability.cooldownEntries)
                ? entry.availability.cooldownEntries
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
    const viewer = entry.viewer && typeof entry.viewer === 'object'
        ? {
            status: ['available', 'cooldown', 'reserved', 'unavailable', 'locked'].includes(entry.viewer.status)
                ? entry.viewer.status
                : 'unavailable',
            wishlisted: entry.viewer.wishlisted === true,
            slotWatching: entry.viewer.slotWatching === true,
            contactEmail: typeof entry.viewer.contactEmail === 'string' ? entry.viewer.contactEmail : null,
            operationStatus: ['pending', 'review'].includes(entry.viewer.operationStatus) ? entry.viewer.operationStatus : null,
            pendingOperationId: typeof entry.viewer.pendingOperationId === 'string' ? entry.viewer.pendingOperationId : null,
            retry: entry.viewer.retry && ['available', 'processing', 'review'].includes(entry.viewer.retry.status)
                ? { id: String(entry.viewer.retry.id), status: entry.viewer.retry.status, expiresAt: entry.viewer.retry.expiresAt || null } : null,
            canActivate: entry.viewer.canActivate === true,
            cooldownUntil: typeof entry.viewer.cooldownUntil === 'string'
                ? entry.viewer.cooldownUntil.trim() || null
                : null,
            reservedUntil: typeof entry.viewer.reservedUntil === 'string'
                ? entry.viewer.reservedUntil.trim() || null
                : null,
            lastActivatedAt: typeof entry.viewer.lastActivatedAt === 'string'
                ? entry.viewer.lastActivatedAt.trim() || null
                : null,
            lockedReason: ['tier_release_pending', 'tier_disabled', 'bronze_limit', 'free_catalog_cutoff'].includes(entry.viewer.lockedReason)
                ? entry.viewer.lockedReason
                : null,
            releaseAvailableAt: typeof entry.viewer.releaseAvailableAt === 'string'
                ? entry.viewer.releaseAvailableAt.trim() || null
                : null,
            nearestAvailableTier: ['bronze', 'prata', 'ouro'].includes(entry.viewer.nearestAvailableTier)
                ? entry.viewer.nearestAvailableTier
                : null,
            planTier: ['bronze', 'prata', 'ouro'].includes(entry.viewer.planTier)
                ? entry.viewer.planTier
                : 'ouro',
            plansEnabled: entry.viewer.plansEnabled === true,
            premiumActivationsUsed: entry.viewer.premiumActivationsUsed === null || entry.viewer.premiumActivationsUsed === undefined
                ? null
                : Math.max(0, Math.trunc(Number(entry.viewer.premiumActivationsUsed) || 0)),
            premiumActivationLimit: entry.viewer.premiumActivationLimit === null || entry.viewer.premiumActivationLimit === undefined
                ? null
                : Math.max(0, Math.trunc(Number(entry.viewer.premiumActivationLimit) || 0)),
            premiumActivationsResetAt: typeof entry.viewer.premiumActivationsResetAt === 'string'
                ? entry.viewer.premiumActivationsResetAt.trim() || null
                : null,
            tierAvailability: Array.isArray(entry.viewer.tierAvailability)
                ? entry.viewer.tierAvailability
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
        comingSoon: entry.comingSoon === true,
        enabled: entry.enabled === true,
        archiveAvailable: entry.archiveAvailable === true,
        availability,
        viewer
    };
}

function createPremiumCatalogClient({
    axios,
    catalogUrl = DEFAULT_PREMIUM_CATALOG_URL,
    activateUrl = DEFAULT_PREMIUM_CATALOG_URL.replace(/\/catalog$/, '/activate'),
    activateThirdPartyUrl = activateUrl.replace(/\/activate$/, '/activate-third-party'),
    activationEventUrl = activateUrl.replace(/\/activate$/, '/activation-events'),
    timeout = 20000
}) {
    async function requestCatalog(accessToken) {
        const response = await axios.get(catalogUrl, {
            timeout,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json'
            }
        });

        if (!response.data || !Array.isArray(response.data.games)) {
            throw new Error('Invalid premium catalog payload');
        }

        return {
            items: response.data.games
                .map(normalizeCatalogGame)
                .filter(Boolean),
            syncedAt: new Date().toISOString()
        };
    }

    async function activate({ appId, accessToken, operationId, retryGrantId }) {
        return (await axios.post(
            activateUrl,
            { appId, operationId, ...(retryGrantId ? { retryGrantId } : {}) },
            {
                timeout: Math.max(timeout, 120000),
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        )).data;
    }

    async function activateThirdParty({ appId, reservationId, tokenReq, accessToken }) {
        return (await axios.post(
            activateThirdPartyUrl,
            { appId, reservationId, tokenReq },
            {
                timeout: Math.max(timeout, 120000),
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        )).data;
    }

    async function logActivationEvent({ appId, reservationId, activationType, stage, reason, message, cooldownApplied, accessToken }) {
        return (await axios.post(
            activationEventUrl,
            { appId, reservationId, activationType, stage, reason, message, cooldownApplied },
            {
                timeout,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        )).data;
    }

    async function authenticatedAction({ kind, appId, data, remove, operationId, accessToken }) {
        const base = activateUrl.replace(/\/activate$/, '');
        const endpoint = kind === 'operation-status'
            ? `${base}/operation-status?operationId=${encodeURIComponent(operationId)}`
            : `${base}/${kind}/${encodeURIComponent(appId)}`;
        const config = { timeout, headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } };
        const response = kind === 'operation-status'
            ? await axios.get(endpoint, config)
            : remove ? await axios.delete(endpoint, config) : await axios.post(endpoint, data, config);
        return response.data;
    }

    return {
        authenticatedAction,
        activate,
        activateThirdParty,
        logActivationEvent,
        requestCatalog
    };
}

module.exports = {
    DEFAULT_PREMIUM_CATALOG_URL,
    createPremiumCatalogClient
};
