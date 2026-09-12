#include "MerlinHelperApi.h"

#include "OSTPlatform/include/Hash.h"

#include <windows.h>

#include <algorithm>
#include <array>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <map>
#include <optional>
#include <set>
#include <span>
#include <sstream>
#include <string>
#include <string_view>
#include <unordered_map>
#include <utility>
#include <vector>

namespace {

struct PatternSeed {
    const char* id;
    const char* name;
    const char* seedSig;
    uint32_t preferredRva = 0;
};

struct IpcMethodSeed {
    const char* name;
    uint32_t methodIndex;
    uint32_t funcHash;
    uint32_t fencepost;
    uint32_t argc;
};

struct IpcInterfaceSeed {
    const char* name;
    uint32_t interfaceId;
    std::span<const IpcMethodSeed> methods;
};

constexpr PatternSeed kSteamclientPatternSeeds[] = {
    {"0x82428E37","BBuildAndAsyncSendFrame","48 8B C4 55 48 8D 68 A1 48 81 EC C0 00 00 00 48 89 70 18"},
    {"0xC37F2D8E","BuildDepotDependency","48 8B C4 4C 89 48 20 89 50 10 48 89 48 08 55 57"},
    {"0xDB78B4AE","BuildSpawnEnvBlock","4C 89 4C 24 20 4C 89 44 24 18 48 89 54 24 10 48 89 4C 24 08 55 53 56 57 41 54 41 55 41 56 41 57 48 8D AC 24 B8 FE FF FF"},
    {"0x64BF7C45","CUtlBufferEnsureCapacity","48 89 5C 24 08 57 48 83 EC 30 48 8B D9 8D 7A 01"},
    {"0x2D945919","CUtlMemoryGrow","48 89 5C 24 10 57 48 83 EC 30 8B FA 48 8B D9 8B 51 08 8B 49 10 8D 04 39",0xE8400},
    {"0x4B1B1D77","CheckAppOwnership","48 8B C4 89 50 10 48 89 48 08 55 53"},
    {"0x04691B23","CloseAppCloud","48 89 5C 24 10 57 48 83 EC 30 8B FA 48 8B D9 85 D2"},
    {"0x6179E8F9","ConfigStoreGetBinary","40 53 55 56 57 48 83 EC 38 48 63 FA 49 8B E9"},
    {"0xAC76B47D","GetAppDataFromAppInfo","40 53 55 56 57 41 56 41 57 48 81 EC 78 01 00 00"},
    {"0xA185DB47","GetAppIDForCurrentPipe","8B 81 30 0D 00 00 83 F8 FF 74 ??"},
    {"0xCC79542C","GetOrAddAppData","48 83 EC 58 48 8B 05 ?? ?? ?? ?? 48 89 5C 24 68 48 89 6C 24 70"},
    {"0x3B3A0F9D","GetPackageInfo","48 89 5C 24 18 89 54 24 10 55 56 57 48 83 EC 20 44 8B 49 20"},
    {"0x02DF23BC","GetPipeClient","85 D2 74 ?? 44 0F B7 CA 44 3B 49 60"},
    {"0xC3E20E29","IPCProcessMessage","48 89 5C 24 18 48 89 6C 24 20 57 41 54 41 55 41 56 41 57 48 83 EC 30"},
    {"0xED5ED0C8","KeyValues_FindOrCreateKey","48 8B C4 4C 89 48 20 57 48 81 EC 60 04 00 00"},
    {"0x2434A8BA","KeyValues_ReadAsBinary","48 8B C4 44 88 48 20 55 48 8D 68 A9"},
    {"0xB13C0C3F","LoadDepotDecryptionKey","40 53 55 56 57 48 83 EC 38 48 63 FA 49 8B E9"},
    {"0x31E49927","LoadPackage","44 89 44 24 18 53 55 56 57 41 55"},
    {"0xC451039D","MarkLicenseAsChanged","48 89 5C 24 20 89 54 24 10 55 56 57 48 83 EC 20"},
    {"0x06631030","OptedInMask","89 54 24 10 55 53 56 57 41 55 41 56 48 8D AC 24 38 FF FF FF"},
    {"0x0F926D0A","PchMsgNameFromEMsg","48 89 5C 24 08 57 48 83 EC 20 8B D9 E8 ?? ?? ?? ??"},
    {"0x103B52AA","ProcessPendingLicenseUpdates","41 56 41 57 48 83 EC 38 83 B9 98 24 00 00 00"},
    {"0x836FF9F0","RecvPkt","48 8B C4 55 48 8D A8 98 F6 FF FF"},
    {"0x68211B4D","SendCallbackToPipe","48 89 5C 24 08 57 48 83 EC 30 41 8B D9 41 8B F8"},
    {"0x7D1EC415","SpawnProcess","48 89 5C 24 18 4C 89 4C 24 20 48 89 54 24 10 55 56 57 41 54 41 55 41 56 41 57 48 8D AC 24 30 FF FF FF"},
};

constexpr PatternSeed kSteamuiPatternSeeds[] = {
    {"0xD05E26A2","AddProtobufAsBinary","40 53 55 56 57 48 83 EC 28 48 8B 05 ?? ?? ?? ?? 48 8B F2"},
    {"0xE22F74B4","BuildCompleteAppOverviewChange","4C 89 44 24 18 48 89 54 24 10 48 89 4C 24 08 55 53 56 57 41 54 41 55 41 56 41 57 48 8D 6C 24 E1"},
    {"0x221F0661","CSteamUIAppControllerRunFrame","48 89 5C 24 10 48 89 6C 24 18 56 57 41 54 41 56 41 57 48 83 EC 40 0F 29 74 24 30"},
    {"0xB030A061","FillInAppOverview","48 89 54 24 10 48 89 4C 24 08 55 53 56 57 41 54 41 55 41 56 41 57 48 8D 6C 24 E1 48 81 EC B8 00 00 00"},
    {"0x3FC68546","GetAppByID","89 54 24 10 53 48 83 EC 40 48 8B 05 ?? ?? ?? ??"},
    {"0xC89CFA75","GetTopManager","48 8B 05 C9 2C B1 00 C3",0x611D80},
    {"0xBDE16BD6","LoadModuleWithPath","48 89 5C 24 18 55 56 41 57 48 83 EC 40"},
    {"0xC7D5CACF","MarkAppChange","48 83 EC 78 48 8B 05 ?? ?? ?? ?? 48 89 74 24 70"},
    {"0x153479F0","RepeatedFieldUint32_Add","48 89 74 24 10 48 89 7C 24 18 41 56 48 83 EC 20 8B 31 48 8B F9 8B 49 04",0x6D8340},
    {"0xD055D6C0","ShouldShowAppInLibrary","40 53 48 83 EC 20 48 8B 01 48 8B D9 FF 10 3D D6 0C 09 00"},
};

constexpr IpcMethodSeed kIClientUserMethods[] = {
    {"GetSteamID",10,0xD6FC3200u,0xD7058CA5u,0},
    {"GetAppOwnershipTicketExtendedData",105,0xC7E71245u,0xC8449840u,2},
    {"RequestEncryptedAppTicket",120,0x25D6BB1Du,0x2646B663u,2},
    {"GetEncryptedAppTicket",121,0xE0468CB4u,0xE0B80200u,1},
};

constexpr IpcMethodSeed kIClientUtilsMethods[] = {
    {"GetAppID",19,0x09607EC4u,0x0AFE7552u,0},
    {"GetAPICallResult",24,0x2D3D3947u,0x2EDF5EE6u,3},
};

constexpr IpcInterfaceSeed kIpcInterfaces[] = {
    {"IClientUser",1,std::span<const IpcMethodSeed>(kIClientUserMethods)},
    {"IClientUtils",4,std::span<const IpcMethodSeed>(kIClientUtilsMethods)},
};

struct SectionInfo {
    uint32_t virtualAddress = 0;
    uint32_t virtualSize = 0;
    uint32_t rawOffset = 0;
    uint32_t rawSize = 0;
    bool executable = false;
    bool initializedData = false;
};

struct RuntimeFunction {
    uint32_t beginRva = 0;
    uint32_t endRva = 0;
    uint32_t unwindRva = 0;
};

struct PortableExecutable {
    uint64_t imageBase = 0;
    uint32_t exceptionTableRva = 0;
    uint32_t exceptionTableSize = 0;
    std::vector<SectionInfo> sections;
};

struct PatternEntry {
    std::string id;
    std::string name;
    std::string rva;
    std::string sig;
};

struct IpcMethodResolved {
    std::string name;
    uint32_t methodIndex = 0;
    uint32_t funcHash = 0;
    uint32_t fencepost = 0;
    uint32_t argc = 0;
    uint32_t wrapperRvaValue = 0;
};

struct IpcInterfaceResolved {
    std::string name;
    uint32_t interfaceId = 0;
    uint32_t vtableRva = 0;
    std::vector<IpcMethodResolved> methods;
};

std::string ToHex(uint64_t value, size_t minWidth = 1)
{
    std::ostringstream oss;
    oss << "0x" << std::uppercase << std::hex;
    oss.width(static_cast<std::streamsize>(minWidth));
    oss.fill('0');
    oss << value;
    return oss.str();
}

std::optional<std::vector<uint8_t>> ReadFileBytes(const std::filesystem::path& path)
{
    std::ifstream ifs(path, std::ios::binary);
    if (!ifs) return std::nullopt;
    return std::vector<uint8_t>(std::istreambuf_iterator<char>(ifs), std::istreambuf_iterator<char>());
}

std::optional<PortableExecutable> ParsePe64(const std::vector<uint8_t>& buffer)
{
    if (buffer.size() < sizeof(IMAGE_DOS_HEADER)) return std::nullopt;
    const auto* dos = reinterpret_cast<const IMAGE_DOS_HEADER*>(buffer.data());
    if (dos->e_magic != IMAGE_DOS_SIGNATURE) return std::nullopt;
    if (dos->e_lfanew <= 0 || static_cast<size_t>(dos->e_lfanew) + sizeof(IMAGE_NT_HEADERS64) > buffer.size())
        return std::nullopt;

    const auto* nt = reinterpret_cast<const IMAGE_NT_HEADERS64*>(buffer.data() + dos->e_lfanew);
    if (nt->Signature != IMAGE_NT_SIGNATURE) return std::nullopt;
    if (nt->OptionalHeader.Magic != IMAGE_NT_OPTIONAL_HDR64_MAGIC) return std::nullopt;

    PortableExecutable pe;
    pe.imageBase = nt->OptionalHeader.ImageBase;
    pe.exceptionTableRva = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXCEPTION].VirtualAddress;
    pe.exceptionTableSize = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_EXCEPTION].Size;

    const auto* section = IMAGE_FIRST_SECTION(nt);
    for (unsigned i = 0; i < nt->FileHeader.NumberOfSections; ++i, ++section) {
        SectionInfo info;
        info.virtualAddress = section->VirtualAddress;
        info.virtualSize = section->Misc.VirtualSize;
        info.rawOffset = section->PointerToRawData;
        info.rawSize = section->SizeOfRawData;
        info.executable = (section->Characteristics & IMAGE_SCN_MEM_EXECUTE) != 0;
        info.initializedData =
            (section->Characteristics & IMAGE_SCN_CNT_INITIALIZED_DATA) != 0 ||
            (section->Characteristics & IMAGE_SCN_CNT_UNINITIALIZED_DATA) != 0;
        pe.sections.push_back(info);
    }

    return pe;
}

