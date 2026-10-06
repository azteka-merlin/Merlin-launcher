#include "SteamDiagnostics.h"
#include "OpenSteamToolBuildInfo.h"
#include "OSTPlatform/include/DynamicLibrary.h"
#include "OSTPlatform/include/Hash.h"
#include "Utils/Logging/Log.h"

#include <windows.h>

#include <chrono>
#include <cstdint>
#include <ctime>
#include <exception>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <mutex>
#include <string>
#include <utility>

namespace SteamDiagnostics {

namespace {

    struct Snapshot {
        std::string openSteamToolVersion = OPENSTEAMTOOL_VERSION;
        std::string buildID = "(unavailable)";
        std::string steamclientPath;
        std::string steamclientSha256 = "(unavailable)";
        std::string steamUIPath;
        std::string steamUISha256 = "(unavailable)";
    };

    Snapshot g_snapshot;
    std::mutex g_warningLogMutex;
    constexpr std::uintmax_t kMaxWarningLogBytes = 1024 * 1024;
    constexpr std::size_t kMaxWarningMessageBytes = 16 * 1024;

    static std::filesystem::path WarningLogPath()
    {
        const DWORD required = GetEnvironmentVariableW(L"LOCALAPPDATA", nullptr, 0);
        if (required < 2) return {};

        std::wstring localAppData(required, L'\0');
        const DWORD copied = GetEnvironmentVariableW(
            L"LOCALAPPDATA", localAppData.data(), required);
        if (copied == 0 || copied >= required) return {};
        localAppData.resize(copied);

        return std::filesystem::path(localAppData) / L"Merlin" / L"logs" /
            L"merlin_steam_integration.log";
    }

    static void WriteWarning(const std::string& title, const std::string& message)
    {
        try {
            std::lock_guard lock(g_warningLogMutex);
            const auto path = WarningLogPath();
            if (path.empty()) return;

            std::error_code ec;
            std::filesystem::create_directories(path.parent_path(), ec);
            if (ec) return;

            const auto size = std::filesystem::file_size(path, ec);
            if (!ec && size >= kMaxWarningLogBytes) {
                const auto previous = std::filesystem::path(path.wstring() + L".1");
                std::filesystem::remove(previous, ec);
                ec.clear();
                std::filesystem::rename(path, previous, ec);
                if (ec) {
                    // Keep the primary file bounded even when rotation fails.
                    std::ofstream truncated(path, std::ios::binary | std::ios::trunc);
                    if (!truncated) return;
                }
            }

            std::ofstream out(path, std::ios::binary | std::ios::app);
            if (!out) return;

            const auto now = std::chrono::system_clock::to_time_t(
                std::chrono::system_clock::now());
            std::tm utc{};
            gmtime_s(&utc, &now);
            out << '[' << std::put_time(&utc, "%Y-%m-%d %H:%M:%S UTC")
                << "] [WARN] " << title << '\n';
            const auto messageBytes = message.size() < kMaxWarningMessageBytes
                ? message.size() : kMaxWarningMessageBytes;
            out.write(message.data(), static_cast<std::streamsize>(messageBytes));
            if (messageBytes < message.size()) out << "\n[diagnostic truncated]";
            out << "\n\n";
        } catch (const std::exception&) {
            // Diagnostics must never interrupt Steam startup.
        }
    }

    static std::string DetectSteamBuildID()
    {
        using GetBootstrapperVersion_t = int64_t (*)();

        const auto steam = OSTPlatform::DynamicLibrary::GetLoaded("steam.exe");
        if (!steam) {
            LOG_WARN("SteamDiagnostics: steam.exe module not loaded; build id unavailable");
            return "(unavailable)";
        }

        const auto getBootstrapperVersion =
            reinterpret_cast<GetBootstrapperVersion_t>(
                OSTPlatform::DynamicLibrary::GetSymbol(steam, "GetBootstrapperVersion"));
        if (!getBootstrapperVersion) {
            LOG_WARN("SteamDiagnostics: steam.exe!GetBootstrapperVersion not exported");
            return "(unavailable)";
        }

        return std::to_string(getBootstrapperVersion());
    }

    static std::string HashOrUnavailable(const std::string& path)
    {
        std::string sha256 = OSTPlatform::Hash::Sha256OfFile(path);
        return sha256.empty() ? "(unavailable)" : std::move(sha256);
    }

    static std::string AppendSnapshot(std::string message)
    {
        message +=
            "\n\nSteam diagnostics:\n"
            "  Native component version: " + g_snapshot.openSteamToolVersion + "\n"
            "  Build ID:              " + g_snapshot.buildID + "\n"
            "  steamclient64.dll SHA: " + g_snapshot.steamclientSha256 + "\n"
            "  steamui.dll SHA:       " + g_snapshot.steamUISha256;
        return message;
    }

} // namespace

void Initialize(const std::string& steamclientPath,
                const std::string& steamUIPath)
{
    g_snapshot.buildID = DetectSteamBuildID();
    g_snapshot.steamclientPath = steamclientPath;
    g_snapshot.steamclientSha256 = HashOrUnavailable(steamclientPath);
    g_snapshot.steamUIPath = steamUIPath;
    g_snapshot.steamUISha256 = HashOrUnavailable(steamUIPath);

    LOG_INFO("SteamDiagnostics: ost.version={} build={} steamclient64.sha256={} steamui.sha256={}",
             g_snapshot.openSteamToolVersion,
             g_snapshot.buildID,
             g_snapshot.steamclientSha256,
             g_snapshot.steamUISha256);
}

std::string Sha256Of(const std::string& path)
{
    if (path == g_snapshot.steamclientPath)
        return g_snapshot.steamclientSha256 == "(unavailable)"
            ? std::string{}
            : g_snapshot.steamclientSha256;

    if (path == g_snapshot.steamUIPath)
        return g_snapshot.steamUISha256 == "(unavailable)"
            ? std::string{}
            : g_snapshot.steamUISha256;

    return OSTPlatform::Hash::Sha256OfFile(path);
}

void RecordWarning(std::string title, std::string message)
{
    WriteWarning(title, AppendSnapshot(std::move(message)));
}

} // namespace SteamDiagnostics
