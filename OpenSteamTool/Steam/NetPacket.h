#ifndef STEAM_NETPACKET_H
#define STEAM_NETPACKET_H

#include "Types.h"

#include <atomic>
#include <cstdint>

struct CNetPacket;

namespace NetPkt {

struct Layout {
    const char* name;
    uint32_t dataOffset;
};

// Steam stable places m_pubData at +0x08; the affected beta layout shifted it
// by two uint32 stamps to +0x10.  The hook confirms the active layout from
// live protobuf packets before it reads or writes either field.
inline constexpr Layout kLayouts[] = {
    { "stable", 0x08 },
    { "beta", 0x10 },
};

inline constexpr uint32_t kUnresolved = 0;
inline constexpr uint32_t kDisabled = 0xFFFFFFFFu;
inline constinit std::atomic<uint32_t> gDataOffset{kUnresolved};

inline uint32_t State() { return gDataOffset.load(std::memory_order_relaxed); }
inline bool IsResolved() { const uint32_t state = State(); return state != kUnresolved && state != kDisabled; }
inline bool IsDisabled() { return State() == kDisabled; }
inline void Latch(uint32_t offset) { gDataOffset.store(offset, std::memory_order_relaxed); }
inline void Disable() { gDataOffset.store(kDisabled, std::memory_order_relaxed); }

namespace detail {
inline uint8* discardedData = nullptr;
inline uint32 discardedSize = 0;
}

inline uint8*& Data(CNetPacket* packet) {
    const uint32_t offset = State();
    if (!packet || offset == kUnresolved || offset == kDisabled) return detail::discardedData;
    return *reinterpret_cast<uint8**>(reinterpret_cast<uint8*>(packet) + offset);
}

inline uint32& Size(CNetPacket* packet) {
    const uint32_t offset = State();
    if (!packet || offset == kUnresolved || offset == kDisabled) return detail::discardedSize;
    return *reinterpret_cast<uint32*>(reinterpret_cast<uint8*>(packet) + offset + 8);
}

inline uint8* Data(const CNetPacket* packet) { return Data(const_cast<CNetPacket*>(packet)); }
inline uint32 Size(const CNetPacket* packet) { return Size(const_cast<CNetPacket*>(packet)); }

} // namespace NetPkt

#endif
