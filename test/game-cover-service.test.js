const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createGameCoverService, preferredCover } = require('../src/main/games/game-cover-service');
const jpeg = () => ({status:200,headers:{'content-type':'image/jpeg'},data:Buffer.from([255,216,255,217])});
async function directory(t) {
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'merlin-cover-test-'));
    t.after(async()=>{assert.equal(path.dirname(dir),os.tmpdir());assert.ok(path.basename(dir).startsWith('merlin-cover-test-'));await fs.rm(dir,{recursive:true,force:true});});
    return dir;
}
test('photos persist on disk and another app instance uses them without any network request',async t=>{
    const dir=await directory(t);let requests=0;
    const first=createGameCoverService({cacheDirectory:()=>dir,axios:{get:async()=>{requests++;return jpeg();}}});
    const downloaded=await first.load('400');assert.match(downloaded.url,/^file:/);assert.equal(requests,1);
    const restarted=createGameCoverService({cacheDirectory:()=>dir,axios:{get:async()=>{throw Error('The network must not be used');}}});
    const local=await restarted.load('400');assert.equal(local.cached,true);assert.equal(local.url,downloaded.url);
});
test('a Ryuu failure pauses further requests, preserves local photos, and permits only one recovery probe',async t=>{
    const dir=await directory(t);let now=Date.now();let requests=0;let recover;
    await fs.writeFile(path.join(dir,'400.jpg'),jpeg().data);
    const service=createGameCoverService({cacheDirectory:()=>dir,now:()=>now,axios:{get:async()=>{
        requests++;if(requests===1)throw Error('timeout');return new Promise(resolve=>{recover=resolve;});
    }}});
    assert.equal((await service.load('203290')).url,null);assert.equal(service.state().paused,true);
    assert.equal((await service.load('400')).cached,true);
    assert.equal((await service.load('517630')).url,null);assert.equal(requests,1);
    now+=60001;const probe=service.load('234140');
    while(!recover)await new Promise(resolve=>setImmediate(resolve));
    assert.equal((await service.load('1088850')).url,null);assert.equal(requests,2);
    recover(jpeg());assert.match((await probe).url,/^file:/);assert.equal(service.state().paused,false);
});
test('missing images do not trip the global circuit, and simultaneous requests for one photo are shared',async t=>{
    const dir=await directory(t);let requests=0;
    const service=createGameCoverService({cacheDirectory:()=>dir,axios:{get:async()=>{requests++;return requests===1?{status:404}:jpeg();}}});
    assert.equal((await service.load('203290')).url,null);assert.equal(service.state().paused,false);
    const results=await Promise.all(Array.from({length:8},()=>service.load('400')));
    assert.equal(requests,2);assert.ok(results.every(result=>result.url===results[0].url));
});
test('Hubcap, arbitrary hosts, HTTP, credentials and local paths cannot become cover origins',()=>{
    for(const input of ['https://hubcapmanifest.com/image.jpg','https://127.0.0.1/x','http://generator.ryuu.lol/files/images/400.jpg','https://user:secret@shared.fastly.steamstatic.com/x','file:///C:/private.txt'])
        assert.equal(preferredCover('400',input),'https://generator.ryuu.lol/files/images/400.jpg');
    assert.equal(preferredCover('400','https://shared.fastly.steamstatic.com/steam/apps/400/header.jpg'),'https://shared.fastly.steamstatic.com/steam/apps/400/header.jpg');
    assert.equal(preferredCover('400','https://api-merlin.com/api/premium/games/400/cover'),'https://api-merlin.com/api/premium/games/400/cover');
    assert.equal(preferredCover('4407750','https://generator.ryuu.lol/files/images/4080220.jpg'),'https://generator.ryuu.lol/files/images/4080220.jpg');
});

test('trusted Merlin cover URLs are downloaded and persisted without contacting Ryuu',async t=>{
    const dir=await directory(t);let requested;
    const service=createGameCoverService({cacheDirectory:()=>dir,axios:{get:async url=>{requested=url;return jpeg();}}});
    await service.load('400','https://api-merlin.com/api/covers/400');
    assert.equal(requested,'https://api-merlin.com/api/covers/400');
});

