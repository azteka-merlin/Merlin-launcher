const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeReleaseList } = require('../src/main/release-notes/release-notes-client');
const { createReleaseNotesService } = require('../src/main/release-notes/release-notes-service');
const { registerReleaseNotesIpc } = require('../src/main/ipc/register-release-notes-ipc');

const releaseFixture = {
    id: 1,
    version: '2.0.0',
    type: 'major',
    title: 'O MERLIN 2.0 CHEGOU',
    subtitle: 'Uma nova experiência, por dentro e por fora.',
    summary: 'Resumo',
    heroAssetUrl: '/release-assets/merlin-2.0.png',
    highlights: [{ icon: 'home', title: 'Nova Home', description: 'Descrição' }],
    fullContent: ['Nova Home']
};

test('normalizes release notes and resolves API asset paths', () => {
    const releases = normalizeReleaseList([releaseFixture], 'https://api-merlin.com/api/release-notes');
    assert.equal(releases.length, 1);
    assert.equal(releases[0].heroAssetUrl, 'https://api-merlin.com/release-assets/merlin-2.0.png');
    assert.equal(releases[0].type, 'major');
});

test('release notes state opens only the matching unseen launcher version', async () => {
    let state = { lastSeenChangelogVersion: '' };
    const service = createReleaseNotesService({
        authSession: { getAccessToken: async () => 'token' },
        client: { request: async () => normalizeReleaseList([releaseFixture]) },
        store: { save: (_locale, value) => value, load: () => null },
        configStore: { get: () => state, update: (patch) => { state = { ...state, ...patch }; } },
        baseUrl: 'https://api-merlin.com/api/release-notes',
        launcherVersion: '2.0.0'
    });
    const first = await service.get({ locale: 'ptbr' });
    assert.equal(first.shouldAutoOpen, true);
    assert.equal(first.hasUnread, true);
    assert.deepEqual(service.markSeen('2.0.0'), { success: true, lastSeenVersion: '2.0.0' });
    const second = await service.get({ locale: 'ptbr' });
    assert.equal(second.shouldAutoOpen, false);
    assert.equal(second.hasUnread, false);
});

test('release notes stay non-critical and use cache when the request fails', async () => {
    const cached = normalizeReleaseList([releaseFixture]);
    const service = createReleaseNotesService({
        authSession: { getAccessToken: async () => 'token' },
        client: { request: async () => { throw new Error('offline'); } },
        store: { save: (_locale, value) => value, load: () => cached },
        configStore: { get: () => ({ lastSeenChangelogVersion: '' }), update: () => {} },
        baseUrl: 'https://api-merlin.com/api/release-notes',
        launcherVersion: '2.0.0'
    });
    const result = await service.get({ locale: 'ptbr', force: true });
    assert.equal(result.success, true);
    assert.equal(result.stale, true);
    assert.equal(result.current.version, '2.0.0');
});

test('registers isolated release notes IPC handlers', () => {
    const channels = [];
    registerReleaseNotesIpc({
        ipcMain: { handle: (channel) => channels.push(channel) },
        releaseNotesService: {}
    });
    assert.deepEqual(channels, ['release-notes:get', 'release-notes:refresh', 'release-notes:mark-seen']);
});
