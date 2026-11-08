const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function harness(load = async id => ({url:`file:///cache/${id}.jpg`})) {
    const timers = new Map(), observers = new Map(), calls = [];
    let removed;
    let next = 0;
    const window = { electronAPI: { gameCovers: { load: (...args) => { calls.push(args); return load(...args); } } } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/renderer/shared/game-covers.js'), 'utf8'), {
        window, Event, document:{documentElement:{}},
        MutationObserver:class { constructor(callback){removed=callback;} observe(){} },
        IntersectionObserver: class {
            constructor(callback) { this.callback = callback; }
            observe(image) { this.image = image; observers.set(image, this.callback); }
            disconnect() { observers.delete(this.image); }
        },
        setTimeout(callback, delay) { timers.set(++next, {callback,delay}); return next; },
        clearTimeout(id) { timers.delete(id); }
    });
    function image(lazy = false) {
        const attributes = {}, classes = new Set();
        const result = Object.assign(new EventTarget(), {
            loading:lazy?'lazy':'',naturalWidth:0,dataset:{},isConnected:true,
            classList:{add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name)},
            getAttribute:name=>attributes[name],removeAttribute:name=>delete attributes[name],
        });
        Object.defineProperty(result,'src',{get:()=>attributes.src||'',set:value=>{attributes.src=value;}});
        return result;
    }
    return {covers:window.merlinGameCovers,timers,calls,image,
        remove:image=>{image.isConnected=false;removed([{removedNodes:[{contains:node=>node===image}]}]);},
        visible:image=>observers.get(image)?.([{isIntersecting:true}])};
}
const settle = () => new Promise(resolve=>setImmediate(resolve));

test('image origins remain Ryuu hints and invalid IDs have no photo',()=>{
    const h=harness();
    assert.equal(h.covers.url(400),'https://generator.ryuu.lol/files/images/400.jpg');
    assert.equal(h.covers.url('../secret'),null);
});

test('the renderer loads only the local IPC result and passes the preferred source to the main process',async()=>{
    const h=harness(),image=h.image();
    h.covers.load(image,400,'https://shared.fastly.steamstatic.com/a.jpg');
    assert.equal(image.src,'');await settle();
    assert.equal(image.src,'file:///cache/400.jpg');
    assert.deepEqual(h.calls,[['400','https://shared.fastly.steamstatic.com/a.jpg',true]]);
    assert.equal(image.classList.contains('merlin-game-cover-pending'),true);
    image.naturalWidth=460;image.dispatchEvent(new Event('load'));
    assert.equal(image.classList.contains('merlin-game-cover-pending'),false);
    assert.equal(h.timers.size,0);
    assert.equal(h.covers.retain({querySelectorAll:()=>[image]}).get('400'),image);
});

test('off-screen photos start no IPC request or deadline until visible',async()=>{
    const h=harness(),image=h.image(true);
    h.covers.load(image,400);
    assert.equal(h.calls.length,0);assert.equal(h.timers.size,0);
    h.visible(image);await settle();
    assert.equal(h.calls.length,1);assert.equal(h.timers.size,1);
    assert.equal([...h.timers.values()][0].delay,10000);
    image.dispatchEvent(new Event('load'));assert.equal(h.timers.size,0);
});

test('a ten-second deadline reports failure once and ignores a late IPC result',async()=>{
    let finish;
    const h=harness(()=>new Promise(resolve=>{finish=resolve;})),image=h.image();
    let failures=0;image.addEventListener('error',()=>failures++);
    h.covers.load(image,400);
    const timer=[...h.timers.values()][0];timer.callback();
    finish({url:'file:///cache/400.jpg'});await settle();timer.callback();
    assert.equal(failures,1);assert.equal(image.src,'');
    assert.equal(h.covers.retain({querySelectorAll:()=>[image]}).size,0);
});

test('reusing a modal image cancels old callbacks and ignores the prior late result',async()=>{
    const pending=new Map();
    const h=harness(id=>new Promise(resolve=>pending.set(id,resolve))),image=h.image();
    h.covers.load(image,400);h.covers.load(image,500);
    assert.equal(h.timers.size,1);
    pending.get('500')({url:'file:///cache/500.jpg'});await settle();
    pending.get('400')({url:'file:///cache/400.jpg'});await settle();
    assert.equal(image.src,'file:///cache/500.jpg');
    image.dispatchEvent(new Event('load'));assert.equal(h.timers.size,0);
});

test('a missing photo is not retained across redraws and can recover on the next render',async()=>{
    let attempts=0;
    const h=harness(async()=>++attempts===1?{url:null}:{url:'file:///cache/400.jpg'}),image=h.image();
    h.covers.load(image,400);await settle();
    assert.equal(h.covers.retain({querySelectorAll:()=>[image]}).size,0);
    h.covers.load(image,400);await settle();
    assert.equal(image.src,'file:///cache/400.jpg');assert.equal(attempts,2);
});

test('removing an off-screen card disconnects its observer without starting a download',()=>{
    const h=harness(),image=h.image(true);
    h.covers.load(image,400);h.remove(image);h.visible(image);
    assert.equal(h.calls.length,0);assert.equal(h.timers.size,0);
    assert.equal(h.covers.retain({querySelectorAll:()=>[image]}).size,0);
});
