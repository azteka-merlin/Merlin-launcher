#pragma once

#include "Steam/Types.h"

#include <cstdint>

namespace ManifestCache {

    // Fetch an archived depot manifest into <Steam>\depotcache when it is not
    // already present. A missing or invalid remote response leaves Steam on its
    // existing manifest-request path. `outNotArchived` distinguishes a definitive
    // 404 from a transient network failure; it is diagnostic only and never
    // triggers user-facing UI. `bypassNegativeCache` is for an active retry that
    // should re-check a manifest before the normal negative-cache TTL expires.
    bool EnsureCached(AppId_t app, uint32_t depot, uint64_t gid,
                      uint32_t recvTimeoutMs = 0, bool* outNotArchived = nullptr,
                      bool bypassNegativeCache = false);

} // namespace ManifestCache
