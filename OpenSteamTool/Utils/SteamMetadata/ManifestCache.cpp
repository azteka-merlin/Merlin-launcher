#include "ManifestCache.h"

#include "OSTPlatform/include/DynamicLibrary.h"
#include "OSTPlatform/include/Http.h"
#include "Utils/Config/Config.h"
#include "Utils/Logging/Log.h"

#include <windows.h>

#include <chrono>
#include <cstdint>
#include <filesystem>
#include <format>
#include <fstream>
#include <mutex>
#include <string>
#include <system_error>
#include <unordered_map>
#include <unordered_set>

namespace fs = std::filesystem;

namespace ManifestCache {
namespace {

    constexpr const char* kArchiveBaseUrl = "https://manifest.luastools.xyz";
    constexpr uint32_t kMaxBodyBytes = 64u * 1024u * 1024u;
    constexpr uint32_t kDefaultRecvTimeoutMs = 60000;
    constexpr auto kNegativeCacheTtl = std::chrono::minutes(10);

    constexpr size_t kMinBodyBytes = 16;
    constexpr unsigned char kPayloadMagic[4] = {0xD0, 0x17, 0xF6, 0x71};
    constexpr unsigned char kEofMagic[4] = {0xAB, 0x15, 0xC4, 0x32};

    std::mutex g_negativeCacheMutex;
    std::unordered_map<std::string, std::chrono::steady_clock::time_point> g_negativeCache;
    std::mutex g_inFlightMutex;
    std::unordered_set<std::string> g_inFlight;

    struct InFlightGuard {
        std::string key;
        bool acquired = false;

        explicit InFlightGuard(std::string value) : key(std::move(value)) {
            std::lock_guard<std::mutex> lock(g_inFlightMutex);
            acquired = g_inFlight.insert(key).second;
        }

        ~InFlightGuard() {
            if (!acquired) return;
            std::lock_guard<std::mutex> lock(g_inFlightMutex);
            g_inFlight.erase(key);
        }
    };

    fs::path DepotCacheDir() {
        const fs::path steamExe = OSTPlatform::DynamicLibrary::GetMainExecutablePath();
        return steamExe.empty() ? fs::path{} : steamExe.parent_path() / "depotcache";
    }

    bool LooksLikeManifest(const std::string& body) {
        if (body.size() < kMinBodyBytes) return false;
        const auto* head = reinterpret_cast<const unsigned char*>(body.data());
        const auto* tail = head + body.size() - 4;
        for (int i = 0; i < 4; ++i) {
            if (head[i] != kPayloadMagic[i] || tail[i] != kEofMagic[i]) return false;
        }
        return true;
    }

    bool WriteAtomic(const fs::path& destination, const std::string& body) {
        std::error_code error;
        fs::create_directories(destination.parent_path(), error);
        const fs::path temporary = fs::path(destination).concat(
            std::format(".{}.tmp", ::GetCurrentThreadId()));

        {
            std::ofstream output(temporary, std::ios::binary | std::ios::trunc);
            if (!output) return false;
            output.write(body.data(), static_cast<std::streamsize>(body.size()));
            output.flush();
            if (!output) {
                output.close();
                fs::remove(temporary, error);
                return false;
            }
        }

        if (!MoveFileExA(temporary.string().c_str(), destination.string().c_str(),
                         MOVEFILE_REPLACE_EXISTING)) {
            fs::remove(temporary, error);
            return false;
        }
        return true;
    }

} // namespace

bool EnsureCached(AppId_t app, uint32_t depot, uint64_t gid, uint32_t recvTimeoutMs) {
    if (!depot || !gid) return false;

    const fs::path directory = DepotCacheDir();
    if (directory.empty()) return false;
    const fs::path destination = directory / std::format("{}_{}.manifest", depot, gid);

    std::error_code error;
    if (fs::exists(destination, error)) return true;

    const std::string key = std::format("{}_{}", depot, gid);
    {
        std::lock_guard<std::mutex> lock(g_negativeCacheMutex);
        const auto it = g_negativeCache.find(key);
        if (it != g_negativeCache.end()) {
            if (std::chrono::steady_clock::now() - it->second < kNegativeCacheTtl) return false;
            g_negativeCache.erase(it);
        }
    }

    InFlightGuard inFlight(key);
    if (!inFlight.acquired) return false;
    if (fs::exists(destination, error)) return true;

    const std::string url = std::format("{}/m/{}/{}", kArchiveBaseUrl, depot, gid);
    const auto timeouts = Config::GetManifestTimeouts();
    const auto response = OSTPlatform::Http::Execute(
        L"GET", url.c_str(), nullptr, 0, nullptr,
        timeouts.resolve, timeouts.connect, timeouts.send,
        recvTimeoutMs ? recvTimeoutMs : kDefaultRecvTimeoutMs, kMaxBodyBytes);

    if (!response.ok || response.status != 200) {
        if (response.ok && response.status == 404) {
            std::lock_guard<std::mutex> lock(g_negativeCacheMutex);
            g_negativeCache[key] = std::chrono::steady_clock::now();
        }
        LOG_MANIFEST_TRACE("ManifestCache: miss app={} depot={} gid={} status={}",
                           app, depot, gid, response.status);
        return false;
    }

    if (!LooksLikeManifest(response.body) || !WriteAtomic(destination, response.body)) return false;

    LOG_MANIFEST_INFO("ManifestCache: cached app={} depot={} gid={} ({} bytes)",
                      app, depot, gid, response.body.size());
    return true;
}

} // namespace ManifestCache
