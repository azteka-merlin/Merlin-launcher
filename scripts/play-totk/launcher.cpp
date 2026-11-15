#define UNICODE
#define _UNICODE
#define WIN32_LEAN_AND_MEAN

#include <windows.h>
#include <tlhelp32.h>

#include <filesystem>
#include <string>
#include <vector>

namespace fs = std::filesystem;

static std::wstring WinError(DWORD code) {
    LPWSTR buffer = nullptr;
    DWORD count = FormatMessageW(FORMAT_MESSAGE_ALLOCATE_BUFFER |
                                     FORMAT_MESSAGE_FROM_SYSTEM |
                                     FORMAT_MESSAGE_IGNORE_INSERTS,
                                 nullptr, code, 0,
                                 reinterpret_cast<LPWSTR>(&buffer), 0, nullptr);
    std::wstring message = count && buffer ? std::wstring(buffer, count) : L"Erro do Windows";
    if (buffer) LocalFree(buffer);
    while (!message.empty() && (message.back() == L'\r' || message.back() == L'\n' || message.back() == L' '))
        message.pop_back();
    return message + L" (" + std::to_wstring(code) + L")";
}

static fs::path LauncherDirectory() {
    std::vector<wchar_t> buffer(32768);
    DWORD count = GetModuleFileNameW(nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (count == 0 || count >= buffer.size())
        throw std::wstring(L"Não foi possível descobrir a pasta do iniciador: ") + WinError(GetLastError());
    return fs::path(std::wstring(buffer.data(), count)).parent_path();
}

static bool GameIsRunning(const fs::path& executable) {
    HANDLE snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snapshot == INVALID_HANDLE_VALUE) return false;
    PROCESSENTRY32W entry{};
    entry.dwSize = sizeof(entry);
    bool found = false;
    if (Process32FirstW(snapshot, &entry)) {
        do {
            if (_wcsicmp(entry.szExeFile, L"totk.exe") != 0) continue;
            HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, entry.th32ProcessID);
            if (!process) continue;
            std::vector<wchar_t> path(32768);
            DWORD count = static_cast<DWORD>(path.size());
            if (QueryFullProcessImageNameW(process, 0, path.data(), &count)) {
                std::error_code error;
                found = fs::equivalent(fs::path(std::wstring(path.data(), count)), executable, error) && !error;
            }
            CloseHandle(process);
            if (found) break;
        } while (Process32NextW(snapshot, &entry));
    }
    CloseHandle(snapshot);
    return found;
}

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    try {
        const fs::path root = LauncherDirectory();
        const fs::path game = root / L"totk.exe";
        std::error_code error;
        if (!fs::is_regular_file(game, error))
            throw std::wstring(L"totk.exe não foi encontrado ao lado do Play_TotK.exe.\n\nPasta: ") + root.wstring();
        if (GameIsRunning(game))
            throw std::wstring(L"O jogo desta pasta já está aberto. Feche a instância anterior antes de abrir outra.");

        SECURITY_ATTRIBUTES inheritable{};
        inheritable.nLength = sizeof(inheritable);
        inheritable.bInheritHandle = TRUE;
        const fs::path logPath = root / L"totk.log";
        HANDLE log = CreateFileW(logPath.c_str(), FILE_APPEND_DATA,
                                 FILE_SHARE_READ | FILE_SHARE_WRITE, &inheritable,
                                 OPEN_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (log == INVALID_HANDLE_VALUE)
            throw std::wstring(L"Não foi possível abrir totk.log: ") + WinError(GetLastError());
        HANDLE input = CreateFileW(L"NUL", GENERIC_READ,
                                   FILE_SHARE_READ | FILE_SHARE_WRITE, &inheritable,
                                   OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (input == INVALID_HANDLE_VALUE) {
            DWORD code = GetLastError();
            CloseHandle(log);
            throw std::wstring(L"Não foi possível preparar a entrada do jogo: ") + WinError(code);
        }

        // CREATE_NO_WINDOW suppresses only the console of a console-subsystem
        // executable. Unlike STARTF_USESHOWWINDOW/SW_HIDE, it does not hide
        // the SDL game window created after startup.
        std::wstring command = L"\"" + game.wstring() + L"\"";
        std::vector<wchar_t> commandBuffer(command.begin(), command.end());
        commandBuffer.push_back(L'\0');
        STARTUPINFOW startup{};
        startup.cb = sizeof(startup);
        startup.dwFlags = STARTF_USESTDHANDLES;
        startup.hStdInput = input;
        startup.hStdOutput = log;
        startup.hStdError = log;
        PROCESS_INFORMATION process{};
        BOOL started = CreateProcessW(game.c_str(), commandBuffer.data(), nullptr,
                                      nullptr, TRUE, CREATE_NO_WINDOW, nullptr,
                                      root.c_str(), &startup, &process);
        DWORD startError = started ? ERROR_SUCCESS : GetLastError();
        CloseHandle(input);
        CloseHandle(log);
        if (!started)
            throw std::wstring(L"Não foi possível iniciar totk.exe: ") + WinError(startError);
        CloseHandle(process.hThread);
        CloseHandle(process.hProcess);
        return 0;
    } catch (const std::wstring& message) {
        MessageBoxW(nullptr, message.c_str(), L"Play TotK", MB_OK | MB_ICONERROR);
        return 1;
    } catch (...) {
        MessageBoxW(nullptr, L"O iniciador encontrou um erro inesperado.",
                    L"Play TotK", MB_OK | MB_ICONERROR);
        return 1;
    }
}