std::optional<uint32_t> FileOffsetToRva(const PortableExecutable& pe, uint32_t fileOffset)
{
    for (const auto& section : pe.sections) {
        if (fileOffset >= section.rawOffset && fileOffset < section.rawOffset + section.rawSize) {
            return section.virtualAddress + (fileOffset - section.rawOffset);
        }
    }
    return std::nullopt;
}

std::optional<uint32_t> RvaToFileOffset(const PortableExecutable& pe, uint32_t rva)
{
    for (const auto& section : pe.sections) {
        const uint32_t size = (std::max)(section.virtualSize, section.rawSize);
        if (rva >= section.virtualAddress && rva < section.virtualAddress + size) {
            return section.rawOffset + (rva - section.virtualAddress);
        }
    }
    return std::nullopt;
}

bool IsExecutableRva(const PortableExecutable& pe, uint32_t rva)
{
    for (const auto& section : pe.sections) {
        const uint32_t size = (std::max)(section.virtualSize, section.rawSize);
        if (rva >= section.virtualAddress && rva < section.virtualAddress + size)
            return section.executable;
    }
    return false;
}

std::vector<RuntimeFunction> ParseRuntimeFunctions(const PortableExecutable& pe, const std::vector<uint8_t>& buffer)
{
    std::vector<RuntimeFunction> out;
    if (!pe.exceptionTableRva || !pe.exceptionTableSize) return out;

    const auto tableOffset = RvaToFileOffset(pe, pe.exceptionTableRva);
    if (!tableOffset) return out;

    const uint32_t count = pe.exceptionTableSize / sizeof(IMAGE_RUNTIME_FUNCTION_ENTRY);
    for (uint32_t i = 0; i < count; ++i) {
        const auto entryOffset = *tableOffset + i * sizeof(IMAGE_RUNTIME_FUNCTION_ENTRY);
        if (entryOffset + sizeof(IMAGE_RUNTIME_FUNCTION_ENTRY) > buffer.size()) break;
        const auto* entry = reinterpret_cast<const IMAGE_RUNTIME_FUNCTION_ENTRY*>(buffer.data() + entryOffset);
        if (!entry->BeginAddress || !entry->EndAddress) continue;
        out.push_back({entry->BeginAddress, entry->EndAddress, entry->UnwindInfoAddress});
    }
    std::sort(out.begin(), out.end(), [](const RuntimeFunction& a, const RuntimeFunction& b) {
        return a.beginRva < b.beginRva;
    });
    return out;
}

