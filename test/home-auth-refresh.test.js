const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/renderer/shared/home-carousel.js'), 'utf8');

function fakeElement() {
    const classes = new Set();
    return {
        hidden: false,
        dataset: {},
        style: { setProperty() {} },
        classList: {
            add: name => classes.add(name),
            remove: name => classes.delete(name),
            contains: name => classes.has(name),
            toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
        },
        addEventListener() {},
        setAttribute() {},
        replaceChildren() {},
        appendChild() {},
        querySelector() { return fakeElement(); },
        contains() { return false; }
    };
}

function setupHome(request) {
    const events = new Map();
    const view = fakeElement();
    const carousel = fakeElement();
    const frame = fakeElement();
    const side = fakeElement();
    const showcase = fakeElement();
    const layers = [fakeElement(), fakeElement()];
    const loadState = fakeElement();
    loadState.hidden = true;
    view.querySelector = selector => selector === '.home-featured-stack' ? side : showcase;
    carousel.closest = () => frame;
    carousel.querySelectorAll = () => layers;
    const elements = new Map([
        ['homeView', view], ['homeCarousel', carousel], ['homeLoadState', loadState]
    ]);
    const document = {
        hidden: false,
        getElementById: id => {
            if (!elements.has(id)) elements.set(id, fakeElement());
            return elements.get(id);
        },
        createElement: () => fakeElement(),
        addEventListener: (name, handler) => events.set(`document:${name}`, handler)
    };
    const window = {
        electronAPI: { home: { get: request, checkForUpdate: async () => ({ success: true, changed: false }) } },
        matchMedia: () => ({ matches: true }),
        setTimeout: callback => { callback(); return 1; },
        clearTimeout() {},
        setInterval() { return 1; },
        clearInterval() {},
        addEventListener: (name, handler) => events.set(name, handler)
    };
    vm.runInNewContext(source, { window, document, Image: class {} });
    events.get('document:DOMContentLoaded')();
    return { events, loadState };
}

function homeResult(stale) {
    return {
        success: true,
        stale,
        home: {
            hero: [{ title: 'Test game', imageUrl: '', imagePositionX: 50, imagePositionY: 50, imageZoom: 1, primaryAction: 'none', secondaryAction: 'none' }],
            side: [],
            showcase: []
        }
    };
}

async function drain() {
    await new Promise(resolve => setImmediate(resolve));
}

test('retries a cached Home after authentication completes', async () => {
    const calls = [];
    const { events, loadState } = setupHome(async options => {
        calls.push(options);
        return homeResult(calls.length === 1);
    });
    await drain();
    assert.equal(loadState.hidden, false);

    events.get('merlin-authenticated')();
    await drain();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].force, true);
    assert.equal(loadState.hidden, true);
});

test('retries after a pending first load becomes stale, without duplicating a healthy load', async () => {
    const calls = [];
    let completeFirst;
    const first = new Promise(resolve => { completeFirst = resolve; });
    const { events, loadState } = setupHome(options => {
        calls.push(options);
        return calls.length === 1 ? first : Promise.resolve(homeResult(false));
    });

    events.get('merlin-authenticated')();
    completeFirst(homeResult(true));
    await drain();
    assert.equal(calls.length, 2);
    assert.equal(calls[1].force, true);
    assert.equal(loadState.hidden, true);

    events.get('merlin-authenticated')();
    await drain();
    assert.equal(calls.length, 2);
});
