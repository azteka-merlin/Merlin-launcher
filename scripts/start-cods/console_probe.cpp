#define UNICODE
#define _UNICODE
#include <windows.h>
#include <cstdio>
#include <cwchar>

constexpr wchar_t kCortezTitle[] =
    L"IW9 (Cortez) SP Steam (SP22 9.7 build 23096551 2025-07-10) Offline v1 by .r4v3n";
constexpr wchar_t kJupiterTitle[] =
    L"IW9 (Jupiter) SP Steam synthetic console probe";
constexpr wchar_t kGenericTitle[] = L"Merlin Generic Console Probe";
const wchar_t* kProbeTitle = nullptr;
const char* kDiagnosticPath = nullptr;

struct WindowSearch {
    HWND console;
    bool consoleEnumerated = false;
    bool titledWindowVisible = false;
};

BOOL CALLBACK FindDesktopWindows(HWND window, LPARAM context) {
    auto* search = reinterpret_cast<WindowSearch*>(context);
    if (window == search->console) search->consoleEnumerated = true;
    wchar_t title[128]{};
    if (IsWindowVisible(window) &&
        GetWindowTextW(window, title, static_cast<int>(sizeof(title) / sizeof(title[0]))) > 0 &&
        lstrcmpW(title, kProbeTitle) == 0) search->titledWindowVisible = true;
    return TRUE;
}

struct Observation {
    HWND parent;
    HWND root;
    LONG_PTR style;
    LONG_PTR extendedStyle;
    bool isWindowVisible;
    bool consoleEnumerated;
    bool titledWindowVisible;

    bool DesktopVisible() const {
        return (consoleEnumerated && isWindowVisible) || titledWindowVisible;
    }
};

Observation Observe(HWND console) {
    WindowSearch search{console};
    EnumWindows(FindDesktopWindows, reinterpret_cast<LPARAM>(&search));
    return {GetParent(console), GetAncestor(console, GA_ROOT),
            GetWindowLongPtrW(console, GWL_STYLE),
            GetWindowLongPtrW(console, GWL_EXSTYLE),
            IsWindowVisible(console) != FALSE,
            search.consoleEnumerated, search.titledWindowVisible};
}

void WriteDiagnostic(HWND console, const Observation& before,
                     const Observation& afterShow, const Observation& afterWatch,
                     ULONGLONG hideMilliseconds, bool sawVisible) {
    FILE* report = nullptr;
    if (fopen_s(&report, kDiagnosticPath, "w") != 0 || !report) return;
    fprintf(report, "console=%p\n", static_cast<void*>(console));
    fprintf(report,
            "before parent=%p root=%p style=0x%Ix exstyle=0x%Ix IsWindowVisible=%d EnumWindows=%d titleVisible=%d desktopVisible=%d\n",
            static_cast<void*>(before.parent), static_cast<void*>(before.root),
            static_cast<size_t>(before.style), static_cast<size_t>(before.extendedStyle),
            before.isWindowVisible, before.consoleEnumerated,
            before.titledWindowVisible, before.DesktopVisible());
    fprintf(report,
            "shown  parent=%p root=%p style=0x%Ix exstyle=0x%Ix IsWindowVisible=%d EnumWindows=%d titleVisible=%d desktopVisible=%d\n",
            static_cast<void*>(afterShow.parent), static_cast<void*>(afterShow.root),
            static_cast<size_t>(afterShow.style), static_cast<size_t>(afterShow.extendedStyle),
            afterShow.isWindowVisible, afterShow.consoleEnumerated,
            afterShow.titledWindowVisible, afterShow.DesktopVisible());
    fprintf(report,
            "hidden parent=%p root=%p style=0x%Ix exstyle=0x%Ix IsWindowVisible=%d EnumWindows=%d titleVisible=%d desktopVisible=%d\n",
            static_cast<void*>(afterWatch.parent), static_cast<void*>(afterWatch.root),
            static_cast<size_t>(afterWatch.style), static_cast<size_t>(afterWatch.extendedStyle),
            afterWatch.isWindowVisible, afterWatch.consoleEnumerated,
            afterWatch.titledWindowVisible, afterWatch.DesktopVisible());
    fprintf(report, "sawVisible=%d hideMilliseconds=%llu\n",
            sawVisible, static_cast<unsigned long long>(hideMilliseconds));
    fclose(report);
}

