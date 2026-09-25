#include "Hooks_Manifest.h"
#include "HookMacros.h"
#include "dllmain.h"
#include "Utils/SteamMetadata/ManifestCache.h"
#include <chrono>
#include <format>

// ═══════════════════════════════════════════════════════════════════
//  Manifest override hooks:
//    BuildDepotDependency — patches depot entries' gid/size directly
//      in the output vector (replaces the old KV-tree approach).
// ═══════════════════════════════════════════════════════════════════
namespace {

    // Keep Steam's dependency-building path responsive. The first few archive
    // requests are allowed a short wait; remaining depots continue in workers.
    constexpr uint32_t kPreseedFetchTimeoutMs = 2000;
    constexpr int64_t  kPreseedBudgetMs = 5000;

    std::string DepotEntryDebug(const DepotEntry& e) {
        return std::format("DepotId={} AppId={} Gid={} Size={} Dlc={} Lcs={} Carry={} Shared={}",
            e.DepotId, e.AppId, e.ManifestGid, e.ManifestSize, e.DlcAppId,
            (int)e.LcsRequired, (int)e.bNotNewTarget, (int)e.SharedInstall);
    }

    void PreseedDepots(
        AppId_t appId,
        const CUtlVector<DepotEntry>* depots,
        const std::unordered_map<uint64_t, LuaConfig::ManifestOverride>& overrides,
        std::chrono::steady_clock::time_point deadline)
    {
        if (!depots) return;

        for (uint32 i = 0; i < depots->m_Size; ++i) {
            const DepotEntry& depotEntry = depots->m_Memory.m_pMemory[i];
            if (!depotEntry.DepotId || !depotEntry.ManifestGid) continue;

            const bool pinned = overrides.count(depotEntry.DepotId) != 0;
            const bool unlocked = LuaConfig::HasDepot(depotEntry.DepotId, false) &&
                                  !LuaConfig::IsOwned(depotEntry.AppId);
            if (!pinned && !unlocked) continue;

            const AppId_t app = appId;
            const uint32 depot = depotEntry.DepotId;
            const uint64 gid = depotEntry.ManifestGid;

            if (std::chrono::steady_clock::now() >= deadline) break;
            ManifestCache::EnsureCached(app, depot, gid, kPreseedFetchTimeoutMs);
        }
    }

    HOOK_FUNC(BuildDepotDependency, bool, void* pUserAppMgr, AppId_t AppId,
              void* pUserConfig, CUtlVector<DepotEntry>* pDepotInfo,
              CUtlVector<DepotEntry>* pSharedDepotInfo, void* pSteamApp,
              uint32* pBuildId, bool* pbBetaFallback)
    {
        bool result = oBuildDepotDependency(pUserAppMgr, AppId, pUserConfig,
            pDepotInfo, pSharedDepotInfo, pSteamApp, pBuildId, pbBetaFallback);

        LOG_MANIFEST_TRACE("BuildDepotDependency: AppId={} pUserConfig=0x{:X} result={} pSteamApp=0x{:X} pBuildId={} pbBetaFallback={}",
            AppId, (uintptr_t)pUserConfig, result, (uintptr_t)pSteamApp,
            pBuildId ? *pBuildId : 0, pbBetaFallback ? *pbBetaFallback : false);
        if (pDepotInfo) {
            LOG_MANIFEST_TRACE("pDepotInfo->nCount={}", pDepotInfo->m_Size);
            for (uint32 i = 0; i < pDepotInfo->m_Size; ++i) {
                LOG_MANIFEST_TRACE("  [{}] {}", i, DepotEntryDebug(pDepotInfo->m_Memory.m_pMemory[i]));
            }
        }
        if (pSharedDepotInfo) {
            LOG_MANIFEST_TRACE("pSharedDepotInfo->nCount={}", pSharedDepotInfo->m_Size);
            for (uint32 i = 0; i < pSharedDepotInfo->m_Size; ++i) {
                LOG_MANIFEST_TRACE("  shared[{}] {}", i, DepotEntryDebug(pSharedDepotInfo->m_Memory.m_pMemory[i]));
            }
        }

        if (!result) return result;

        // A PICS refresh can briefly expose an empty depot list while Steam is
        // replacing appinfo.  Returning that transient list makes Steam persist
        // a zero-depot configuration and mark an install complete without
        // downloading content.  Keep the prior configuration until the next
        // dependency pass for games managed by Merlin.
        if (AppId != 0 &&
            (!pDepotInfo || pDepotInfo->m_Size == 0) &&
            LuaConfig::HasDepot(AppId, false)) {
            LOG_MANIFEST_WARN("BuildDepotDependency: app {} returned an empty depot list during refresh; preserving the previous configuration", AppId);
            return false;
        }

        const auto& overrides = LuaConfig::GetManifestOverrides();

        if (!overrides.empty() && pDepotInfo && pDepotInfo->m_Size) {
            for (uint32 i = 0; i < pDepotInfo->m_Size; ++i) {
                DepotEntry& e = pDepotInfo->m_Memory.m_pMemory[i];
                auto it = overrides.find(e.DepotId);
                if (it != overrides.end()) {
                    // if size=0 in the override, keep the original size(affects download display but not the actual download)
                    uint64_t newSize = it->second.size ? it->second.size : e.ManifestSize;
                    LOG_MANIFEST_INFO("BuildDepotDependency: patching depot {} gid={}->{} size={}->{}",
                        e.DepotId, e.ManifestGid, it->second.gid,
                        e.ManifestSize, newSize);
                    e.ManifestGid  = it->second.gid;
                    e.ManifestSize = newSize;
                }
            }
        }

        const auto deadline = std::chrono::steady_clock::now() +
                              std::chrono::milliseconds(kPreseedBudgetMs);
        PreseedDepots(AppId, pDepotInfo, overrides, deadline);
        PreseedDepots(AppId, pSharedDepotInfo, overrides, deadline);
        return result;
    }

} // anonymous namespace

namespace Hooks_Manifest {

    void Install() {
        HOOK_BEGIN();
        INSTALL_HOOK_C(BuildDepotDependency);
        HOOK_END();
    }

    void Uninstall() {
        UNHOOK_BEGIN();
        UNINSTALL_HOOK(BuildDepotDependency);
        UNHOOK_END();
    }
}
