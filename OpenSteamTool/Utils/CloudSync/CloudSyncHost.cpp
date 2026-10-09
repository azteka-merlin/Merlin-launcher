#include "Utils/CloudSync/CloudSyncHost.h"

#include "OSTPlatform/include/DynamicLibrary.h"
#include "Utils/Logging/Log.h"

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <limits>
#include <mutex>
#include <string>
#include <vector>
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

namespace CloudSyncHost {
namespace {
using InitFn = bool (*)(const char*, void (*)(int, const char*, const char*));
using SetAppsFn = void (*)(const uint32_t*, uint32_t);
using InstallHooksFn = bool (*)();

std::mutex g_mutex;
std::atomic<bool> g_active{false};
std::filesystem::path g_luaDir;
SetAppsFn g_setApps = nullptr;
InstallHooksFn g_installHooks = nullptr;
bool g_hooksInstalled = false;

void Notify(int level, const char* title, const char* message) {
    const char* label = title ? title : "Cloud sync";
    const char* detail = message ? message : "";
    if (level >= 2) LOG_ERROR("Merlin cloud: {}: {}", label, detail);
    else if (level == 1) LOG_WARN("Merlin cloud: {}: {}", label, detail);
    else LOG_INFO("Merlin cloud: {}: {}", label, detail);
}

std::filesystem::path ConfigPath() {
    wchar_t buffer[32768]{};
    DWORD length = GetEnvironmentVariableW(L"LOCALAPPDATA", buffer, 32768);
    if (!length || length >= 32768) return {};
    return std::filesystem::path(buffer) / L"Merlin" / L"cloud" / L"config.json";
}

bool ConfigEnabled() {
    const auto path = ConfigPath();
    if (path.empty()) return false;
    std::ifstream stream(path);
    if (!stream) return false;
    const std::string content((std::istreambuf_iterator<char>(stream)), {});
    // The Launcher writes this field; an absent or malformed config fails closed.
    return content.find("\"merlin_enabled\":true") != std::string::npos;
}

bool SelfUnlocksApp(const std::filesystem::path& file, uint32_t appId) {
    std::ifstream stream(file);
    if (!stream) return false;
    const std::string exact = "addappid(" + std::to_string(appId) + ")";
    const std::string withArgs = "addappid(" + std::to_string(appId) + ",";
    std::string line;
    while (std::getline(stream, line)) {
        const size_t start = line.find_first_not_of(" \t");
        if (start == std::string::npos || line.compare(start, 2, "--") == 0) continue;
        if (line.compare(start, exact.size(), exact) == 0 ||
            line.compare(start, withArgs.size(), withArgs) == 0) return true;
    }
    return false;
}

std::vector<uint32_t> MerlinApps() {
    std::vector<uint32_t> apps;
    std::error_code error;
    if (!std::filesystem::is_directory(g_luaDir, error)) return apps;
    for (const auto& entry : std::filesystem::directory_iterator(g_luaDir, error)) {
        if (error) break;
        if (!entry.is_regular_file() || entry.path().extension() != L".lua") continue;
        const std::wstring stem = entry.path().stem().wstring();
        if (stem.empty() || !std::all_of(stem.begin(), stem.end(), [](wchar_t c) { return c >= L'0' && c <= L'9'; })) continue;
        try {
            const unsigned long long parsed = std::stoull(stem);
            if (!parsed || parsed > std::numeric_limits<uint32_t>::max()) continue;
            const auto appId = static_cast<uint32_t>(parsed);
            if (SelfUnlocksApp(entry.path(), appId)) apps.push_back(appId);
        } catch (...) {
            continue;
        }
    }
    std::sort(apps.begin(), apps.end());
    apps.erase(std::unique(apps.begin(), apps.end()), apps.end());
    return apps;
}

void SetAppsLocked() {
    if (!g_setApps) return;
    const auto apps = MerlinApps();
    g_setApps(apps.empty() ? nullptr : apps.data(), static_cast<uint32_t>(apps.size()));
    LOG_INFO("Merlin cloud: registered {} self-unlocking game(s)", apps.size());
    if (!apps.empty() && !g_hooksInstalled && g_installHooks) {
        g_hooksInstalled = g_installHooks();
        if (!g_hooksInstalled) LOG_WARN("Merlin cloud: cloud RPC hooks unavailable; saves remain local");
    }
}
} // namespace

void Initialize(const std::string& steamRoot, const std::string& merlinLuaDir) {
    if (!ConfigEnabled()) {
        LOG_INFO("Merlin cloud: disabled or not configured");
        return;
    }
    std::lock_guard lock(g_mutex);
    if (g_active) return;
    g_luaDir = std::filesystem::u8path(merlinLuaDir);
    const std::filesystem::path libraryPath = std::filesystem::u8path(steamRoot) / L"merlin_cloud_redirect.dll";
    if (!std::filesystem::exists(libraryPath)) {
        LOG_WARN("Merlin cloud: merlin_cloud_redirect.dll is missing");
        return;
    }
    const auto module = OSTPlatform::DynamicLibrary::Load(libraryPath);
    if (!module) {
        LOG_WARN("Merlin cloud: could not load DLL (err={})", OSTPlatform::DynamicLibrary::GetLastErrorCode());
        return;
    }
    const auto init = reinterpret_cast<InitFn>(OSTPlatform::DynamicLibrary::GetSymbol(module, "CR_InitCloudSave"));
    g_setApps = reinterpret_cast<SetAppsFn>(OSTPlatform::DynamicLibrary::GetSymbol(module, "CR_SetApps"));
    g_installHooks = reinterpret_cast<InstallHooksFn>(OSTPlatform::DynamicLibrary::GetSymbol(module, "CR_InstallVtableHooks"));
    if (!init || !g_setApps || !g_installHooks) {
        LOG_WARN("Merlin cloud: required DLL exports are missing");
        g_setApps = nullptr;
        return;
    }
    if (!init(steamRoot.c_str(), &Notify)) {
        LOG_WARN("Merlin cloud: DLL initialization failed; Steam cloud is unchanged");
        g_setApps = nullptr;
        return;
    }
    g_active = true;
    SetAppsLocked();
}

void RefreshApps() {
    if (!g_active) return;
    std::lock_guard lock(g_mutex);
    if (g_active) SetAppsLocked();
}
} // namespace CloudSyncHost
