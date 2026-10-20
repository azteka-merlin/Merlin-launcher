const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '..', 'src/renderer/custom-games/custom-games.js'), 'utf8');

function element(tag = 'div') {
    const listeners = new Map();
    return {
        tag, hidden: false, value: '', textContent: '', style: {}, children: [], replacements: 0, disabled: false,
        classList: { add() {}, remove() {}, toggle() {} },
        addEventListener(name, handler) { listeners.set(name, handler); },
        click() { if (!this.disabled) return listeners.get('click')?.({ target: this }); },
        setAttribute() {},
        replaceChildren(...children) { this.children = children; this.replacements++; },
        append(...children) { this.children.push(...children); },
        querySelector() { return this.span ||= element('span'); },
        querySelectorAll() { return []; },
    };
}

function renderer(options = {}) {
    const nodes = new Map();
    const events = new Map();
    const frames = new Map();
    const translations = { ptbr: {}, en: {}, es: {}, fr: {}, de: {} };
    const viewCalls = [];
    let nextFrame = 0;
    let language = 'ptbr';
    let progressListener;
    let imageCreates = 0;
    const get = id => {
        if (!nodes.has(id)) nodes.set(id, element());
        return nodes.get(id);
    };
    const document = {
        getElementById: get,
        addEventListener(name, handler) { events.set(`document:${name}`, handler); },
        createElement(tag) { if (tag === 'img') imageCreates++; return element(tag); },
    };
    const window = {
        electronAPI: { auth: { async status() { return { authenticated: true, license: { status: 'active', planTier: 'ouro' } }; } }, customGames: {
            onProgress(callback) { progressListener = callback; },
            async list() { return options.list ? options.list() : { success: true, games: [
                { id: 'one', name: 'Game One', archiveSize: 100, imageUrl: 'image-1.png' },
                { id: 'two', name: 'Game Two', archiveSize: 100, imageUrl: 'image-2.png' },
            ], drives: [] }; },
            async uninstall(id) { return options.uninstall ? options.uninstall(id) : { success: true }; },
            async verify(id) { return options.verify ? options.verify(id) : { success: true, healthy: true, totalFiles: 3 }; },
            async update(id) { return options.update ? options.update(id) : { success: true }; },
            async repair(id) { return options.repair ? options.repair(id) : { success: true, updatedFiles: 1, protectedFiles: 0 }; },
        } },
        merlinI18n: { t: key => translations[language][key], current: () => language },
        merlinView: { set(view) { viewCalls.push(view); } },
        addEventListener(name, handler) { events.set(name, handler); },
        requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
        cancelAnimationFrame(id) { frames.delete(id); },
    };
    vm.runInNewContext(script, { window, document, translations });
    events.get('document:DOMContentLoaded')();
    get('customGamesView').hidden = true;
    return { get, events, frames, translations, viewCalls,
        progress: state => progressListener(state),
        flush() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); },
        imageCreates: () => imageCreates,
        language(value) { language = value; events.get('merlin-language-changed')(); },
        async open() {
            events.get('merlin-entitlement-changed')({ detail: { authenticated: true, expired: false, planTier: 'ouro' } });
            events.get('merlin-view-changed')({ detail: { view: 'custom-games' } });
            await new Promise(resolve => setImmediate(resolve));
        },
        entitlement(detail) { events.get('merlin-entitlement-changed')({ detail }); },
        navigate(view) { events.get('merlin-view-changed')({ detail: { view } }); },
        hide() { events.get('merlin-view-changed')({ detail: { view: 'home' } }); },
    };
}

const MiB = 1024 ** 2;
const downloading = overrides => ({ id: 'one', name: 'Game One', stage: 'downloading',
    received: 20 * MiB, total: 100 * MiB, speedBytesPerSecond: MiB, etaSeconds: 80, ...overrides });

test('Baixe e Jogue stays hidden and blocks navigation without active Gold entitlement', () => {
    const ui = renderer();
    assert.equal(ui.get('customGamesBtn').hidden, true);
    ui.navigate('custom-games');
    assert.deepEqual(ui.viewCalls, ['home']);
    ui.entitlement({ authenticated: true, expired: false, planTier: 'prata' });
    assert.equal(ui.get('customGamesBtn').hidden, true);
    ui.get('customGamesBtn').click();
    assert.deepEqual(ui.viewCalls, ['home']);
    ui.entitlement({ authenticated: true, expired: false, planTier: 'ouro' });
    assert.equal(ui.get('customGamesBtn').hidden, false);
    ui.entitlement({ authenticated: true, expired: true, planTier: 'ouro' });
    assert.equal(ui.get('customGamesBtn').hidden, true);
});