const RuntimeFunction* FindRuntimeFunctionContaining(const std::vector<RuntimeFunction>& functions, uint32_t rva)
{
    size_t lo = 0;
    size_t hi = functions.size();
    while (lo < hi) {
        const size_t mid = (lo + hi) / 2;
        const auto& item = functions[mid];
        if (rva < item.beginRva) hi = mid;
        else if (rva >= item.endRva) lo = mid + 1;
        else return &item;
    }
    return nullptr;
}

std::vector<int> ParseSignatureTokens(std::string_view sig)
{
    std::vector<int> out;
    std::string token;
    std::istringstream iss{std::string(sig)};
    while (iss >> token) {
        if (token == "??") out.push_back(-1);
        else out.push_back(static_cast<int>(std::strtoul(token.c_str(), nullptr, 16)));
    }
    return out;
}

std::vector<uint32_t> FindAllMatches(const std::vector<uint8_t>& buffer, const std::vector<int>& tokens)
{
    std::vector<uint32_t> matches;
    if (tokens.empty() || buffer.size() < tokens.size()) return matches;
    for (size_t offset = 0; offset + tokens.size() <= buffer.size(); ++offset) {
        bool ok = true;
        for (size_t i = 0; i < tokens.size(); ++i) {
            if (tokens[i] >= 0 && buffer[offset + i] != static_cast<uint8_t>(tokens[i])) {
                ok = false;
                break;
            }
        }
        if (ok) matches.push_back(static_cast<uint32_t>(offset));
    }
    return matches;
}

