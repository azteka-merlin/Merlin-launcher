#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <sddl.h>
#include <shlobj.h>
#include <tlhelp32.h>

#include <algorithm>
#include <atomic>
#include <cwctype>
#include <exception>
#include <filesystem>
#include <string>
#include <vector>

#ifndef COD_GAME
#error COD_GAME must be 22 or 23
#endif
#ifndef COD_SP
#error COD_SP must be 0 or 1
#endif

namespace fs = std::filesystem;

#if COD_GAME == 22
constexpr wchar_t kServiceName[] = L"atvi-hrist_sr_offline";
constexpr wchar_t kFixConsoleTitle[] = L"IW9 (Cortez)";
#if COD_SP
constexpr wchar_t kWindowTitle[] = L"MW2 - Campanha";
#else
constexpr wchar_t kWindowTitle[] = L"MW2 - Multiplayer";
#endif
constexpr wchar_t kSpFolder[] = L"sp22";
constexpr wchar_t kMpExe[] = L"cod22-cod.exe";
constexpr wchar_t kSpExe[] = L"sp22-cod.exe";
#elif COD_GAME == 23
constexpr wchar_t kServiceName[] = L"atvi-sigrun_sr_offline";
constexpr wchar_t kFixConsoleTitle[] = L"IW9 (Jupiter)";
#if COD_SP
constexpr wchar_t kWindowTitle[] = L"MW3 - Campanha";
#else
constexpr wchar_t kWindowTitle[] = L"MW3 - Multiplayer";
#endif
constexpr wchar_t kSpFolder[] = L"sp23";
constexpr wchar_t kMpExe[] = L"cod23-cod.exe";
constexpr wchar_t kSpExe[] = L"sp23-cod.exe";
#else
#error Unsupported COD_GAME
#endif

constexpr wchar_t kServiceSddl[] =
    L"D:(A;;CCLCSWRPWPDTLOCRRC;;;SY)"
    L"(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)"
    L"(A;;CCLCSWRPWPLOCRRC;;;IU)"
    L"(A;;CCLCSWLOCRRC;;;SU)"
    L"S:(AU;FA;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;WD)";

struct ServiceHandles {
    SC_HANDLE manager = nullptr;
    SC_HANDLE service = nullptr;
    bool created = false;
    ~ServiceHandles() {
        if (service) CloseServiceHandle(service);
        if (manager) CloseServiceHandle(manager);
    }
};

std::wstring WinError(DWORD code) {
    LPWSTR message = nullptr;
    DWORD size = FormatMessageW(FORMAT_MESSAGE_ALLOCATE_BUFFER |
                                    FORMAT_MESSAGE_FROM_SYSTEM |
                                    FORMAT_MESSAGE_IGNORE_INSERTS,
                                nullptr, code, 0,
                                reinterpret_cast<LPWSTR>(&message), 0, nullptr);
    std::wstring text = size && message ? message : L"Erro do Windows";
    if (message) LocalFree(message);
    while (!text.empty() && iswspace(text.back())) text.pop_back();
    return text + L" (" + std::to_wstring(code) + L")";
}

std::wstring Quote(const std::wstring& value) { return L"\"" + value + L"\""; }

std::wstring ShortPathOrOriginal(const fs::path& path) {
    DWORD required = GetShortPathNameW(path.c_str(), nullptr, 0);
    if (!required) return path.wstring();
    std::wstring shortPath(required, L'\0');
    DWORD length = GetShortPathNameW(path.c_str(), shortPath.data(), required);
    if (!length || length >= required) return path.wstring();
    shortPath.resize(length);
    return shortPath;
}

std::wstring ExeFolder() {
    std::vector<wchar_t> buffer(32768);
    DWORD count = GetModuleFileNameW(nullptr, buffer.data(),
                                     static_cast<DWORD>(buffer.size()));
    if (!count || count >= buffer.size()) throw std::wstring(L"Não foi possível localizar o iniciador.");
    return fs::path(std::wstring(buffer.data(), count)).parent_path().wstring();
}

bool IsRegularFile(const fs::path& path) {
    std::error_code error;
    return fs::is_regular_file(path, error);
}

