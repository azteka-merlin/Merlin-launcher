#ifndef TEST_GAME
#error TEST_GAME must be 19, 22 or 23
#endif
#define COD_GAME TEST_GAME
#if TEST_GAME == 19
#define COD_SP 0
#else
#define COD_SP 1
#endif
#if TEST_GAME == 19
constexpr wchar_t kProbeVariant[] = L"iw8";
#elif TEST_GAME == 22
constexpr wchar_t kProbeVariant[] = L"cortez";
#elif TEST_GAME == 23
constexpr wchar_t kProbeVariant[] = L"jupiter";
#else
#error Unsupported TEST_GAME
#endif
#define wWinMain launcher_unused_main
#include "launcher.cpp"
#undef wWinMain

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
    try {
        fs::path folder(ExeFolder());
        fs::path probe = folder / L"console_probe_watch.exe";
        if (!SameDriverFile(L"\\??\\" + ShortPathOrOriginal(probe), probe)) return 23;
        return static_cast<int>(RunBootstrapper(probe, folder, kProbeVariant));
    } catch (...) {
        return 22;
    }
}