std::vector<uint32_t> FindAllRawMatches(const std::vector<uint8_t>& buffer,
                                        std::span<const uint8_t> bytes,
                                        const std::vector<SectionInfo>& sections,
                                        bool requireExecutable,
                                        bool requireInitializedData)
{
    std::vector<uint32_t> out;
    if (bytes.empty()) return out;
    for (const auto& section : sections) {
        if (requireExecutable && !section.executable) continue;
        if (requireInitializedData && !section.initializedData) continue;
        const uint32_t start = section.rawOffset;
        const uint32_t end = (std::min<uint64_t>)(buffer.size(), static_cast<uint64_t>(section.rawOffset) + section.rawSize);
        if (end < start || end - start < bytes.size()) continue;
        for (uint32_t offset = start; offset + bytes.size() <= end; ++offset) {
            if (std::memcmp(buffer.data() + offset, bytes.data(), bytes.size()) == 0) {
                out.push_back(offset);
            }
        }
    }
    return out;
}

std::vector<int> WildcardIndexesFromSeed(std::string_view seedSig)
{
    std::vector<int> out;
    std::string token;
    std::istringstream iss{std::string(seedSig)};
    int index = 0;
    while (iss >> token) {
        if (token == "??") out.push_back(index);
        ++index;
    }
    return out;
}

