#include "MerlinLocalFallback.h"

#include "MerlinHelper/MerlinHelperApi.h"
#include "OSTPlatform/include/DynamicLibrary.h"
#include "Utils/Logging/Log.h"

#include <filesystem>

namespace MerlinLocalFallback {
namespace {

uint32_t RequestToFlags(const RemoteToml::Request& request)
{
    if (request.channel == "pattern" && request.component == "steamclient")
        return MerlinHelperApi::GeneratePatternSteamclient;
    if (request.channel == "pattern" && request.component == "steamui")
        return MerlinHelperApi::GeneratePatternSteamui;
    if (request.channel == "ipc" && request.component == "steamclient")
        return MerlinHelperApi::GenerateIpcSteamclient;
    return MerlinHelperApi::GenerateAll;
}

std::filesystem::path ResolveHelperPath(const std::filesystem::path& steamRoot)
{
    return steamRoot / "merlin-helper.dll";
}

} // namespace

bool TryGenerate(const RemoteToml::Request& request)
{
    namespace fs = std::filesystem;

    const fs::path steamRoot = fs::path(request.dllPath).parent_path();
    const fs::path helperPath = ResolveHelperPath(steamRoot);
    if (!fs::exists(helperPath)) {
        LOG_INFO("MerlinLocalFallback: helper DLL not found at {}", helperPath.string());
        return false;
    }

    const auto helperModule = OSTPlatform::DynamicLibrary::Load(helperPath);
    if (!helperModule) {
        LOG_WARN("MerlinLocalFallback: Load failed for {} (err={})",
                 helperPath.string(), OSTPlatform::DynamicLibrary::GetLastErrorCode());
        return false;
    }

    auto* rawSymbol = OSTPlatform::DynamicLibrary::GetSymbol(helperModule, MerlinHelperApi::kExportName);
    if (!rawSymbol) {
        LOG_WARN("MerlinLocalFallback: export '{}' not found in {}",
                 MerlinHelperApi::kExportName, helperPath.string());
        return false;
    }

    const auto generate = reinterpret_cast<MerlinHelperApi::GenerateMetadataFn>(rawSymbol);
    const auto steamRootPath = steamRoot.string();
    const auto steamclientPath = (steamRoot / "steamclient64.dll").string();
    const auto steamuiPath = (steamRoot / "steamui.dll").string();

    MerlinHelperApi::GenerateRequest generateRequest{};
    generateRequest.flags = RequestToFlags(request);
    generateRequest.steamRoot = steamRootPath.c_str();
    generateRequest.steamclientPath = steamclientPath.c_str();
    generateRequest.steamuiPath = steamuiPath.c_str();

    MerlinHelperApi::GenerateResult generateResult{};
    const uint32_t returnedMask = generate(&generateRequest, &generateResult);

    const uint32_t requestedMask = generateRequest.flags;
    const uint32_t effectiveMask = generateResult.generatedMask ? generateResult.generatedMask : returnedMask;
    LOG_INFO("MerlinLocalFallback: helper returned generated=0x{:X} failed=0x{:X} for channel={} component={}",
             effectiveMask, generateResult.failedMask, request.channel, request.component);
    return (effectiveMask & requestedMask) == requestedMask;
}

} // namespace MerlinLocalFallback