void RequireFile(const fs::path& path) {
    if (!IsRegularFile(path)) {
        throw std::wstring(L"Arquivo necessário não encontrado:\n") + path.wstring() +
            L"\n\nCopie o fix para a pasta do jogo antes de usar este iniciador.";
    }
}

std::wstring NormalizedServicePath(std::wstring path) {
    while (!path.empty() && iswspace(path.front())) path.erase(path.begin());
    while (!path.empty() && iswspace(path.back())) path.pop_back();
    if (path.size() >= 2 && path.front() == L'"' && path.back() == L'"')
        path = path.substr(1, path.size() - 2);
    if (path.rfind(L"\\??\\", 0) == 0) path.erase(0, 4);
    std::replace(path.begin(), path.end(), L'/', L'\\');
    return fs::path(path).lexically_normal().wstring();
}

bool SamePath(const std::wstring& a, const std::wstring& b) {
    std::wstring left = NormalizedServicePath(a);
    std::wstring right = NormalizedServicePath(b);
    return _wcsicmp(left.c_str(), right.c_str()) == 0;
}

bool SameDriverFile(const std::wstring& servicePath, const fs::path& expected) {
    if (SamePath(servicePath, expected.wstring())) return true;
    // sc.exe may store an 8.3 path such as PROGRA~2. Compare file identity
    // before treating that spelling as a different driver.
    std::error_code error;
    return fs::equivalent(fs::path(NormalizedServicePath(servicePath)), expected,
                          error) && !error;
}

void CheckExistingServicePath(SC_HANDLE service, const fs::path& driver) {
    DWORD needed = 0;
    QueryServiceConfigW(service, nullptr, 0, &needed);
    if (GetLastError() != ERROR_INSUFFICIENT_BUFFER || !needed)
        throw std::wstring(L"Não foi possível ler o serviço existente: ") + WinError(GetLastError());
    std::vector<BYTE> buffer(needed);
    auto* config = reinterpret_cast<QUERY_SERVICE_CONFIGW*>(buffer.data());
    if (!QueryServiceConfigW(service, config, needed, &needed))
        throw std::wstring(L"Não foi possível ler o serviço existente: ") + WinError(GetLastError());
    if (!config->lpBinaryPathName || !SameDriverFile(config->lpBinaryPathName, driver)) {
        throw std::wstring(L"Já existe um serviço com o nome usado por este fix, mas ele aponta para outro driver.\n") +
            L"Não vou alterar esse serviço.";
    }
}

void SetServiceDacl(SC_HANDLE service) {
    PSECURITY_DESCRIPTOR descriptor = nullptr;
    if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(
            kServiceSddl, SDDL_REVISION_1, &descriptor, nullptr))
        throw std::wstring(L"Não foi possível preparar as permissões do serviço: ") + WinError(GetLastError());
    BOOL ok = SetServiceObjectSecurity(service, DACL_SECURITY_INFORMATION, descriptor);
    DWORD error = ok ? ERROR_SUCCESS : GetLastError();
    LocalFree(descriptor);
    if (!ok) throw std::wstring(L"Não foi possível aplicar as permissões do serviço: ") + WinError(error);
}

void EnsureService(ServiceHandles& handles, const fs::path& driver) {
    handles.manager = OpenSCManagerW(nullptr, nullptr, SC_MANAGER_CONNECT | SC_MANAGER_CREATE_SERVICE);
    if (!handles.manager)
        throw std::wstring(L"Não foi possível acessar o Gerenciador de Serviços. Execute como administrador.\n") +
            WinError(GetLastError());

    handles.service = OpenServiceW(handles.manager, kServiceName,
                                   SERVICE_QUERY_CONFIG);
    if (handles.service) {
        CheckExistingServicePath(handles.service, driver);
        return;
    }
    DWORD openError = GetLastError();
    if (openError != ERROR_SERVICE_DOES_NOT_EXIST)
        throw std::wstring(L"Não foi possível abrir o serviço do jogo: ") + WinError(openError);

    // The bootstrapper opens the driver's ImagePath as a literal file name.
    // Quotes cause Win32 123. A short path also matches the original BAT.
    std::wstring driverPath = ShortPathOrOriginal(driver);
    handles.service = CreateServiceW(
        handles.manager, kServiceName, kServiceName,
        SERVICE_QUERY_CONFIG | DELETE | WRITE_DAC, SERVICE_KERNEL_DRIVER,
        SERVICE_DEMAND_START, SERVICE_ERROR_NORMAL, driverPath.c_str(),
        nullptr, nullptr, nullptr, nullptr, nullptr);
    if (!handles.service)
        throw std::wstring(L"Não foi possível criar o serviço temporário do driver: ") +
            WinError(GetLastError());
    handles.created = true;
    try {
        SetServiceDacl(handles.service);
    } catch (...) {
        if (DeleteService(handles.service)) handles.created = false;
        throw;
    }
}

