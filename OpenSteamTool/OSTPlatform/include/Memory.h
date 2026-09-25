#pragma once

#include "include/DynamicLibrary.h"

#include <cstddef>
#include <cstdint>
#include <optional>

namespace OSTPlatform::Memory {

    struct ModuleImage {
        uint8_t* base = nullptr;
        size_t size = 0;
    };

    std::optional<ModuleImage> GetModuleImage(DynamicLibrary::ModuleHandle module);
    // Checks every virtual-memory region covered by [address, address + bytes)
    // before a compatibility probe dereferences an unknown Steam object.
    bool IsReadable(const void* address, size_t bytes);
    bool WriteExecutableByte(void* target, uint8_t value);

} // namespace OSTPlatform::Memory
