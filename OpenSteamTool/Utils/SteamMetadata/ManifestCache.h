#pragma once

#include "Steam/Types.h"

#include <cstdint>

namespace ManifestCache {

    // Fetch an archived depot manifest into <Steam>\depotcache when it is not
    // already present. A missing or invalid remote response leaves Steam on its
    // existing manifest-request path.
    bool EnsureCached(AppId_t app, uint32_t depot, uint64_t gid,
                      uint32_t recvTimeoutMs = 0);

} // namespace ManifestCache