void DeleteCreatedService(ServiceHandles& handles) {
    if (!handles.service || !handles.created) return;
    if (!DeleteService(handles.service))
        throw std::wstring(L"Não foi possível remover o serviço temporário do driver: ") +
            WinError(GetLastError());
    handles.created = false;
}

void DeleteMatchingCrashHandler(const fs::path& handlerPath) {
    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snapshot == INVALID_HANDLE_VALUE) return;
    PROCESSENTRY32W entry{};
    entry.dwSize = sizeof(entry);
    if (Process32FirstW(snapshot, &entry)) {
        do {
            if (_wcsicmp(entry.szExeFile, L"bootstrapperCrashHandler.exe") != 0) continue;
            HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_TERMINATE,
                                         FALSE, entry.th32ProcessID);
            if (!process) continue;
            std::vector<wchar_t> path(32768);
            DWORD length = static_cast<DWORD>(path.size());
            if (QueryFullProcessImageNameW(process, 0, path.data(), &length) &&
                SamePath(std::wstring(path.data(), length), handlerPath.wstring())) {
                TerminateProcess(process, 0);
                WaitForSingleObject(process, 3000);
            }
            CloseHandle(process);
        } while (Process32NextW(snapshot, &entry));
    }
    CloseHandle(snapshot);
}

void CleanupEmulatorCache() {
    PWSTR appDataRaw = nullptr;
    if (FAILED(SHGetKnownFolderPath(FOLDERID_RoamingAppData, 0, nullptr, &appDataRaw))) return;
    fs::path appData(appDataRaw);
    CoTaskMemFree(appDataRaw);
    fs::path target = appData / L"r4v3n_steam_files";
    std::error_code error;
    if (!fs::exists(target, error) || error) return;
    // Never recurse through a junction or symlink into an unrelated location.
    DWORD attributes = GetFileAttributesW(target.c_str());
    if (attributes == INVALID_FILE_ATTRIBUTES ||
        (attributes & FILE_ATTRIBUTE_REPARSE_POINT)) return;
    fs::path parent = fs::weakly_canonical(target.parent_path(), error);
    if (error) return;
    fs::path resolvedTarget = fs::weakly_canonical(target, error);
    if (error || !SamePath(parent.wstring(), appData.wstring()) ||
        !SamePath(resolvedTarget.wstring(),
                  (parent / L"r4v3n_steam_files").wstring())) return;
    fs::remove_all(target, error);
}

void SetBootstrapperEnvironment(const wchar_t* gameExe) {
    if (!SetEnvironmentVariableW(L"DRIVERNAME", kServiceName) ||
        !SetEnvironmentVariableW(L"EXENAME", gameExe))
        throw std::wstring(L"Não foi possível preparar o ambiente do bootstrapper: ") +
            WinError(GetLastError());
#if COD_SP
    if (!SetEnvironmentVariableW(L"DIRNAME", kSpFolder))
        throw std::wstring(L"Não foi possível preparar o ambiente da campanha: ") +
            WinError(GetLastError());
#endif
}

void HideFixConsole(HWND window) {
    if (!IsWindowVisible(window)) return;
    wchar_t className[64]{};
    if (!GetClassNameW(window, className, static_cast<int>(std::size(className))) ||
        wcscmp(className, L"ConsoleWindowClass") != 0) return;
    wchar_t title[256]{};
    if (!GetWindowTextW(window, title, static_cast<int>(std::size(title)))) return;
    if (wcsstr(title, kFixConsoleTitle) == nullptr) return;
    ShowWindow(window, SW_HIDE);
}

BOOL CALLBACK HideFixConsoleFromEnumeration(HWND window, LPARAM) {
    HideFixConsole(window);
    return TRUE;
}