test('progress bursts coalesce and repeated frames retain game card/image elements', async () => {
    const ui = renderer();
    await ui.open();
    for (let index = 0; index < 50; index++) ui.progress(downloading({ received: index * MiB }));
    assert.equal(ui.frames.size, 1);
    ui.flush();
    const rebuilds = ui.get('customGamesGrid').replacements;
    const images = ui.imageCreates();
    const firstCard = ui.get('customGamesGrid').children[0];
    for (let index = 0; index < 20; index++) { ui.progress(downloading({ received: (50 + index) * MiB })); ui.flush(); }
    assert.equal(ui.get('customGamesGrid').replacements, rebuilds);
    assert.equal(ui.imageCreates(), images);
    assert.equal(ui.get('customGamesGrid').children[0], firstCard);
    assert.match(ui.get('customGamesProgressDetail').textContent, /69\.0 MB/);
});

test('hidden catalog remains untouched and refreshes controls once after terminal state', async () => {
    const ui = renderer();
    await ui.open();
    ui.progress(downloading()); ui.flush();
    ui.hide();
    const rebuilds = ui.get('customGamesGrid').replacements;
    const images = ui.imageCreates();
    ui.progress(downloading({ received: 70 * MiB })); ui.flush();
    ui.progress({ id: 'one', name: 'Game One', stage: 'completed' });
    assert.equal(ui.get('customGamesGrid').replacements, rebuilds);
    assert.equal(ui.imageCreates(), images);
    await ui.open();
    assert.equal(ui.get('customGamesGrid').replacements, rebuilds + 1);
});

test('terminal progress is immediate and discards the previous pending animation frame', () => {
    const ui = renderer();
    ui.progress(downloading());
    assert.equal(ui.frames.size, 1);
    ui.progress({ id: 'one', name: 'Game One', stage: 'cancelled' });
    assert.equal(ui.frames.size, 0);
    assert.equal(ui.get('customGamesProgressTitle').textContent, 'Download cancelado');
    assert.equal(ui.get('customGamesProgressCancel').hidden, true);
    ui.flush();
    assert.equal(ui.get('customGamesProgressTitle').textContent, 'Download cancelado');
});

test('extraction uses global installed totals and remaining files across all packages', () => {
    const ui = renderer();
    ui.progress({ id: 'one', name: 'Game One', stage: 'extracting',
        files: 2, totalFiles: 3, bytes: 2 * MiB, totalBytes: 3 * MiB,
        installedFiles: 7, totalInstallFiles: 12, extractedBytes: 20 * MiB, extractionTotalBytes: 100 * MiB,
        extractionSpeedBytesPerSecond: MiB, extractionEtaSeconds: 80 });
    ui.flush();
    assert.match(ui.get('customGamesProgressDetail').textContent, /7 de 12 arquivos prontos · 5 restantes/);
    assert.equal(ui.get('customGamesProgressBar').style.width, '20%');
    assert.match(ui.get('customGamesProgressRate').textContent, /Restante da extração: 00:01:20/);
    assert.equal(ui.get('customGamesWidgetDetail').title, ui.get('customGamesProgressDetail').textContent);
});

test('overlapping network/extraction estimates and file totals translate in all five languages', () => {
    const ui = renderer();
    ui.progress(downloading({ installedFiles: 8, totalInstallFiles: 12,
        extractedBytes: 20 * MiB, extractionTotalBytes: 100 * MiB,
        extractionSpeedBytesPerSecond: MiB, extractionEtaSeconds: 80 }));
    ui.flush();
    for (const language of ['ptbr', 'en', 'es', 'fr', 'de']) {
        ui.language(language);
        const rate = ui.get('customGamesProgressRate').textContent;
        const detail = ui.get('customGamesProgressDetail').textContent;
        const expectedNetwork = ui.translations[language].custom_games_network_eta.split('{speed}')[0];
        const expectedExtraction = ui.translations[language].custom_games_extraction_eta.split('{speed}')[0];
        assert.ok(rate.includes(expectedNetwork));
        assert.ok(rate.includes(expectedExtraction));
        assert.ok(detail.includes('8') && detail.includes('12') && detail.includes('4'));
        assert.doesNotMatch(rate + detail, /undefined|\{[a-z]+\}/);
    }
});

