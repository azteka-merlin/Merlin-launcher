#include "Utils/Achievements/AchievementResponse.h"

#include "steam_messages.pb.h"

#include <cmath>
#include <iostream>
#include <string>
#include <unordered_map>
#include <vector>

namespace {

bool Check(bool condition, const char* description) {
    if (!condition) std::cerr << description << '\n';
    return condition;
}

bool Near(float actual, float expected) {
    return std::fabs(actual - expected) < 0.0001f;
}

} // namespace

int main() {
    CPlayer_GetUserAchievements_Response response;
    response.set_schema_version(12);
    response.set_schema_hash(0x12345678);
    auto* remoteWin = response.add_achievements();
    remoteWin->set_internal_key(42);
    remoteWin->set_unlocked(true);
    remoteWin->set_unlock_time(1700000000);
    remoteWin->set_progress_float(0.8f);
    auto* unrelated = response.add_achievements();
    unrelated->set_internal_key(999);
    unrelated->set_unlocked(true);
    unrelated->set_progress_int(5);
    auto* existingGroup = response.add_groups();
    existingGroup->set_groupid(7);
    existingGroup->set_is_achievable(true);
    existingGroup->set_completed_achievements(2);
    existingGroup->set_is_completed(true);
    existingGroup->set_time_completed(1690000000);
    auto* unrelatedGroup = response.add_groups();
    unrelatedGroup->set_groupid(99);
    unrelatedGroup->set_is_achievable(false);

    const AchievementResponse::Schema schema{
        {42, "ACH_WIN", 7, AchievementResponse::ProgressType::Float},
        {43, "ACH_WAIT", 8, AchievementResponse::ProgressType::Float},
    };
    const AchievementResponse::GroupSchema groups{{7, 1, 1}, {8, 1, 1}};
    const std::unordered_map<std::string, LocalAchievements::Unlock> local{
        {"ACH_WIN", {true, 1710000000, 0.75f, 0, false, true}},
        {"ACH_WAIT", {false, 0, 0.25f, 0, false, true}},
    };

    const auto unlocked = AchievementResponse::RebuildUserAchievements(
        response, schema, groups, local);

    if (!Check(unlocked == 2, "must count remote and local unlocks")) return 1;
    if (!Check(response.achievements_size() == 3 && response.groups_size() == 3,
               "must preserve original entries and add missing schema entries")) return 1;
    if (!Check(response.has_schema_version() && response.schema_version() == 12 &&
                   response.has_schema_hash() && response.schema_hash() == 0x12345678,
               "must preserve schema version and hash")) return 1;

    const auto& won = response.achievements(0);
    if (!Check(won.internal_key() == 42 && won.unlocked() &&
                   won.has_unlock_time() && won.unlock_time() == 1700000000 &&
                   won.has_progress_float() && Near(won.progress_float(), 0.8f),
               "less informative local state must preserve remote time and progress")) return 1;

    const auto& extra = response.achievements(1);
    if (!Check(extra.internal_key() == 999 && extra.unlocked() &&
                   extra.has_progress_int() && extra.progress_int() == 5,
               "achievement outside public schema must remain intact")) return 1;

    const auto& locked = response.achievements(2);
    if (!Check(locked.internal_key() == 43 && !locked.has_unlocked() &&
                   !locked.has_unlock_time() && locked.has_progress_float() &&
                   Near(locked.progress_float(), 0.25f),
               "locked achievement must carry progress without unlock fields")) return 1;

    const auto& group = response.groups(0);
    if (!Check(group.groupid() == 7 && group.is_achievable() &&
                   group.completed_achievements() == 2 && group.is_completed() &&
                   group.time_completed() == 1690000000,
               "existing group fields must remain intact")) return 1;
    if (!Check(response.groups(1).groupid() == 99 && !response.groups(1).is_achievable() &&
                   response.groups(2).groupid() == 8 && response.groups(2).is_achievable(),
               "unrelated group must remain and missing group must be added")) return 1;

    CPlayer_GetUserAchievements_Response roundTrip;
    if (!Check(roundTrip.ParseFromString(response.SerializeAsString()) &&
                   roundTrip.groups(0).has_completed_achievements() &&
                   roundTrip.groups(0).completed_achievements() == 2 &&
                   roundTrip.groups(0).has_is_completed() &&
                   roundTrip.groups(0).is_completed() &&
                   roundTrip.groups(0).has_time_completed() &&
                   roundTrip.groups(0).time_completed() == 1690000000,
               "group completion fields must survive serialization")) return 1;

    const std::unordered_map<std::string, LocalAchievements::Unlock> strongerLocal{
        {"ACH_WIN", {true, 1710000000, 0.9f, 0, false, true}},
        {"ACH_WAIT", {true, 1710000100, 0.4f, 0, false, true}},
    };
    const auto upgraded = AchievementResponse::RebuildUserAchievements(
        response, schema, groups, strongerLocal);
    if (!Check(upgraded == 3 && response.achievements_size() == 3 &&
                   response.groups_size() == 3 &&
                   response.achievements(0).unlock_time() == 1700000000 &&
                   Near(response.achievements(0).progress_float(), 0.9f) &&
                   response.achievements(2).unlocked() &&
                   response.achievements(2).unlock_time() == 1710000100 &&
                   Near(response.achievements(2).progress_float(), 0.4f),
               "positive local unlock and greater progress must augment response")) return 1;

    AchievementResponse::RebuildUserAchievements(response, schema, groups, local);
    if (!Check(response.achievements(2).unlocked() &&
                   response.achievements(2).unlock_time() == 1710000100 &&
                   Near(response.achievements(2).progress_float(), 0.4f),
               "locked local state must not reverse a prior unlock")) return 1;

    const std::unordered_map<std::string, LocalAchievements::Unlock> emptyLocal;
    const auto noUnlocks = AchievementResponse::RebuildUserAchievements(
        response, schema, groups, emptyLocal);
    if (!Check(noUnlocks == 3 && response.achievements(2).unlocked() &&
                   response.achievements(2).unlock_time() == 1710000100 &&
                   Near(response.achievements(2).progress_float(), 0.4f),
               "missing local state must not roll back remote unlocks")) return 1;

    CPlayer_GetUserAchievements_Response integerProgress;
    auto* integerEntry = integerProgress.add_achievements();
    integerEntry->set_internal_key(43);
    integerEntry->set_progress_int(4);
    const AchievementResponse::Schema integerSchema{
        {43, "ACH_WAIT", 8, AchievementResponse::ProgressType::Integer},
    };
    AchievementResponse::RebuildUserAchievements(integerProgress, integerSchema, groups, local);
    if (!Check(integerProgress.achievements(0).has_progress_int() &&
                   integerProgress.achievements(0).progress_int() == 4 &&
                   !integerProgress.achievements(0).has_progress_float(),
               "local float must not mask existing integer progress")) return 1;

    return 0;
}