void CALLBACK OnFixConsoleWindowEvent(HWINEVENTHOOK, DWORD event, HWND window,
                                       LONG objectId, LONG childId, DWORD, DWORD) {
    if ((event == EVENT_OBJECT_SHOW || event == EVENT_OBJECT_NAMECHANGE) &&
        objectId == OBJID_WINDOW && childId == CHILDID_SELF && window)
        HideFixConsole(window);
}

struct ConsoleWindowWatcher {
    std::atomic<bool> stop{false};
    HANDLE thread = nullptr;
    HANDLE ready = nullptr;

    static DWORD WINAPI Run(void* parameter) {
        auto* self = static_cast<ConsoleWindowWatcher*>(parameter);
        HWINEVENTHOOK showHook = SetWinEventHook(
            EVENT_OBJECT_SHOW, EVENT_OBJECT_SHOW, nullptr,
            OnFixConsoleWindowEvent, 0, 0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS);
        HWINEVENTHOOK nameHook = SetWinEventHook(
            EVENT_OBJECT_NAMECHANGE, EVENT_OBJECT_NAMECHANGE, nullptr,
            OnFixConsoleWindowEvent, 0, 0,
            WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS);
        SetEvent(self->ready);
        while (!self->stop.load()) {
            MSG message{};
            while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
                TranslateMessage(&message);
                DispatchMessageW(&message);
            }
            EnumWindows(HideFixConsoleFromEnumeration, 0);
            Sleep(10);
        }
        if (showHook) UnhookWinEvent(showHook);
        if (nameHook) UnhookWinEvent(nameHook);
        return 0;
    }

    ConsoleWindowWatcher() {
        ready = CreateEventW(nullptr, TRUE, FALSE, nullptr);
        if (!ready)
            throw std::wstring(L"Não foi possível preparar o monitor da janela de console: ") +
                WinError(GetLastError());
        thread = CreateThread(nullptr, 0, Run, this, 0, nullptr);
        if (!thread) {
            DWORD error = GetLastError();
            CloseHandle(ready);
            ready = nullptr;
            throw std::wstring(L"Não foi possível iniciar o monitor da janela de console: ") +
                WinError(error);
        }
        if (WaitForSingleObject(ready, 3000) != WAIT_OBJECT_0) {
            stop.store(true);
            WaitForSingleObject(thread, INFINITE);
            CloseHandle(thread);
            CloseHandle(ready);
            throw std::wstring(L"O monitor da janela de console não iniciou.");
        }
    }

    ConsoleWindowWatcher(const ConsoleWindowWatcher&) = delete;
    ConsoleWindowWatcher& operator=(const ConsoleWindowWatcher&) = delete;
    ~ConsoleWindowWatcher() {
        stop.store(true);
        if (thread) {
            WaitForSingleObject(thread, INFINITE);
            CloseHandle(thread);
        }
        if (ready) CloseHandle(ready);
    }
};

