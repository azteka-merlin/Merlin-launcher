const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/renderer/library/library.js'), 'utf8');

function harness(list) {
    const nodes = new Map(), listeners = new Map(), requestedImages = [], coverSources = [];
    function element(tag = 'div') {
        const events = new Map();
        return { tag, hidden: true, disabled: false, value: '', textContent: '', children: [], dataset: {},
            classList: { add() {}, remove() {}, toggle() {} },
            append(...items) { this.children.push(...items); },
            replaceChildren(...items) { this.children = items; },
            replaceWith(item) { this.replacedWith = item; },
            setAttribute() {}, focus() {},
            addEventListener(name, callback) { events.set(name, callback); },
            emit(name) { return events.get(name)?.({}); },
            set src(url) { this.imageUrl = url; requestedImages.push(url); },
            get src() { return this.imageUrl; }
        };
    }
    const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
    let view = '', onUpdated;
    const window = {
        merlinGameCovers: {
            url: id => `https://generator.ryuu.lol/files/images/${id}.jpg`,
            load(image,id,source) { coverSources.push(source); image.src=`file:///cache/${id}.jpg`; }
        },
        electronAPI: { library: { list, onUpdated(callback) { onUpdated = callback; } } },
        merlinI18n: { register() {}, t: key => key },
        libraryModel: { filterItems: items => items, paginate: items => ({ visible: items, totalPages: 1, currentPage: 1 }) },
        merlinView: { get: () => view, set(value) { view = value; listeners.get('merlin-view-changed')(); } },
        addEventListener(name, callback) { listeners.set(name, callback); }
    };
    const document = { getElementById: get, querySelector: get, createElement: element,
        addEventListener(name, callback) { listeners.set(`document:${name}`, callback); } };
    vm.runInNewContext(source, { window, document, URL, setTimeout: fn => fn() });
    listeners.get('document:DOMContentLoaded')();
    window.merlinView.set('library');
    return { get, requestedImages, coverSources, update: items => onUpdated(items),
        cover: () => get('libraryTableBody').children[0].children[0].children[0].children[0],
        name: () => get('libraryTableBody').children[0].children[0].children[0].children[1].textContent };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('library photos use the shared local loader and show a placeholder on failure', async () => {
    const ui = harness(async () => ({ success: true, items: [{ appId: '10', gameName: 'Game',
        coverUrl: 'https://generator.ryuu.lol/files/images/10.jpg' }] }));
    await settle();
    assert.equal(ui.cover().src, 'file:///cache/10.jpg');
    assert.deepEqual(ui.coverSources, ['https://generator.ryuu.lol/files/images/10.jpg']);
    ui.cover().emit('error');
    assert.equal(ui.cover().replacedWith.tag, 'div');
    assert.equal(ui.requestedImages.some(url => url.includes('ryuu.lol')), false);
});

test('an old external photo is delegated to the main process and never fetched directly by the renderer', async () => {
    const ui = harness(async () => ({ success: true, items: [{ appId: '20', gameName: 'Game', coverUrl: 'https://example.test/broken.jpg' }] }));
    await settle(); ui.cover().emit('error');
    assert.equal(ui.cover().src, 'file:///cache/20.jpg');
    assert.deepEqual(ui.coverSources, ['https://example.test/broken.jpg']);
    assert.equal(ui.cover().replacedWith.tag, 'div');
    assert.equal(ui.requestedImages.length, 1);
});

test('a late initial list response cannot overwrite metadata already delivered by IPC', async () => {
    let finish;
    const ui = harness(() => new Promise(resolve => { finish = resolve; }));
    ui.update([{ appId: '10', gameName: 'New name', coverUrl: null }]);
    assert.equal(ui.name(), 'New name');
    finish({ success: true, items: [{ appId: '10', gameName: 'Old name', coverUrl: null }] });
    await settle(); assert.equal(ui.name(), 'New name');
});