test('known Steam and Merlin photos load with an empty cache while the Ryuu circuit is open',async t=>{
    const dir=await directory(t);const requests=[];
    const service=createGameCoverService({cacheDirectory:()=>dir,simulateRyuuFailure:true,axios:{get:async url=>{requests.push(url);return jpeg();}}});
    assert.equal((await service.load('100')).url,null);
    assert.equal(service.state().paused,true);
    const retryAt=service.state().retryAt;
    for(const [appId,url] of [['400','https://shared.akamai.steamstatic.com/steam/apps/400/header.jpg'],['500','https://api-merlin.com/api/covers/500']]){
        assert.match((await service.load(appId,url)).url,/^file:/);
        assert.equal((await service.load(appId,url)).cached,true);
    }
    assert.deepEqual(requests,['https://shared.akamai.steamstatic.com/steam/apps/400/header.jpg','https://api-merlin.com/api/covers/500']);
    assert.equal(service.state().paused,true);
    assert.equal(service.state().retryAt,retryAt,'An unrelated photo must not reset the Ryuu pause');
    assert.equal((await service.load('600')).url,null);
    assert.equal(requests.length,2,'No Ryuu request should escape the open circuit');
});
test('paused corrections keep cached covers and use Steam without contacting Ryuu', async t => {
    const dir=await directory(t), requests=[];
    await fs.writeFile(path.join(dir,'400.jpg'),jpeg().data);
    const service=createGameCoverService({cacheDirectory:()=>dir,axios:{get:async url=>{requests.push(url);return jpeg();}}});
    assert.equal((await service.load('400',undefined,{allowRyuu:false})).cached,true);
    assert.match((await service.load('500',undefined,{allowRyuu:false})).url,/^file:/);
    assert.deepEqual(requests,['https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/500/header.jpg']);
});

test('a failed Steam photo does not fall through to a paused Ryuu or extend its pause',async t=>{
    const dir=await directory(t);const requests=[];
    const service=createGameCoverService({cacheDirectory:()=>dir,simulateRyuuFailure:true,axios:{get:async url=>{requests.push(url);throw new Error('Steam photo unavailable');}}});
    await service.load('100');const retryAt=service.state().retryAt;
    const result=await service.load('400','https://shared.akamai.steamstatic.com/steam/apps/400/header.jpg');
    assert.equal(result.url,null);assert.equal(result.paused,true);
    assert.deepEqual(requests,['https://shared.akamai.steamstatic.com/steam/apps/400/header.jpg']);
    assert.equal(service.state().retryAt,retryAt);
});

test('stale local photos stay visible and can refresh from Steam during a Ryuu outage',async t=>{
    const dir=await directory(t);const file=path.join(dir,'400.jpg');
    const previous=jpeg().data;const updated=Buffer.from([255,216,255,0,217]);
    await fs.writeFile(file,previous);
    const old=new Date(Date.now()-2*24*60*60*1000);await fs.utimes(file,old,old);
    let finish;
    const started=new Promise(resolve=>{finish=resolve;});
    let complete;
    const service=createGameCoverService({cacheDirectory:()=>dir,simulateRyuuFailure:true,axios:{get:async url=>{
        assert.equal(new URL(url).hostname,'shared.akamai.steamstatic.com');
        finish();return new Promise(resolve=>{complete=()=>resolve({...jpeg(),data:updated});});
    }}});
    await service.load('100');
    const result=await service.load('400','https://shared.akamai.steamstatic.com/steam/apps/400/header.jpg');
    assert.equal(result.cached,true);await started;
    assert.deepEqual(await fs.readFile(file),previous);
    complete();
    const deadline=Date.now()+3000;
    while((await fs.stat(file)).mtimeMs<=old.getTime()+1000){
        assert.ok(Date.now()<deadline,'The known Steam photo must refresh even while Ryuu is paused');
        await new Promise(resolve=>setImmediate(resolve));
    }
    assert.deepEqual(await fs.readFile(file),updated);
    assert.equal(service.state().paused,true);
});
test('an HTML response cannot poison the persistent image cache',async t=>{
    const dir=await directory(t);
    const service=createGameCoverService({cacheDirectory:()=>dir,axios:{get:async()=>({status:200,headers:{'content-type':'image/jpeg'},data:Buffer.from('<html>blocked</html>')})}});
    assert.equal((await service.load('400')).url,null);assert.equal(service.state().paused,true);
    assert.deepEqual(await fs.readdir(dir),[]);
    await assert.rejects(()=>service.load('../secret'));
});
