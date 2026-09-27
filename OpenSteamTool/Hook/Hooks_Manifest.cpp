#include "Hooks_Manifest.h"
#include "HookMacros.h"
#include "dllmain.h"
#include "Utils/SteamMetadata/ManifestCache.h"
#include <format>

// ═══════════════════════════════════════════════════════════════════
//  Manifest override hooks:
//    BuildDepotDependency — patches depot entries' gid/size directly
//      in the output vector (replaces the old KV-tree approach).
// ═══════════════════════════════════════════════════════════════════
namespace {

    // The per-manifest acquire hook below calls this immediately before Steam's
    // own depotcache lookup. A short timeout lets an archive hit start on the
    // first attempt without turning a slow origin into a long UI stall.
    constexpr uint32_t kPreseedFetchTimeoutMs = 2000;

    std::string DepotEntryDebug(const DepotEntry& e) {
        return std::format("DepotId={} AppId={} Gid={} Size={} Dlc={} Lcs={} Carry={} Shared={}",
            e.DepotId, e.AppId, e.ManifestGid, e.ManifestSize, e.DlcAppId,
            (int)e.LcsRequired, (int)e.bNotNewTarget, (int)e.SharedInstall);
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

        return result;
    }

    // This is Steam's per-manifest acquisition path. It runs immediately before
    // the original checks depotcache, so a cached or freshly fetched manifest is
    // available on the first download attempt. The call remains silent on a
    // cache miss or network problem; Steam follows its existing fallback path.
    HOOK_FUNC(YldLoadDepotManifest, __int64,
              void* a1, void* a2, int appId, uint32_t depotId,
              uint64_t manifestGid, const char* branch)
    {
        if (depotId && manifestGid && LuaConfig::HasDepot(depotId)) {
            LOG_MANIFEST_DEBUG("YldLoadDepotManifest: checking cache app={} depot={} gid={} branch={}",
                               appId, depotId, manifestGid, branch ? branch : "");
            ManifestCache::EnsureCached(static_cast<AppId_t>(appId), depotId, manifestGid,
                                        kPreseedFetchTimeoutMs);
        }
        return oYldLoadDepotManifest(a1, a2, appId, depotId, manifestGid, branch);
    }

} // anonymous namespace

namespace Hooks_Manifest {

    void Install() {
        HOOK_BEGIN();
        INSTALL_HOOK_C(BuildDepotDependency);
        INSTALL_HOOK_C(YldLoadDepotManifest);
        HOOK_END();
    }

    void Uninstall() {
        UNHOOK_BEGIN();
        UNINSTALL_HOOK(BuildDepotDependency);
        UNINSTALL_HOOK(YldLoadDepotManifest);
        UNHOOK_END();
    }
}
