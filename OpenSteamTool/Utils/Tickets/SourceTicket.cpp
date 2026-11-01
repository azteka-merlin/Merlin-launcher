#include "SourceTicket.h"
#include "AppTicket.h"

#include <charconv>
#include <cctype>
#include <cstring>
#include <utility>

namespace AppTicket {
namespace {

constexpr size_t kSteamIdTicketMinimumSize = 16;

void SkipTrivia(std::string_view text, size_t& pos) {
    const size_t end = text.size();
    while (pos < end) {
        const unsigned char ch = static_cast<unsigned char>(text[pos]);
        if (std::isspace(ch)) {
            ++pos;
            continue;
        }
        if (text[pos] == '/' && pos + 1 < end && text[pos + 1] == '/') {
            const size_t newline = text.find('\n', pos + 2);
            pos = newline == std::string_view::npos ? end : newline + 1;
            continue;
        }
        break;
    }
}

bool ReadQuoted(std::string_view text, size_t& pos, std::string_view& value) {
    SkipTrivia(text, pos);
    if (pos >= text.size() || text[pos] != '"') return false;
    const size_t close = text.find('"', pos + 1);
    if (close == std::string_view::npos) return false;
    value = text.substr(pos + 1, close - pos - 1);
    pos = close + 1;
    return true;
}

size_t FindAppTicketsOpen(std::string_view text) {
    size_t pos = 0;
    while (pos < text.size()) {
        SkipTrivia(text, pos);
        if (pos >= text.size()) break;
        if (text[pos] != '"') {
            ++pos;
            continue;
        }
        std::string_view token;
        if (!ReadQuoted(text, pos, token)) break;
        if (token != "apptickets") continue;
        SkipTrivia(text, pos);
        if (pos < text.size() && text[pos] == '{') return pos;
    }
    return std::string_view::npos;
}

int HexDigit(char ch) {
    if (ch >= '0' && ch <= '9') return ch - '0';
    if (ch >= 'a' && ch <= 'f') return ch - 'a' + 10;
    if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
    return -1;
}

} // namespace

uint64_t ExtractSteamIdFromTicketBytes(const std::vector<uint8_t>& ticket) {
    if (ticket.size() < kSteamIdTicketMinimumSize) return 0;
    uint64_t steamId = 0;
    std::memcpy(&steamId, ticket.data() + 8, sizeof(steamId));
    return steamId;
}

bool IsSourceTicketForAccount(const std::vector<uint8_t>& ticket, uint32_t accountId) {
    return accountId != 0 && ticket.size() >= kAppTicketAppIdOffset + kAppTicketSignatureSize &&
           static_cast<uint32_t>(ExtractSteamIdFromTicketBytes(ticket)) == accountId;
}

SourceTicket FindLocalConfigSourceTicket(std::string_view localConfig, uint32_t accountId) {
    if (accountId == 0) return {};

    const size_t open = FindAppTicketsOpen(localConfig);
    if (open == std::string_view::npos) return {};

    size_t pos = open + 1;
    std::string_view key;
    std::string_view hex;
    while (ReadQuoted(localConfig, pos, key) && ReadQuoted(localConfig, pos, hex)) {
        uint32_t appId = 0;
        const auto parsed = std::from_chars(key.data(), key.data() + key.size(), appId);
        if (key.empty() || parsed.ec != std::errc{} || parsed.ptr != key.data() + key.size() || appId == 0 ||
            hex.size() % 2 != 0 || hex.size() / 2 < kAppTicketAppIdOffset + kAppTicketSignatureSize) {
            continue;
        }

        std::vector<uint8_t> bytes;
        bytes.reserve(hex.size() / 2);
        bool validHex = true;
        for (size_t i = 0; i < hex.size(); i += 2) {
            const int high = HexDigit(hex[i]);
            const int low = HexDigit(hex[i + 1]);
            if (high < 0 || low < 0) {
                validHex = false;
                break;
            }
            bytes.push_back(static_cast<uint8_t>((high << 4) | low));
        }
        if (validHex && IsSourceTicketForAccount(bytes, accountId)) {
            return {appId, std::move(bytes)};
        }
    }
    return {};
}

} // namespace AppTicket
