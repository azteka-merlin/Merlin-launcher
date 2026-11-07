const test = require('node:test');
const assert = require('node:assert/strict');
const {createCircuitBreaker} = require('../src/main/network/circuit-breaker');

test('a late success cannot reopen a circuit tripped by a concurrent failure',async()=>{
    let now=0,finish;
    const circuit=createCircuitBreaker({now:()=>now,pauseMs:100});
    const earlier=circuit.run(()=>new Promise(resolve=>{finish=resolve;}));
    await assert.rejects(circuit.run(async()=>{throw Error('timeout');}));
    finish('cached');await earlier;
    assert.equal(circuit.state().paused,true);
    await assert.rejects(circuit.run(async()=>assert.fail('Must stay paused')),{code:'SOURCE_PAUSED'});
    now=101;await circuit.run(async()=>true);
    assert.equal(circuit.state().paused,false);
});

test('only one recovery probe runs and a 404 proves reachability',async()=>{
    let now=0,finish;
    const circuit=createCircuitBreaker({now:()=>now,pauseMs:100});
    await assert.rejects(circuit.run(async()=>{throw Error('offline');}));
    now=101;
    const probe=circuit.run(()=>new Promise((_,reject)=>{finish=reject;}));
    await assert.rejects(circuit.run(async()=>assert.fail('Only one probe')),{code:'SOURCE_PAUSED'});
    finish(Object.assign(Error('missing'),{status:404}));await assert.rejects(probe);
    assert.equal(circuit.state().paused,false);
});
