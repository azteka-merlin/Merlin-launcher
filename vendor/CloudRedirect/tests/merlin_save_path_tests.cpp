#include "autocloud_scan.h"
#include <windows.h>
#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>

int main() {
    const auto root = std::filesystem::temp_directory_path() /
        (L"merlin-save-root-case-test-" + std::to_wstring(GetCurrentProcessId()));
    const auto local = root / L"local";
    const auto saves = root / L"game" / L"ProjectPBZ" / L"Saved" / L"SaveGames" / L"Steam";
    const auto alias = saves / L"76561198733211071";
    const auto canonical = saves / L"76561198718002233";
    std::filesystem::create_directories(alias);
    std::filesystem::create_directories(canonical);
    std::filesystem::create_directories(local);
    wchar_t previous[32768]{};
    const DWORD previousLength = GetEnvironmentVariableW(L"LOCALAPPDATA", previous, 32768);
    if (!SetEnvironmentVariableW(L"LOCALAPPDATA", local.c_str())) return 2;
    const auto marker = canonical / L"steam_autocloud.vdf";
    std::ofstream(marker) << "\"accountid\" \"757736505\"";
    std::filesystem::last_write_time(marker, std::filesystem::file_time_type::clock::now() - std::chrono::minutes(1));
    std::ofstream(alias / L"PBZSaveGame.sav") << "test save";

    AutoCloudUtil::AutoCloudRuleNative rule;
    rule.root = "gameinstall";
    rule.cloudRoot = "gameinstall";
    rule.path = rule.resolvedPath = "ProjectPBZ/Saved/SaveGames/Steam/{64BitSteamID}";
    rule.pattern = "*.sav";
    rule.recursive = true;
    const auto result = AutoCloudScan::TestResolveMerlinSavePathAlias(
        757736505, 4115450, rule, (root / L"game").string(), "GameInstall");
    const bool success = result.merlinSavePathAlias &&
        result.resolvedPath == "ProjectPBZ/Saved/SaveGames/Steam/76561198733211071";
    if (previousLength && previousLength < 32768) SetEnvironmentVariableW(L"LOCALAPPDATA", previous);
    else SetEnvironmentVariableW(L"LOCALAPPDATA", nullptr);
    std::error_code ec;
    std::filesystem::remove_all(root, ec);
    if (!success) std::cerr << "lowercase gameinstall root did not resolve verified save alias\n";
    return success ? 0 : 1;
}
