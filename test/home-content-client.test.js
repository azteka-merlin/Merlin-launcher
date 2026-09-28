const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHomeContent } = require('../src/main/home/home-content-client');

function item(id, slotType, position) {
    return {
        id,
        slotType,
        position,
        appId: String(1000 + id),
        title: `Game ${id}`,
        imageUrl: `/api/home/items/${id}/image?v=1`,
        imagePositionX: 35,
        imagePositionY: 62,
        imageZoom: 1.45,
        primaryAction: slotType === 'hero' ? 'premium' : 'none',
        secondaryAction: slotType === 'hero' ? 'add_game' : 'none'
    };
}

test('normalizes persisted Home payload and resolves API image paths', () => {
    const home = normalizeHomeContent({
        hero: [item(1, 'hero', 1)],
        side: [item(2, 'side', 1), item(3, 'side', 2)],
        showcase: [item(4, 'showcase', 1), item(5, 'showcase', 2), item(6, 'showcase', 3), item(7, 'showcase', 4)],
        updatedAt: '2026-09-27T12:00:00.000Z'
    }, 'https://api-merlin.com/api/home');

    assert.equal(home.hero[0].imageUrl, 'https://api-merlin.com/api/home/items/1/image?v=1');
    assert.equal(home.hero[0].imagePositionX, 35);
    assert.equal(home.hero[0].imageZoom, 1.45);
    assert.equal(home.hero[0].primaryAction, 'premium');
    assert.equal(home.side.length, 2);
    assert.equal(home.showcase.length, 4);
    assert.equal(home.revision, '7:2026-09-27T12:00:00.000Z');
});

test('normalizes an invalid Home image zoom to the supported range', () => {
    const home = normalizeHomeContent({ hero: [{ ...item(1, 'hero', 1), imageZoom: 8 }], side: [], showcase: [] });
    assert.equal(home.hero[0].imageZoom, 4);
});

test('rejects Home payloads without an active hero slide', () => {
    assert.equal(normalizeHomeContent({ hero: [], side: [], showcase: [] }), null);
});

test('accepts inactive fixed slots while preserving their empty layout positions', () => {
    const home = normalizeHomeContent({ hero: [item(1, 'hero', 1)], side: [], showcase: [] });
    assert.equal(home.hero.length, 1);
    assert.deepEqual(home.side, []);
    assert.deepEqual(home.showcase, []);
});
