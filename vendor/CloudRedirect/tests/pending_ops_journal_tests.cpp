#include "pending_ops_journal.h"

#include <cstdio>
#include <filesystem>
#include <string>

namespace PJ = PendingOpsJournal;

static int g_failures = 0;

#define CHECK(cond)                                                        \
    do {                                                                   \
        if (!(cond)) {                                                     \
            std::printf("FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond);    \
            ++g_failures;                                                  \
        }                                                                  \
    } while (0)

namespace {

constexpr uint32_t kAccount = 4242;

PJ::Entry MakeSession(uint64_t clientId) {
    PJ::Entry e;
    e.operation = PJ::Operation::AppSessionActive;
    e.machineName = "TEST-MACHINE";
    e.clientId = clientId;
    e.timeLastUpdated = 1000;
    return e;
}

// Establishes an active session so RecordUploadBatchStart does not take its
// synthesized-session path.
void BeginSession(uint32_t appId, uint64_t clientId = 777) {
    PJ::RecordLaunchIntent(kAccount, appId, MakeSession(clientId), false);
}

bool HasOp(uint32_t appId, PJ::Operation op) {
    for (const auto& e : PJ::LoadPending(kAccount, appId)) {
        if (e.operation == op) return true;
    }
    return false;
}

// UploadInProgress is the mid-batch crash window. HasPendingUpload misses it,
// which is why HasInterruptedUpload exists.
void TestInProgressIsInterrupted() {
    const uint32_t appId = 1;
    BeginSession(appId);
    PJ::RecordUploadBatchStart(kAccount, appId);

    CHECK(HasOp(appId, PJ::Operation::UploadInProgress));
    CHECK(PJ::HasInterruptedUpload(kAccount, appId));
    CHECK(!PJ::HasPendingUpload(kAccount, appId));
}

void TestPendingIsInterrupted() {
    const uint32_t appId = 2;
    BeginSession(appId);
    PJ::RecordUploadBatchStart(kAccount, appId);
    PJ::RecordUploadBatchInterrupted(kAccount, appId);

    CHECK(HasOp(appId, PJ::Operation::UploadPending));
    CHECK(PJ::HasInterruptedUpload(kAccount, appId));
    CHECK(PJ::HasPendingUpload(kAccount, appId));
}

void TestNoMarkerWhenIdle() {
    const uint32_t appId = 3;
    BeginSession(appId);

    CHECK(!PJ::HasInterruptedUpload(kAccount, appId));
}

void TestLaunchIntentRetainsMarker() {
    const uint32_t appId = 4;
    BeginSession(appId);
    PJ::RecordUploadBatchStart(kAccount, appId);
    PJ::RecordUploadBatchInterrupted(kAccount, appId);
    CHECK(PJ::HasInterruptedUpload(kAccount, appId));

    auto returned = PJ::RecordLaunchIntent(kAccount, appId, MakeSession(888), false);

    CHECK(PJ::HasInterruptedUpload(kAccount, appId));

    bool reported = false;
    for (const auto& e : returned) {
        if (e.operation == PJ::Operation::UploadPending) reported = true;
    }
    CHECK(reported);
}

void TestLaunchIntentDropsMarkerWhenIgnoring() {
    const uint32_t appId = 5;
    BeginSession(appId);
    PJ::RecordUploadBatchStart(kAccount, appId);
    PJ::RecordUploadBatchInterrupted(kAccount, appId);
    CHECK(PJ::HasInterruptedUpload(kAccount, appId));

    PJ::RecordLaunchIntent(kAccount, appId, MakeSession(999), true);

    CHECK(!PJ::HasInterruptedUpload(kAccount, appId));
}

// A committed batch must clear UploadPending as well as UploadInProgress,
// otherwise the marker is sticky and pins the app to empty deltas forever.
void TestBatchEndClearsPending() {
    const uint32_t appId = 6;
    BeginSession(appId);
    PJ::RecordUploadBatchStart(kAccount, appId);
    PJ::RecordUploadBatchInterrupted(kAccount, appId);
    CHECK(HasOp(appId, PJ::Operation::UploadPending));

    PJ::RecordUploadBatchEnd(kAccount, appId);

    CHECK(!HasOp(appId, PJ::Operation::UploadPending));
    CHECK(!HasOp(appId, PJ::Operation::UploadInProgress));
    CHECK(!PJ::HasInterruptedUpload(kAccount, appId));
}

// End-to-end #211 timeline: crash mid-batch, relaunch, recover, resume clean.
void TestInterruptedBatchRecoveryCycle() {
    const uint32_t appId = 7;
    BeginSession(appId);
    PJ::RecordUploadBatchStart(kAccount, appId);

    // Process dies here; marker is on disk.
    CHECK(PJ::HasInterruptedUpload(kAccount, appId));

    // Relaunch must not erase it -- the changelist guard depends on it.
    PJ::RecordLaunchIntent(kAccount, appId, MakeSession(555), false);
    CHECK(PJ::HasInterruptedUpload(kAccount, appId));

    // Steam re-uploads and the batch commits.
    PJ::RecordUploadBatchStart(kAccount, appId);
    PJ::RecordUploadBatchEnd(kAccount, appId);

    // Normal sync resumes.
    CHECK(!PJ::HasInterruptedUpload(kAccount, appId));
}

// A failed publish must downgrade to UploadPending, not clear the marker.
void TestFailedPublishKeepsMarker() {
    const uint32_t appId = 8;
    BeginSession(appId);
    PJ::RecordUploadBatchStart(kAccount, appId);

    // All publish attempts exhausted.
    PJ::RecordUploadBatchInterrupted(kAccount, appId);

    CHECK(PJ::HasInterruptedUpload(kAccount, appId));
    CHECK(HasOp(appId, PJ::Operation::UploadPending));
    CHECK(!HasOp(appId, PJ::Operation::UploadInProgress));

    // Marker must still survive the next launch so the changelist guard sees it.
    PJ::RecordLaunchIntent(kAccount, appId, MakeSession(777), false);
    CHECK(PJ::HasInterruptedUpload(kAccount, appId));
}

} // namespace

int main() {
    auto root = std::filesystem::temp_directory_path() / "cr_pending_ops_tests";
    std::error_code ec;
    std::filesystem::remove_all(root, ec);
    std::filesystem::create_directories(root, ec);
    PJ::Init(root.string());

    TestInProgressIsInterrupted();
    TestPendingIsInterrupted();
    TestNoMarkerWhenIdle();
    TestLaunchIntentRetainsMarker();
    TestLaunchIntentDropsMarkerWhenIgnoring();
    TestBatchEndClearsPending();
    TestInterruptedBatchRecoveryCycle();
    TestFailedPublishKeepsMarker();

    std::filesystem::remove_all(root, ec);

    if (g_failures == 0) {
        std::printf("pending_ops_journal_tests: all tests passed\n");
        return 0;
    }
    std::printf("pending_ops_journal_tests: %d failure(s)\n", g_failures);
    return 1;
}
