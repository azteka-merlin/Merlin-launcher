#include "include/Memory.h"

#include "include/Log.h"

#include <windows.h>
#include <psapi.h>

namespace OSTPlatform::Memory {

namespace {

bool IsReadableProtection(DWORD protect) {
    const DWORD base = protect & ~static_cast<DWORD>(PAGE_GUARD | PAGE_NOCACHE | PAGE_WRITECOMBINE);
    switch (base) {
    case PAGE_READONLY:
    case PAGE_READWRITE:
    case PAGE_WRITECOPY:
    case PAGE_EXECUTE_READ:
    case PAGE_EXECUTE_READWRITE:
    case PAGE_EXECUTE_WRITECOPY:
        return true;
    default:
        return false;
    }
}

} // namespace

std::optional<ModuleImage> GetModuleImage(DynamicLibrary::ModuleHandle module) {
    MODULEINFO info{};
    if (!module || !GetModuleInformation(GetCurrentProcess(), reinterpret_cast<HMODULE>(module), &info, sizeof(info))) {
        OSTP_LOG_DEBUG("GetModuleImage(module={}) failed (error={})", module, GetLastError());
        return std::nullopt;
    }

    return ModuleImage{
        static_cast<uint8_t*>(info.lpBaseOfDll),
        static_cast<size_t>(info.SizeOfImage),
    };
}

bool IsReadable(const void* address, size_t bytes) {
    if (!address || bytes == 0) return false;

    const uintptr_t start = reinterpret_cast<uintptr_t>(address);
    if (start > UINTPTR_MAX - bytes) return false;
    const uintptr_t end = start + bytes;

    for (uintptr_t cursor = start; cursor < end;) {
        MEMORY_BASIC_INFORMATION info{};
        if (VirtualQuery(reinterpret_cast<LPCVOID>(cursor), &info, sizeof(info)) != sizeof(info)) {
            return false;
        }
        if (info.State != MEM_COMMIT || (info.Protect & PAGE_GUARD) || !IsReadableProtection(info.Protect)) {
            return false;
        }
        const uintptr_t regionEnd = reinterpret_cast<uintptr_t>(info.BaseAddress) + info.RegionSize;
        if (regionEnd <= cursor) return false;
        cursor = regionEnd;
    }
    return true;
}

bool WriteExecutableByte(void* target, uint8_t value) {
    if (!target) {
        OSTP_LOG_WARN("WriteExecutableByte: target is null");
        return false;
    }

    DWORD oldProtect = 0;
    if (!VirtualProtect(target, 1, PAGE_EXECUTE_READWRITE, &oldProtect)) {
        OSTP_LOG_WARN("WriteExecutableByte(target={}) VirtualProtect(RWX) failed (error={})",
                      target, GetLastError());
        return false;
    }
    *static_cast<uint8_t*>(target) = value;

    DWORD ignored = 0;
    if (!VirtualProtect(target, 1, oldProtect, &ignored)) {
        OSTP_LOG_WARN("WriteExecutableByte(target={}) VirtualProtect(restore=0x{:X}) failed (error={})",
                      target, oldProtect, GetLastError());
        return false;
    }
    if (!FlushInstructionCache(GetCurrentProcess(), target, 1)) {
        OSTP_LOG_WARN("WriteExecutableByte(target={}) FlushInstructionCache failed (error={})",
                      target, GetLastError());
        return false;
    }
    return true;
}

} // namespace OSTPlatform::Memory