std::vector<int> DeriveWildcardsFromLiveBytes(const std::vector<uint8_t>& bytes)
{
    std::set<int> wildcards;
    for (size_t i = 0; i + 4 < bytes.size(); ++i) {
        const auto opcode = bytes[i];
        if (opcode == 0xE8 || opcode == 0xE9) {
            for (int j = 1; j <= 4; ++j) wildcards.insert(static_cast<int>(i + j));
            continue;
        }
        if ((opcode == 0x48 || opcode == 0x4C) && i + 6 < bytes.size()) {
            const auto opcode2 = bytes[i + 1];
            const auto opcode3 = bytes[i + 2];
            if ((opcode2 == 0x8B || opcode2 == 0x8D || opcode2 == 0x89 || opcode2 == 0x39) &&
                opcode3 >= 0x05 && opcode3 <= 0x3D && ((opcode3 - 0x05) % 8 == 0)) {
                for (int j = 3; j <= 6; ++j) wildcards.insert(static_cast<int>(i + j));
            }
        }
    }
    return std::vector<int>(wildcards.begin(), wildcards.end());
}

std::vector<int> MergeWildcards(std::vector<int> a, std::vector<int> b, size_t length)
{
    std::set<int> merged;
    for (int value : a) if (value >= 0 && static_cast<size_t>(value) < length) merged.insert(value);
    for (int value : b) if (value >= 0 && static_cast<size_t>(value) < length) merged.insert(value);
    return std::vector<int>(merged.begin(), merged.end());
}

std::string BytesToSignature(const std::vector<uint8_t>& bytes, const std::vector<int>& wildcards)
{
    std::set<int> wildcardSet(wildcards.begin(), wildcards.end());
    std::ostringstream oss;
    for (size_t i = 0; i < bytes.size(); ++i) {
        if (i) oss << ' ';
        if (wildcardSet.count(static_cast<int>(i))) oss << "??";
        else {
            oss << std::uppercase << std::hex;
            oss.width(2);
            oss.fill('0');
            oss << static_cast<int>(bytes[i]);
        }
    }
    return oss.str();
}

std::optional<PatternEntry> BuildAutoPatternEntry(const PortableExecutable& pe,
                                                  const std::vector<uint8_t>& buffer,
                                                  const PatternSeed& seed,
                                                  uint32_t seedMatchOffset)
{
    const auto minLength = ParseSignatureTokens(seed.seedSig).size();
    const auto maxLength = (std::min<size_t>)(128, buffer.size() - seedMatchOffset);
    size_t length = minLength;

    while (length <= maxLength) {
        std::vector<uint8_t> liveBytes(buffer.begin() + seedMatchOffset, buffer.begin() + seedMatchOffset + length);
        auto wildcards = MergeWildcards(
            WildcardIndexesFromSeed(seed.seedSig),
            DeriveWildcardsFromLiveBytes(liveBytes),
            length
        );
        const auto sig = BytesToSignature(liveBytes, wildcards);
        const auto matches = FindAllMatches(buffer, ParseSignatureTokens(sig));
        if (matches.size() == 1 && matches[0] == seedMatchOffset) {
            const auto rva = FileOffsetToRva(pe, seedMatchOffset);
            if (!rva) return std::nullopt;
            return PatternEntry{
                seed.id,
                seed.name,
                ToHex(*rva),
                sig
            };
        }
        length += 8;
    }

    return std::nullopt;
}

