#pragma once

#include <cstdint>
#include <string_view>
#include <vector>

namespace AppTicket {

struct SourceTicket {
    uint32_t appId = 0;
    std::vector<uint8_t> data;
};

uint64_t ExtractSteamIdFromTicketBytes(const std::vector<uint8_t>& ticket);
bool IsSourceTicketForAccount(const std::vector<uint8_t>& ticket, uint32_t accountId);
SourceTicket FindLocalConfigSourceTicket(std::string_view localConfig, uint32_t accountId);

} // namespace AppTicket