void AppendRenameDiagnostic(const Observation& genericShown,
                            const Observation& afterRename,
                            const Observation& afterWatch,
                            ULONGLONG hideMilliseconds) {
    FILE* report = nullptr;
    if (fopen_s(&report, kDiagnosticPath, "a") != 0 || !report) return;
    fprintf(report, "rename genericVisible=%d renamedVisible=%d hidden=%d hideMilliseconds=%llu\n",
            genericShown.DesktopVisible(), afterRename.DesktopVisible(),
            !afterWatch.DesktopVisible(),
            static_cast<unsigned long long>(hideMilliseconds));
    fclose(report);
}

int wmain(int argc, wchar_t** argv) {
    if (argc != 2) return 36;
    if (wcscmp(argv[1], L"cortez") == 0) {
        kProbeTitle = kCortezTitle;
        kDiagnosticPath = "console_probe_diagnostics_mw2.txt";
    } else if (wcscmp(argv[1], L"jupiter") == 0) {
        kProbeTitle = kJupiterTitle;
        kDiagnosticPath = "console_probe_diagnostics_mw3.txt";
    } else {
        return 36;
    }

    HWND console = GetConsoleWindow();
    if (!console) return 21;
    Observation before = Observe(console);
    if (before.DesktopVisible()) return 20;

    HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
    DWORD mode = 0;
    if (output == nullptr || output == INVALID_HANDLE_VALUE ||
        !GetConsoleMode(output, &mode)) return 22;

    if (!SetConsoleTitleW(kProbeTitle)) return 23;
    constexpr wchar_t message[] = L"Console APIs still work.\r\n";
    DWORD written = 0;
    if (!WriteConsoleW(output, message, (sizeof(message) / sizeof(wchar_t)) - 1,
                       &written, nullptr) || written == 0) return 24;

    // The first ShowWindow call can honor STARTUPINFO's SW_HIDE regardless of
    // the requested SW_SHOW. A second call tests the watcher's actual response.
    ShowWindow(console, SW_SHOW);
    Sleep(30);
    ShowWindow(console, SW_SHOW);
    ULONGLONG started = GetTickCount64();
    Observation afterShow = Observe(console);
    Observation afterWatch = afterShow;
    bool sawVisible = afterShow.DesktopVisible();
    while (afterWatch.DesktopVisible() && GetTickCount64() - started < 2000) {
        Sleep(10);
        afterWatch = Observe(console);
        sawVisible = sawVisible || afterWatch.DesktopVisible();
    }
    ULONGLONG hideMilliseconds = GetTickCount64() - started;
    WriteDiagnostic(console, before, afterShow, afterWatch,
                    hideMilliseconds, sawVisible);
    if (afterWatch.DesktopVisible()) return 25;

    // A watcher that hides only briefly would still leave the user's window open.
    Sleep(300);
    if (Observe(console).DesktopVisible()) return 26;

    if (!GetConsoleMode(output, &mode)) return 27;
    written = 0;
    if (!WriteConsoleW(output, message, (sizeof(message) / sizeof(wchar_t)) - 1,
                       &written, nullptr) || written == 0) return 28;

    // The offline DLL can show a generic console first, then rename it IW9.
    // That must trigger the watcher even when the show event had another title.
    if (!SetConsoleTitleW(kGenericTitle)) return 29;
    Sleep(30);
    ShowWindow(console, SW_SHOW);
    Observation genericShown = Observe(console);
    if (!genericShown.DesktopVisible()) {
        Sleep(30);
        ShowWindow(console, SW_SHOW);
        genericShown = Observe(console);
    }
    if (!genericShown.DesktopVisible()) return 30;
    if (!SetConsoleTitleW(kProbeTitle)) return 31;

    started = GetTickCount64();
    Observation afterRename = Observe(console);
    afterWatch = afterRename;
    while (afterWatch.DesktopVisible() && GetTickCount64() - started < 2000) {
        Sleep(10);
        afterWatch = Observe(console);
    }
    hideMilliseconds = GetTickCount64() - started;
    AppendRenameDiagnostic(genericShown, afterRename, afterWatch,
                           hideMilliseconds);
    if (afterWatch.DesktopVisible()) return 32;
    Sleep(300);
    if (Observe(console).DesktopVisible()) return 33;

    if (!GetConsoleMode(output, &mode)) return 34;
    written = 0;
    if (!WriteConsoleW(output, message, (sizeof(message) / sizeof(wchar_t)) - 1,
                       &written, nullptr) || written == 0) return 35;
    return 0;
}
