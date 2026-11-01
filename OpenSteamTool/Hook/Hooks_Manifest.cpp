#include "Hooks_Manifest.h"
#include "HookMacros.h"
#include "dllmain.h"
#include "OSTPlatform/include/Memory.h"
#include "Utils/SteamMetadata/ManifestCache.h"
#include <algorithm>
#include <array>
#include <cstring>
#include <format>

// ═══════════════════════════════════════════════════════════════════
//  Manifest override hooks:
//    BuildDepotDependency — patches depot entries' gid/size directly
//      in the output vector (replaces the old KV-tree approach).
// ═══════════════════════════════════════════════════════════════════
namespace {

    // This check is used while Steam builds an app's depot list. Restrict the
    // compatibility override to that call and to IDs present in the Lua.
    thread_local AppId_t g_buildingDepotApp = 0;

    HOOK_FUNC(CheckDepotLicense, bool, void* user, AppId_t depotId, AppId_t appId) {
        const bool owned = oCheckDepotLicense(user, depotId, appId);
        if (owned) return true;
        if (appId && appId == g_buildingDepotApp &&
            LuaConfig::HasDepot(appId) && LuaConfig::HasDepot(depotId)) {
            LOG_MANIFEST_DEBUG("CheckDepotLicense: Lua depot {} accepted for app {}", depotId, appId);
            return true;
        }
        return false;
    }

    // Resolve the beta's depot-license check from its call site in the already
    // resolved BuildDepotDependency. Unknown Steam builds fail closed: no byte
    // patch or guessed RVA is used, and the existing path remains available.
    void* FindDepotLicenseCheck() {
        const auto image = OSTPlatform::Memory::GetModuleImage(client_hModule);
        auto* build = static_cast<uint8_t*>(PatternLoader::FindPattern(client_hModule, "BuildDepotDependency"));
        if (!image || !build || build < image->base ||
            static_cast<size_t>(build - image->base) >= image->size) return nullptr;

        constexpr std::array<int, 44> callsite = {
            0x48,0x8B,0xBD,-1,-1,-1,-1, 0x41,0x8B,0xD4,
            0x44,0x8B,0x85,-1,-1,-1,-1, 0x48,0x8B,0x8F,-1,-1,-1,-1,
            0xE8,-1,-1,-1,-1, 0x84,0xC0,0x75,-1, 0x48,0x8B,0x4D,-1,
            0x41,0x8B,0xD4,0xE8,-1,-1,-1
        };
        constexpr std::array<uint8_t, 26> prologue = {
            0x40,0x55,0x53,0x56,0x57,0x41,0x54,0x41,0x55,0x41,0x56,0x41,0x57,
            0x48,0x8B,0xEC,0x48,0x83,0xEC,0x68,0x45,0x8B,0xF0,0x4C,0x8B,0xE9
        };
        const size_t available = image->size - static_cast<size_t>(build - image->base);
        const size_t limit = (std::min)(available, size_t{0x1000});
        if (!OSTPlatform::Memory::IsReadable(build, limit)) return nullptr;
        void* found = nullptr;
        for (size_t i = 0; i + callsite.size() <= limit; ++i) {
            bool matches = true;
            for (size_t j = 0; j < callsite.size(); ++j) {
                if (callsite[j] >= 0 && build[i+j] != callsite[j]) { matches = false; break; }
            }
            if (!matches) continue;
            int32_t displacement = 0;
            std::memcpy(&displacement, build + i + 25, sizeof(displacement));
            const intptr_t targetOffset = (build - image->base) + static_cast<intptr_t>(i) + 29 + displacement;
            if (targetOffset < 0 || static_cast<size_t>(targetOffset) + prologue.size() > image->size) continue;
            auto* target = image->base + targetOffset;
            if (!OSTPlatform::Memory::IsReadable(target, prologue.size()) ||
                std::memcmp(target, prologue.data(), prologue.size()) != 0) continue;
            if (found) return nullptr;
            found = target;
        }
        return found;
    }

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
        const AppId_t previousApp = g_buildingDepotApp;
        g_buildingDepotApp = AppId;
        bool result = oBuildDepotDependency(pUserAppMgr, AppId, pUserConfig,
            pDepotInfo, pSharedDepotInfo, pSteamApp, pBuildId, pbBetaFallback);
        g_buildingDepotApp = previousApp;

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
        if (void* target = FindDepotLicenseCheck()) {
            oCheckDepotLicense = reinterpret_cast<CheckDepotLicense_t>(target);
            if (!OSTPlatform::Detour::Attach(reinterpret_cast<void**>(&oCheckDepotLicense), reinterpret_cast<void*>(hkCheckDepotLicense)))
                _ost_detour_transaction_ok_ = false;
        }
        HOOK_END();
    }

    void Uninstall() {
        UNHOOK_BEGIN();
        UNINSTALL_HOOK(BuildDepotDependency);
        UNINSTALL_HOOK(YldLoadDepotManifest);
        UNINSTALL_HOOK(CheckDepotLicense);
        UNHOOK_END();
    }
}
