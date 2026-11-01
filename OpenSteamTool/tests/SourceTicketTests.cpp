#include "Utils/Tickets/SourceTicket.h"

#include <cstring>
#include <iostream>
#include <string>
#include <vector>

namespace {

std::vector<uint8_t> TicketForAccount(uint32_t accountId) {
    std::vector<uint8_t> ticket(192, 0x5a);
    const uint64_t steamId = 0x0110000100000000ull | accountId;
    std::memcpy(ticket.data() + 8, &steamId, sizeof(steamId));
    return ticket;
}

std::string Hex(const std::vector<uint8_t>& bytes) {
    constexpr char digits[] = "0123456789abcdef";
    std::string hex;
    hex.reserve(bytes.size() * 2);
    for (uint8_t byte : bytes) {
        hex.push_back(digits[byte >> 4]);
        hex.push_back(digits[byte & 15]);
    }
    return hex;
}

bool Check(bool condition, const char* description) {
    if (!condition) std::cerr << description << '\n';
    return condition;
}

} // namespace

int main() {
    const auto family = TicketForAccount(222);
    const auto owner = TicketForAccount(111);
    const std::string localConfig =
        "// An earlier comment may mention \"apptickets\".\n"
        "\"UserLocalConfigStore\" { \"apptickets\" {\n"
        "  // A family-shared ticket must not become the forge base.\n"
        "  \"10\" \"" + Hex(family) + "\"\n"
        "  \"20\" \"" + Hex(owner) + "\"\n"
        "} }";

    const auto selected = AppTicket::FindLocalConfigSourceTicket(localConfig, 111);
    if (!Check(selected.appId == 20 && selected.data == owner,
               "must select the active account's ticket after a family ticket")) return 1;

    const auto switched = AppTicket::FindLocalConfigSourceTicket(localConfig, 222);
    if (!Check(switched.appId == 10 && switched.data == family,
               "must select the ticket of a changed active account")) return 1;

    const std::string familyOnly = "\"apptickets\" { \"10\" \"" + Hex(family) + "\" }";
    if (!Check(AppTicket::FindLocalConfigSourceTicket(familyOnly, 111).appId == 0,
               "must reject a localconfig containing only another account's ticket")) return 1;
    if (!Check(!AppTicket::IsSourceTicketForAccount(family, 111) &&
                   AppTicket::IsSourceTicketForAccount(owner, 111),
               "cached fallback tickets must pass the same account check")) return 1;
    auto tooShort = owner;
    tooShort.resize(143);
    if (!Check(!AppTicket::IsSourceTicketForAccount(tooShort, 111),
               "ticket must have a complete SteamID before its signature")) return 1;

    const std::string malformed =
        "\"apptickets\" { \"bad-id\" \"" + Hex(owner) + "\" "
        "\"30\" \"xyz\" \"40\" \"00\" "
        "\"50\" \"" + Hex(owner) + "\" }";
    if (!Check(AppTicket::FindLocalConfigSourceTicket(malformed, 111).appId == 50,
               "must skip malformed candidates and use the next valid ticket")) return 1;

    return 0;
}
