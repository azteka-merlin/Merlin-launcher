#pragma once

#include <string>

namespace SteamDiagnostics {

    // Capture the Steam build id and DLL hashes used in support diagnostics.
    void Initialize(const std::string& steamclientPath,
                    const std::string& steamUIPath);

    // Reuse captured hashes for known Steam DLLs and hash other files on demand.
    std::string Sha256Of(const std::string& path);

    // Persist a warning from Steam's initialization worker thread, including
    // the captured Steam diagnostics.
    // This works in Release builds, where the regular debug logger is disabled.
    void RecordWarning(std::string title, std::string message);

} // namespace SteamDiagnostics