std::optional<std::vector<PatternEntry>> GeneratePatterns(const std::filesystem::path& dllPath,
                                                          std::span<const PatternSeed> seeds)
{
    const auto bytesOpt = ReadFileBytes(dllPath);
    if (!bytesOpt) return std::nullopt;
    const auto& bytes = *bytesOpt;
    const auto peOpt = ParsePe64(bytes);
    if (!peOpt) return std::nullopt;
    const auto& pe = *peOpt;

    std::vector<PatternEntry> entries;
    entries.reserve(seeds.size());

    for (const auto& seed : seeds) {
        auto matches = FindAllMatches(bytes, ParseSignatureTokens(seed.seedSig));
        if (matches.size() != 1 && seed.preferredRva != 0) {
            std::vector<uint32_t> filtered;
            for (auto offset : matches) {
                const auto rva = FileOffsetToRva(pe, offset);
                if (rva && *rva == seed.preferredRva) filtered.push_back(offset);
            }
            matches = std::move(filtered);
        }
        if (matches.size() != 1) return std::nullopt;
        const auto entry = BuildAutoPatternEntry(pe, bytes, seed, matches[0]);
        if (!entry) return std::nullopt;
        entries.push_back(*entry);
    }

    return entries;
}

template <typename T>
std::array<uint8_t, sizeof(T)> ToLeBytes(T value)
{
    std::array<uint8_t, sizeof(T)> out{};
    for (size_t i = 0; i < sizeof(T); ++i) out[i] = static_cast<uint8_t>((value >> (i * 8)) & 0xFF);
    return out;
}

std::optional<std::vector<IpcInterfaceResolved>> GenerateIpc(const std::filesystem::path& dllPath)
{
    const auto bytesOpt = ReadFileBytes(dllPath);
    if (!bytesOpt) return std::nullopt;
    const auto& bytes = *bytesOpt;
    const auto peOpt = ParsePe64(bytes);
    if (!peOpt) return std::nullopt;
    const auto& pe = *peOpt;
    const auto runtimeFunctions = ParseRuntimeFunctions(pe, bytes);

    std::vector<IpcInterfaceResolved> interfaces;

    for (const auto& ifaceSeed : kIpcInterfaces) {
        IpcInterfaceResolved resolvedIface;
        resolvedIface.name = ifaceSeed.name;
        resolvedIface.interfaceId = ifaceSeed.interfaceId;

        for (const auto& methodSeed : ifaceSeed.methods) {
            const auto fencepostMatches = FindAllRawMatches(
                bytes,
                std::span<const uint8_t>(ToLeBytes<uint32_t>(methodSeed.fencepost).data(), sizeof(uint32_t)),
                pe.sections,
                true,
                false
            );
            if (fencepostMatches.size() != 1) return std::nullopt;

            const auto fencepostRva = FileOffsetToRva(pe, fencepostMatches[0]);
            if (!fencepostRva) return std::nullopt;

            const auto* runtimeFn = FindRuntimeFunctionContaining(runtimeFunctions, *fencepostRva);
            if (!runtimeFn) return std::nullopt;

            resolvedIface.methods.push_back({
                methodSeed.name,
                methodSeed.methodIndex,
                methodSeed.funcHash,
                methodSeed.fencepost,
                methodSeed.argc,
                runtimeFn->beginRva
            });
        }

        struct CandidateHit {
            uint32_t candidateStartRva = 0;
            std::set<std::string> pivots;
        };

        std::map<uint32_t, CandidateHit> candidateHits;
        for (const auto& method : resolvedIface.methods) {
            const uint64_t wrapperVa = pe.imageBase + method.wrapperRvaValue;
            const auto wrapperBytes = ToLeBytes<uint64_t>(wrapperVa);
            const auto refs = FindAllRawMatches(
                bytes,
                std::span<const uint8_t>(wrapperBytes.data(), wrapperBytes.size()),
                pe.sections,
                false,
                true
            );
            for (auto refOffset : refs) {
                const auto refRva = FileOffsetToRva(pe, refOffset);
                if (!refRva) continue;
                if (*refRva < method.methodIndex * 8) continue;
                const uint32_t candidateStartRva = *refRva - method.methodIndex * 8;
                auto& hit = candidateHits[candidateStartRva];
                hit.candidateStartRva = candidateStartRva;
                hit.pivots.insert(method.name);
            }
        }

        const size_t minPivotCount = candidateHits.size() >= 2 ? 2 : 1;
        bool foundVtable = false;
        for (const auto& [candidateRva, hit] : candidateHits) {
            if (hit.pivots.size() < minPivotCount) continue;
            bool ok = true;
            for (const auto& method : resolvedIface.methods) {
                const auto slotOffset = RvaToFileOffset(pe, candidateRva + method.methodIndex * 8);
                if (!slotOffset || *slotOffset + 8 > bytes.size()) {
                    ok = false;
                    break;
                }
                const uint64_t slotVa = *reinterpret_cast<const uint64_t*>(bytes.data() + *slotOffset);
                if (slotVa < pe.imageBase) {
                    ok = false;
                    break;
                }
                const auto slotRva = static_cast<uint32_t>(slotVa - pe.imageBase);
                if (!IsExecutableRva(pe, slotRva)) {
                    ok = false;
                    break;
                }
            }
            if (ok) {
                resolvedIface.vtableRva = candidateRva;
                foundVtable = true;
                break;
            }
        }
        if (!foundVtable) return std::nullopt;

        for (auto& method : resolvedIface.methods) {
            const auto slotOffset = RvaToFileOffset(pe, resolvedIface.vtableRva + method.methodIndex * 8);
            if (!slotOffset || *slotOffset + 8 > bytes.size()) return std::nullopt;
            const uint64_t slotVa = *reinterpret_cast<const uint64_t*>(bytes.data() + *slotOffset);
            if (slotVa < pe.imageBase) return std::nullopt;
            method.wrapperRvaValue = static_cast<uint32_t>(slotVa - pe.imageBase);
        }

        interfaces.push_back(std::move(resolvedIface));
    }

    return interfaces;
}

