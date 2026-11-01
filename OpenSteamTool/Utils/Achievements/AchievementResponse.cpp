#include "Utils/Achievements/AchievementResponse.h"

#include "steam_messages.pb.h"

#include <cmath>
#include <unordered_map>
#include <unordered_set>

namespace AchievementResponse {

std::size_t RebuildUserAchievements(
    CPlayer_GetUserAchievements_Response& response,
    const Schema& schema,
    const GroupSchema& groups,
    const std::unordered_map<std::string, LocalAchievements::Unlock>& local)
{
    std::unordered_map<uint32_t, int> achievementByKey;
    for (int i = 0; i < response.achievements_size(); ++i) {
        const auto& achievement = response.achievements(i);
        if (achievement.has_internal_key())
            achievementByKey.emplace(achievement.internal_key(), i);
    }

    for (const auto& entry : schema) {
        auto found = achievementByKey.find(entry.key);
        if (found == achievementByKey.end()) {
            const int index = response.achievements_size();
            response.add_achievements()->set_internal_key(entry.key);
            found = achievementByKey.emplace(entry.key, index).first;
        }
        auto* achievement = response.mutable_achievements(found->second);

        const auto it = local.find(entry.name);
        if (it != local.end()) {
            if (it->second.unlocked) {
                achievement->set_unlocked(true);
                if (it->second.unlockTime != 0 &&
                    (!achievement->has_unlock_time() || achievement->unlock_time() == 0))
                    achievement->set_unlock_time(it->second.unlockTime);
            }
            const bool hasLocalInteger = it->second.hasIntegerProgress ||
                (it->second.hasFloatProgress && std::isfinite(it->second.progress) &&
                 static_cast<double>(it->second.progress) >= static_cast<double>(INT32_MIN) &&
                 static_cast<double>(it->second.progress) <= static_cast<double>(INT32_MAX));
            const int32_t localInteger = it->second.hasIntegerProgress
                ? it->second.integerProgress : static_cast<int32_t>(it->second.progress);
            const bool hasLocalFloat = it->second.hasFloatProgress || it->second.hasIntegerProgress;
            const float localFloat = it->second.hasFloatProgress
                ? it->second.progress : static_cast<float>(it->second.integerProgress);
            if (entry.progressType == ProgressType::Integer && hasLocalInteger) {
                if (!achievement->has_progress_int() || localInteger > achievement->progress_int())
                    achievement->set_progress_int(localInteger);
            } else if (entry.progressType == ProgressType::Float && hasLocalFloat &&
                       std::isfinite(localFloat)) {
                if (!achievement->has_progress_float() || localFloat > achievement->progress_float())
                    achievement->set_progress_float(localFloat);
            } else if (entry.progressType == ProgressType::Unknown) {
                if (it->second.hasIntegerProgress) {
                    if (!achievement->has_progress_int() ||
                        it->second.integerProgress > achievement->progress_int())
                        achievement->set_progress_int(it->second.integerProgress);
                } else if (hasLocalFloat && std::isfinite(localFloat) &&
                           (!achievement->has_progress_float() ||
                            localFloat > achievement->progress_float())) {
                    achievement->set_progress_float(localFloat);
                }
            }
        }
        if (entry.progressType == ProgressType::Integer && !achievement->has_progress_int()) {
            achievement->set_progress_int(0);
        } else if (entry.progressType == ProgressType::Float && !achievement->has_progress_float()) {
            achievement->set_progress_float(0.0f);
        } else if (entry.progressType == ProgressType::Unknown &&
                   !achievement->has_progress_int() && !achievement->has_progress_float()) {
            achievement->set_progress_float(0.0f);
        }
    }

    std::unordered_map<uint32_t, int> groupById;
    for (int i = 0; i < response.groups_size(); ++i) {
        const auto& group = response.groups(i);
        if (group.has_groupid()) groupById.emplace(group.groupid(), i);
    }
    std::vector<uint32_t> schemaGroupIds;
    std::unordered_set<uint32_t> seenGroups;
    const auto ensureGroup = [&](uint32_t groupId) {
        if (seenGroups.insert(groupId).second) schemaGroupIds.push_back(groupId);
        if (groupById.contains(groupId)) return;
        const int index = response.groups_size();
        auto* group = response.add_groups();
        group->set_groupid(groupId);
        group->set_is_achievable(true);
        groupById.emplace(groupId, index);
    };
    std::unordered_map<uint32_t, GroupSchemaEntry> groupMetadata;
    for (const auto& group : groups) {
        ensureGroup(group.id);
        groupMetadata.insert_or_assign(group.id, group);
    }

    struct GroupProgress {
        uint32_t total = 0;
        uint32_t unlocked = 0;
    };
    std::unordered_map<uint32_t, GroupProgress> progressByGroup;
    std::unordered_set<uint64_t> countedMemberships;
    for (const auto& entry : schema) {
        if (!entry.groupId) continue;
        const uint32_t groupId = *entry.groupId;
        ensureGroup(groupId);
        const uint64_t membership = (static_cast<uint64_t>(groupId) << 32) | entry.key;
        if (!countedMemberships.insert(membership).second) continue;
        auto& progress = progressByGroup[groupId];
        ++progress.total;
        const auto found = achievementByKey.find(entry.key);
        if (found != achievementByKey.end() &&
            response.achievements(found->second).unlocked()) ++progress.unlocked;
    }

    for (uint32_t groupId : schemaGroupIds) {
        auto* group = response.mutable_groups(groupById.at(groupId));
        const auto progress = progressByGroup[groupId];
        if (!group->has_completed_achievements() ||
            group->completed_achievements() < progress.unlocked)
            group->set_completed_achievements(progress.unlocked);
        uint32_t completionThreshold = progress.total;
        if (const auto metadata = groupMetadata.find(groupId); metadata != groupMetadata.end()) {
            if (metadata->second.completionAchievements)
                completionThreshold = *metadata->second.completionAchievements;
            else if (metadata->second.totalAchievements)
                completionThreshold = *metadata->second.totalAchievements;
        }
        if (completionThreshold != 0 && progress.unlocked >= completionThreshold &&
            !group->is_completed())
            group->set_is_completed(true);
    }

    std::size_t unlockedCount = 0;
    for (const auto& achievement : response.achievements())
        if (achievement.unlocked()) ++unlockedCount;
    return unlockedCount;
}

} // namespace AchievementResponse
