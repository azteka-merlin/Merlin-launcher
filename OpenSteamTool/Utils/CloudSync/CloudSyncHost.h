#pragma once

#include <string>

namespace CloudSyncHost {
    // Uses CloudRedirect's MIT-licensed third-party ABI. No remote credentials
    // or save contents are handled by OpenSteamTool itself.
    void Initialize(const std::string& steamRoot, const std::string& merlinLuaDir);
    void RefreshApps();
}