DWORD RunBootstrapper(const fs::path& executable, const fs::path& working,
                      const wchar_t* gameExe) {
    fs::path launchExecutable(ShortPathOrOriginal(executable));
    fs::path launchWorking(ShortPathOrOriginal(working));
    std::wstring command = Quote(launchExecutable.wstring()) + L" " + gameExe;
    std::vector<wchar_t> commandBuffer(command.begin(), command.end());
    commandBuffer.push_back(L'\0');
    ConsoleWindowWatcher watcher;
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    startup.dwFlags = STARTF_USESHOWWINDOW;
    startup.wShowWindow = SW_HIDE;
    PROCESS_INFORMATION process{};
    BOOL ok = CreateProcessW(launchExecutable.c_str(), commandBuffer.data(), nullptr,
                             nullptr, FALSE, CREATE_NEW_CONSOLE,
                             nullptr, launchWorking.c_str(), &startup, &process);
    if (!ok) throw std::wstring(L"Não foi possível iniciar o bootstrapper: ") + WinError(GetLastError());
    CloseHandle(process.hThread);
    DWORD waitResult = WaitForSingleObject(process.hProcess, INFINITE);
    if (waitResult != WAIT_OBJECT_0) {
        DWORD error = GetLastError();
        CloseHandle(process.hProcess);
        throw std::wstring(L"Falha ao aguardar o bootstrapper: ") + WinError(error);
    }
    DWORD exitCode = 1;
    if (!GetExitCodeProcess(process.hProcess, &exitCode)) {
        DWORD error = GetLastError();
        CloseHandle(process.hProcess);
        throw std::wstring(L"Falha ao ler o resultado do bootstrapper: ") + WinError(error);
    }
    CloseHandle(process.hProcess);
    return exitCode;
}

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    HANDLE mutex = CreateMutexW(nullptr, FALSE,
#if COD_GAME == 22
                                L"Local\\MerlinCod22Launcher"
#else
                                L"Local\\MerlinCod23Launcher"
#endif
    );
    if (!mutex) return 1;
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        MessageBoxW(nullptr, L"Este jogo já foi iniciado por outro launcher. Feche-o antes de abrir outro modo.",
                    kWindowTitle, MB_OK | MB_ICONINFORMATION);
        CloseHandle(mutex);
        return 1;
    }

    ServiceHandles handles;
    std::vector<fs::path> copiedFiles;
    try {
        fs::path root(ExeFolder());
        fs::path driver = root / L"Randgrid.sys";
        fs::path rootBootstrapper = root / L"bootstrapper.exe";
        fs::path rootCrashHandler = root / L"bootstrapperCrashHandler.exe";
        RequireFile(driver);
        RequireFile(rootBootstrapper);

#if COD_SP
        fs::path working = root / kSpFolder;
        fs::path game = working / kSpExe;
        RequireFile(game);
        RequireFile(rootCrashHandler);
        fs::path bootstrapper = working / L"bootstrapper.exe";
        fs::path crashHandler = working / L"bootstrapperCrashHandler.exe";
        if (!IsRegularFile(bootstrapper)) {
            if (!CopyFileW(rootBootstrapper.c_str(), bootstrapper.c_str(), TRUE))
                throw std::wstring(L"Não foi possível copiar o bootstrapper para a campanha: ") +
                    WinError(GetLastError());
            copiedFiles.push_back(bootstrapper);
        }
        if (!IsRegularFile(crashHandler)) {
            if (!CopyFileW(rootCrashHandler.c_str(), crashHandler.c_str(), TRUE))
                throw std::wstring(L"Não foi possível copiar o crash handler para a campanha: ") +
                    WinError(GetLastError());
            copiedFiles.push_back(crashHandler);
        }
#else
        fs::path working = root;
        fs::path game = root / kMpExe;
        RequireFile(game);
        fs::path bootstrapper = rootBootstrapper;
#endif

        EnsureService(handles, driver);
        SetBootstrapperEnvironment(
#if COD_SP
            kSpExe
#else
            kMpExe
#endif
        );
        DWORD exitCode = RunBootstrapper(bootstrapper, working,
#if COD_SP
                                         kSpExe
#else
                                         kMpExe
#endif
        );

        std::wstring cleanupError;
        try {
            DeleteCreatedService(handles);
        } catch (const std::wstring& error) {
            cleanupError = error;
        }
#if COD_SP
        DeleteMatchingCrashHandler(crashHandler);
#endif
        for (const auto& copy : copiedFiles) {
            std::error_code error;
            fs::remove(copy, error);
        }
        copiedFiles.clear();

        if (!cleanupError.empty()) throw cleanupError;

        if (exitCode != 0) {
            throw std::wstring(L"O bootstrapper encerrou com código ") +
                std::to_wstring(static_cast<LONG>(exitCode)) +
                L".\nVerifique o log:\n" +
                (working / L"bootstrapper.log").wstring();
        }
        CleanupEmulatorCache();
        CloseHandle(mutex);
        return 0;
    } catch (const std::wstring& error) {
        if (handles.created) DeleteService(handles.service);
        for (const auto& copy : copiedFiles) {
            std::error_code ignored;
            fs::remove(copy, ignored);
        }
        MessageBoxW(nullptr, error.c_str(), kWindowTitle, MB_OK | MB_ICONERROR);
    } catch (const std::exception& error) {
        if (handles.created) DeleteService(handles.service);
        MessageBoxA(nullptr, error.what(), "COD launcher", MB_OK | MB_ICONERROR);
    }
    CloseHandle(mutex);
    return 1;
}