bool WriteTextFile(const std::filesystem::path& path, const std::string& content)
{
    std::error_code ec;
    std::filesystem::create_directories(path.parent_path(), ec);
    std::ofstream ofs(path, std::ios::binary);
    if (!ofs) return false;
    ofs.write(content.data(), static_cast<std::streamsize>(content.size()));
    return static_cast<bool>(ofs);
}

std::string RenderPatternToml(const std::vector<PatternEntry>& entries)
{
    std::ostringstream oss;
    for (size_t i = 0; i < entries.size(); ++i) {
        const auto& entry = entries[i];
        if (i) oss << "\n";
        oss << "[" << entry.id << "]\n";
        oss << "name = \"" << entry.name << "\"\n";
        oss << "rva = \"" << entry.rva << "\"\n";
        oss << "sig = \"" << entry.sig << "\"\n";
    }
    return oss.str();
}

std::string RenderIpcToml(const std::vector<IpcInterfaceResolved>& interfaces)
{
    std::ostringstream oss;
    for (size_t i = 0; i < interfaces.size(); ++i) {
        const auto& iface = interfaces[i];
        if (i) oss << "\n";
        oss << "[" << iface.name << "]\n";
        oss << "interface_id = " << iface.interfaceId << "\n";
        oss << "vtable_rva = \"" << ToHex(iface.vtableRva) << "\"\n\n";
        for (size_t m = 0; m < iface.methods.size(); ++m) {
            const auto& method = iface.methods[m];
            oss << "[" << iface.name << "." << method.name << "]\n";
            oss << "method_index = " << method.methodIndex << "\n";
            oss << "funcHash = \"" << ToHex(method.funcHash, 8) << "\"\n";
            oss << "wrapper_rva = \"" << ToHex(method.wrapperRvaValue) << "\"\n";
            oss << "fencepost = \"" << ToHex(method.fencepost, 8) << "\"\n";
            oss << "argc = " << method.argc << "\n";
            if (m + 1 < iface.methods.size()) oss << "\n";
        }
        if (i + 1 < interfaces.size()) oss << "\n";
    }
    return oss.str();
}