test('cancelling uninstall confirmation clears the target and leaves the dialog reusable', async () => {
    const ui = renderer({ list: async () => ({ success: true, games: [
        { id: 'installed', name: 'Installed Game', installed: true },
    ], drives: [] }) });
    await ui.open();
    const uninstallButton = ui.get('customGamesGrid').children[0].children[3].children[1];
    uninstallButton.click();
    assert.equal(ui.get('customGamesUninstallModal').hidden, false);
    ui.get('customGamesUninstallCancel').click();
    assert.equal(ui.get('customGamesUninstallModal').hidden, true);
    assert.equal(ui.get('customGamesUninstallConfirm').disabled, false);
    uninstallButton.click();
    assert.equal(ui.get('customGamesUninstallModal').hidden, false);
});

test('successful uninstall unlocks its dialog before a slow catalog refresh completes', async () => {
    let listCalls = 0;
    let finishRefresh;
    const ui = renderer({
        list: async () => {
            listCalls++;
            if (listCalls === 1) return { success: true, games: [
                { id: 'installed', name: 'Installed Game', installed: true },
            ], drives: [] };
            return new Promise(resolve => { finishRefresh = resolve; });
        },
        uninstall: async () => ({ success: true }),
    });
    await ui.open();
    ui.get('customGamesGrid').children[0].children[3].children[1].click();
    await ui.get('customGamesUninstallConfirm').click();
    assert.equal(ui.get('customGamesUninstallModal').hidden, true);
    assert.equal(ui.get('customGamesUninstallConfirm').disabled, false);
    assert.equal(ui.get('customGamesUninstallCancel').disabled, false);
    finishRefresh({ success: true, games: [], drives: [] });
});

test('integrity actions show a verification result and safe paths without installation success messaging', async () => {
    let verified;
    const ui = renderer({ list: async () => ({ success: true, games: [
        { id: 'installed', name: 'Installed Game', installed: true },
    ], drives: [] }), verify: async id => {
        verified = id;
        return { success: true, healthy: false, totalFiles: 3, missingFiles: 1, corruptFiles: 1, unreadableFiles: 0,
            issues: [{ path: '<script>.exe', reason: 'missing' }] };
    } });
    await ui.open();
    const verify = ui.get('customGamesGrid').children[0].children[3].children[2];
    assert.equal(verify.textContent, 'Verificar integridade');
    await verify.click();
    assert.equal(verified, 'installed');
    assert.equal(ui.get('customGamesProgressTitle').textContent, 'Verificação concluída');
    assert.match(ui.get('customGamesProgressDetail').textContent, /1 ausentes · 1 alterados · 0 sem acesso/);
    assert.match(ui.get('customGamesProgressDetail').textContent, /<script>\.exe/);
    assert.equal(ui.get('customGamesProgressDetail').style.whiteSpace, 'pre-line');
    assert.equal(ui.get('customGamesProgressCancel').hidden, true);
});

test('new versions expose Update and show update progress distinct from installation', async () => {
    let updated;
    const ui = renderer({ list: async () => ({ success: true, games: [
        { id: 'installed', name: 'Installed Game', installed: true, updateAvailable: true },
    ], drives: [] }), update: async id => { updated = id; return { success: true }; } });
    await ui.open();
    const update = ui.get('customGamesGrid').children[0].children[3].children[3];
    assert.equal(update.textContent, 'Atualizar jogo');
    await update.click();
    assert.equal(updated, 'installed');
    assert.equal(ui.get('customGamesProgressTitle').textContent, 'Jogo atualizado');
    ui.progress({ id: 'installed', name: 'Installed Game', kind: 'update', stage: 'applying', files: 2, totalFiles: 4 });
    ui.flush();
    assert.equal(ui.get('customGamesProgressTitle').textContent, 'Aplicando atualização');
    assert.equal(ui.get('customGamesProgressBar').style.width, '50%');
});

test('integrity problems expose explicit Repair only after verification and keep repair feedback separate', async () => {
    let repairs = 0;
    const ui = renderer({ list: async () => ({ success: true, games: [
        { id: 'installed', name: 'Installed Game', installed: true },
    ], drives: [] }), repair: async () => { repairs++; return { success: true, updatedFiles: 2, protectedFiles: 1 }; } });
    await ui.open();
    ui.progress({ id: 'installed', kind: 'integrity', stage: 'completed', healthy: false, corruptFiles: 2, totalFiles: 3 });
    assert.equal(repairs, 0);
    assert.equal(ui.get('customGamesProgressRepair').hidden, false);
    await ui.get('customGamesProgressRepair').click();
    assert.equal(repairs, 1);
    assert.equal(ui.get('customGamesProgressRepair').hidden, true);
    assert.equal(ui.get('customGamesProgressTitle').textContent, 'Reparo concluído');
    assert.match(ui.get('customGamesProgressDetail').textContent, /2 arquivos restaurados · 1 arquivos protegidos preservados/);
});
