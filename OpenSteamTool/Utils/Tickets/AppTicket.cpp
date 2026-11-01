#include "AppTicket.h"
#include "SourceTicket.h"
#include "Hook/Hooks_Decryption.h"
#include "OSTPlatform/include/Encoding.h"
#include "OSTPlatform/include/SteamCredentialStore.h"
#include "Utils/Config/LuaConfig.h"
#include "Utils/Logging/Log.h"
#include "dllmain.h"

#include <filesystem>
#include <fstream>
#include <iterator>
#include <mutex>
#include <optional>
#include <system_error>

namespace AppTicket {
    constexpr AppId_t kPrimaryAppTicketSourceAppId = 7;
    constexpr AppId_t kFallbackAppTicketSourceAppId = 228980;
    constexpr size_t kSteamIdTicketMinimumSize = 16;

    static uint64_t GetSteamIDFromCredentialStore(AppId_t appId) {
        uint64_t steamId = 0;
        const auto status = OSTPlatform::SteamCredentialStore::GetSteamId(appId, steamId);
        if (status != OSTPlatform::SteamCredentialStore::Status::Ok) {
            LOG_TRACE("GetSpoofSteamID for AppId {}: SteamID unavailable in credential store ({})",
                      appId, OSTPlatform::SteamCredentialStore::ToString(status));
            return 0;
        }

        LOG_DEBUG("GetSpoofSteamID for AppId {}: SteamID credential -> 0x{:X}({})", appId, steamId, steamId);
        return steamId;
    }

    std::vector<uint8_t> GetAppOwnershipTicketFromCredentialStore(AppId_t appId) {
        // exclude those appids that are not in addappid
        if (!LuaConfig::HasDepot(appId)) {
            LOG_DEBUG("GetAppOwnershipTicketFromCredentialStore for AppId {}: not in addappid, skip", appId);
            return {};
        }
        std::vector<uint8_t> ticket;
        const auto status = OSTPlatform::SteamCredentialStore::GetAppTicket(appId, ticket);
        if (status != OSTPlatform::SteamCredentialStore::Status::Ok) {
            LOG_TRACE("Read App Ownership Ticket for AppId {}: cached credential unavailable ({})",
                      appId, OSTPlatform::SteamCredentialStore::ToString(status));
            return {};
        }

        LOG_INFO("Successfully retrieved App Ownership Ticket from credential store, AppId: {}, Ticket Size: {}", appId, ticket.size());
        return ticket;
    }

    static std::filesystem::path LocalConfigPath(uint32_t accountId) {
        if (!SteamInstallPath[0]) return {};

        const std::wstring steamPath = OSTPlatform::Encoding::Utf8ToWide(SteamInstallPath);
        if (steamPath.empty()) return {};

        return std::filesystem::path(steamPath) / L"userdata" / std::to_wstring(accountId) /
               L"config" / L"localconfig.vdf";
    }