uint32_t GeneratePatternFile(const std::filesystem::path& steamRoot,
                             const std::filesystem::path& dllPath,
                             std::span<const PatternSeed> seeds,
                             const char* component)
{
    const auto entries = GeneratePatterns(dllPath, seeds);
    if (!entries) return 0;
    const auto sha = OSTPlatform::Hash::Sha256OfFile(dllPath);
    if (sha.empty()) return 0;
    const auto outPath = steamRoot / "opensteamtool" / "pattern" / component / (sha + ".toml");
    return WriteTextFile(outPath, RenderPatternToml(*entries)) ? 1u : 0u;
}

uint32_t GenerateIpcFile(const std::filesystem::path& steamRoot,
                         const std::filesystem::path& steamclientPath)
{
    const auto interfaces = GenerateIpc(steamclientPath);
    if (!interfaces) return 0;
    const auto sha = OSTPlatform::Hash::Sha256OfFile(steamclientPath);
    if (sha.empty()) return 0;
    const auto outPath = steamRoot / "opensteamtool" / "ipc" / "steamclient" / (sha + ".toml");
    return WriteTextFile(outPath, RenderIpcToml(*interfaces)) ? 1u : 0u;
}

uint32_t GenerateAllInternal(const MerlinHelperApi::GenerateRequest& request, MerlinHelperApi::GenerateResult* result)
{
    const auto steamRoot = std::filesystem::path(request.steamRoot ? request.steamRoot : "");
    const auto steamclientPath = std::filesystem::path(request.steamclientPath ? request.steamclientPath : "");
    const auto steamuiPath = std::filesystem::path(request.steamuiPath ? request.steamuiPath : "");
    if (steamRoot.empty() || steamclientPath.empty() || steamuiPath.empty()) return 0;

    uint32_t generatedMask = 0;
    uint32_t failedMask = 0;

    if (request.flags & MerlinHelperApi::GeneratePatternSteamclient) {
        if (GeneratePatternFile(steamRoot, steamclientPath, kSteamclientPatternSeeds, "steamclient"))
            generatedMask |= MerlinHelperApi::GeneratePatternSteamclient;
        else
            failedMask |= MerlinHelperApi::GeneratePatternSteamclient;
    }

    if (request.flags & MerlinHelperApi::GeneratePatternSteamui) {
        if (GeneratePatternFile(steamRoot, steamuiPath, kSteamuiPatternSeeds, "steamui"))
            generatedMask |= MerlinHelperApi::GeneratePatternSteamui;
        else
            failedMask |= MerlinHelperApi::GeneratePatternSteamui;
    }

    if (request.flags & MerlinHelperApi::GenerateIpcSteamclient) {
        if (GenerateIpcFile(steamRoot, steamclientPath))
            generatedMask |= MerlinHelperApi::GenerateIpcSteamclient;
        else
            failedMask |= MerlinHelperApi::GenerateIpcSteamclient;
    }

    if (result && result->structSize >= sizeof(MerlinHelperApi::GenerateResult)) {
        result->generatedMask = generatedMask;
        result->failedMask = failedMask;
    }
    return generatedMask;
}

} // namespace

extern "C" __declspec(dllexport)
uint32_t MerlinGenerateOpenSteamToolMetadata(const MerlinHelperApi::GenerateRequest* request,
                                             MerlinHelperApi::GenerateResult* result)
{
    if (!request || request->structSize < sizeof(MerlinHelperApi::GenerateRequest)) return 0;
    if (result && result->structSize < sizeof(MerlinHelperApi::GenerateResult)) return 0;
    try {
        return GenerateAllInternal(*request, result);
    } catch (...) {
        if (result && result->structSize >= sizeof(MerlinHelperApi::GenerateResult)) {
            result->generatedMask = 0;
            result->failedMask = request->flags;
        }
        return 0;
    }
}
