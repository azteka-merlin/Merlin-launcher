#pragma once

#include "Utils/Achievements/LocalAchievements.h"

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

class CPlayer_GetUserAchievements_Response;

namespace AchievementResponse {

enum class ProgressType { Unknown, Integer, Float };

struct SchemaEntry {
    uint32_t key;
    std::string name;
    std::optional<uint32_t> groupId;
    ProgressType progressType = ProgressType::Unknown;
};
using Schema = std::vector<SchemaEntry>;

struct GroupSchemaEntry {
    uint32_t id;
    std::optional<uint32_t> totalAchievements;
    std::optional<uint32_t> completionAchievements;
};
using GroupSchema = std::vector<GroupSchemaEntry>;

// Merge the public schema and local unlocks into a Steam user-achievements
// reply. Local unlocks may raise group completion counts and mark fully
// unlocked groups complete; larger remote counts and completion times remain
// intact. Returns the number of unlocked entries in the merged reply.
std::size_t RebuildUserAchievements(
    CPlayer_GetUserAchievements_Response& response,
    const Schema& schema,
    const GroupSchema& groups,
    const std::unordered_map<std::string, LocalAchievements::Unlock>& local);

} // namespace AchievementResponse