    static std::optional<SourceTicket> ReadLocalConfigSourceTicket(const std::filesystem::path& path,
                                                                   uint32_t accountId) {
        std::ifstream file(path, std::ios::binary);
        if (!file) {
            LOG_DEBUG("ReadLocalConfigSourceTicket: cannot open localconfig for account {}", accountId);
            return std::nullopt;
        }

        const std::string data((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
        if (file.bad()) {
            LOG_DEBUG("ReadLocalConfigSourceTicket: failed while reading account {}", accountId);
            return std::nullopt;
        }
        SourceTicket source = FindLocalConfigSourceTicket(data, accountId);
        if (source.appId != 0) {
            LOG_INFO("ReadLocalConfigSourceTicket: using AppId {} ticket for account {}",
                     source.appId, accountId);
        }
        return source;
    }

    static SourceTicket PickForgeSourceTicket() {
        uint32_t accountId = 0;
        std::wstring universe;
        const auto status = OSTPlatform::SteamCredentialStore::GetActiveUser(accountId, universe);
        if (status != OSTPlatform::SteamCredentialStore::Status::Ok || accountId == 0) {
            LOG_DEBUG("PickForgeSourceTicket: active Steam account unavailable ({})",
                      OSTPlatform::SteamCredentialStore::ToString(status));
            return {};
        }

        // A Steam account change invalidates the selected ticket. File misses
        // are checked again when Steam writes a new localconfig version.
        static std::mutex sourceMutex;
        static uint32_t cachedAccountId = 0;
        static SourceTicket cachedSource;
        static std::optional<std::filesystem::file_time_type> checkedLocalConfigWriteTime;
        std::lock_guard<std::mutex> lock(sourceMutex);
        if (cachedAccountId != accountId) {
            cachedAccountId = accountId;
            cachedSource = {};
            checkedLocalConfigWriteTime.reset();
        }
        if (cachedSource.appId != 0) return cachedSource;

        // A missing or unchanged file needs no repeat read on every IPC call.
        // Steam updates its write time when tickets change, so retry then.
        const std::filesystem::path path = LocalConfigPath(accountId);
        if (!path.empty()) {
            std::error_code error;
            const auto writeTime = std::filesystem::last_write_time(path, error);
            if (!error && (!checkedLocalConfigWriteTime || *checkedLocalConfigWriteTime != writeTime)) {
                const auto source = ReadLocalConfigSourceTicket(path, accountId);
                std::error_code afterReadError;
                const auto afterReadWriteTime = std::filesystem::last_write_time(path, afterReadError);
                if (source && !afterReadError && afterReadWriteTime == writeTime) {
                    checkedLocalConfigWriteTime = writeTime;
                    if (source->appId != 0) {
                        cachedSource = *source;
                        return *source;
                    }
                }
            }
        }

        const auto tryCachedAppId = [&](AppId_t sourceAppId) -> SourceTicket {
            std::vector<uint8_t> data = Hooks_Decryption::GetCacheAppOwnershipTicket(sourceAppId);
            if (IsSourceTicketForAccount(data, accountId)) {
                LOG_INFO("PickForgeSourceTicket: using cached AppId {} ticket for account {}",
                         sourceAppId, accountId);
                return {sourceAppId, std::move(data)};
            }
            if (!data.empty()) {
                LOG_DEBUG("PickForgeSourceTicket: skip cached AppId {} ticket (SteamID account {} != active {})",
                          sourceAppId, static_cast<uint32_t>(ExtractSteamIdFromTicketBytes(data)), accountId);
            }
            return {};
        };

        SourceTicket source = tryCachedAppId(kPrimaryAppTicketSourceAppId);
        if (source.appId == 0) source = tryCachedAppId(kFallbackAppTicketSourceAppId);
        return source;
    }

    // Exploit steamdrmp's off-by-four ticket parsing vulnerability:
    static std::vector<uint8_t> ForgeLocalAppOwnershipTicket(AppId_t appId) {
        SourceTicket source = PickForgeSourceTicket();
        if (source.appId == 0) {
            LOG_DEBUG("ForgeLocalAppOwnershipTicket for AppId {}: no ticket for active Steam account", appId);
            return {};
        }

        const size_t signedSize = source.data.size() - kAppTicketSignatureSize;
        std::vector<uint8_t> ticket;
        ticket.reserve(source.data.size() + sizeof(AppId_t));
        ticket.insert(ticket.end(), source.data.begin(), source.data.begin() + signedSize);

        const uint8_t* appIdBytes = reinterpret_cast<const uint8_t*>(&appId);
        ticket.insert(ticket.end(), appIdBytes, appIdBytes + sizeof(AppId_t));
        ticket.insert(ticket.end(), source.data.begin() + signedSize, source.data.end());

        LOG_INFO("Forged App Ownership Ticket, AppId: {}, SourceAppId: {}, Physical Size: {}, Total Size: {}",
                 appId, source.appId, ticket.size(), source.data.size());
        return ticket;
    }

    bool GetAppOwnershipTicket(AppId_t appId, AppOwnershipTicket& ticket, AppTicketSource source) {
        ticket = {};
        
        if (source == AppTicketSource::CredentialStoreOnly || source == AppTicketSource::CredentialStoreThenForge) {
            ticket.data = GetAppOwnershipTicketFromCredentialStore(appId);
            if (!ticket.data.empty() && ticket.data.size() >= sizeof(uint32)) {
                ticket.totalSize = static_cast<uint32>(ticket.data.size());
                ticket.appIdOffset = kAppTicketAppIdOffset;
                ticket.steamIdOffset = kAppTicketSteamIdOffset;
                ticket.signatureOffset = *reinterpret_cast<const uint32*>(ticket.data.data());
                ticket.signatureSize = kAppTicketSignatureSize;
                return true;
            }
        }

        if (source == AppTicketSource::CredentialStoreOnly) return false;

        ticket.data = ForgeLocalAppOwnershipTicket(appId);
        if (ticket.data.empty()) return false;

        ticket.totalSize = static_cast<uint32>(ticket.data.size() - sizeof(AppId_t));
        ticket.appIdOffset = ticket.totalSize - kAppTicketSignatureSize;
        ticket.steamIdOffset = kAppTicketSteamIdOffset;
        ticket.signatureOffset = ticket.appIdOffset + sizeof(AppId_t);
        ticket.signatureSize = kAppTicketSignatureSize;
        return true;
    }

    std::vector<uint8_t> GetEncryptedTicketFromCredentialStore(AppId_t appId) {
        LOG_DEBUG("appid={}", appId);    
        // exclude those appids that are not in addappid
        if (!LuaConfig::HasDepot(appId)) {
            LOG_DEBUG("GetEncryptedTicketFromCredentialStore for AppId {}: not in addappid, skip", appId);
            return {};
        }
        std::vector<uint8_t> ticket;
        const auto status = OSTPlatform::SteamCredentialStore::GetETicket(appId, ticket);
        if (status != OSTPlatform::SteamCredentialStore::Status::Ok) {
            LOG_TRACE("Read Encrypted App Ticket for AppId {}: cached credential unavailable ({})",
                      appId, OSTPlatform::SteamCredentialStore::ToString(status));
            return {};
        }

        LOG_INFO("Successfully retrieved Encrypted App Ticket from credential store, AppId: {}, Ticket Size: {}", appId, ticket.size());
        return ticket;
    }

    bool WriteAppOwnershipTicket(AppId_t appId, const std::vector<uint8_t>& data) {
        // we can't execlude appids here 
        const auto status = OSTPlatform::SteamCredentialStore::WriteAppTicket(appId, data);
        if (status != OSTPlatform::SteamCredentialStore::Status::Ok) {
            LOG_ERROR("Failed to write AppTicket for AppId {} to credential store: {}",
                      appId, OSTPlatform::SteamCredentialStore::ToString(status));
            return false;
        }

        LOG_INFO("Wrote AppTicket for AppId {} ({} bytes)", appId, data.size());
        return true;
    }

    bool WriteEncryptedTicket(AppId_t appId, const std::vector<uint8_t>& data) {
        // we can't execlude appids here 
        const auto status = OSTPlatform::SteamCredentialStore::WriteETicket(appId, data);
        if (status != OSTPlatform::SteamCredentialStore::Status::Ok) {
            LOG_ERROR("Failed to write ETicket for AppId {} to credential store: {}",
                      appId, OSTPlatform::SteamCredentialStore::ToString(status));
            return false;
        }

        LOG_INFO("Wrote ETicket for AppId {} ({} bytes)", appId, data.size());
        return true;
    }

    bool WriteSteamID(AppId_t appId, uint64_t steamId) {
        const auto status = OSTPlatform::SteamCredentialStore::WriteSteamId(appId, steamId);
        if (status != OSTPlatform::SteamCredentialStore::Status::Ok) {
            LOG_ERROR("Failed to write SteamID for AppId {} to credential store: {}",
                      appId, OSTPlatform::SteamCredentialStore::ToString(status));
            return false;
        }

        LOG_INFO("Wrote SteamID for AppId {} ({})", appId, steamId);
        return true;
    }

    uint64_t GetSpoofSteamID(AppId_t appId) {
        // exclude those appids that are not in addappid
        if (!LuaConfig::HasDepot(appId)) {
            LOG_DEBUG("GetSpoofSteamID for AppId {}: not in addappid, skip spoofing", appId);
            return 0;
        }
        const uint64_t credentialSteamID = GetSteamIDFromCredentialStore(appId);
        if (credentialSteamID != 0) {
            return credentialSteamID;
        }

        // The SteamID baked into the cached AppOwnershipTicket is the same
        // one Steam itself uses for this app — pull it straight out of the
        // ticket so spoofed responses match what the DRM layer expects.
        // Layout: ticket bytes start with [uint32 Size][uint32 Version][uint64 SteamID][...].
        std::vector<uint8_t> ticket = GetAppOwnershipTicketFromCredentialStore(appId);
        if (ticket.size() >= kSteamIdTicketMinimumSize) {
            const uint64_t steamID = reinterpret_cast<const uint64_t*>(ticket.data())[1];
            LOG_DEBUG("GetSpoofSteamID for AppId {}: -> 0x{:X}({})", appId, steamID, steamID);
            return steamID;
        }
        return 0;
    }
}
