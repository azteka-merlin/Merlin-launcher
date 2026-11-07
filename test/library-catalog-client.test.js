const test = require('node:test');
const assert = require('node:assert/strict');
const { createLibraryCatalogClient, fallbackCoverForAppId } = require('../src/main/library/library-catalog-client');
test('the catalog goes through authenticated Merlin and caps its request at ten seconds', async () => {
  const calls=[];
  const client=createLibraryCatalogClient({authSession:{getAccessToken:async()=>'private-test-token'},axios:{get:async(url,options)=>{
    calls.push({url,options});return {data:{games:[{appid:10,name:'Game',header_image:'https://generator.ryuu.lol/files/images/10.jpg'}]}};
  }}});
  const result=await client.download();
  assert.equal(calls[0].url,'https://api-merlin.com/api/games/catalog-cache');
  assert.equal(calls[0].options.timeout,10000);
  assert.equal(calls[0].options.headers.Authorization,'Bearer private-test-token');
  assert.equal(result.games['10'].coverUrl,'https://generator.ryuu.lol/files/images/10.jpg');
  assert.equal(result.games['10'].coverSource,'catalog_image');
});
test('numeric games keep their original Ryuu photo hint and invalid IDs have no image',()=>{
  assert.equal(fallbackCoverForAppId('1736800'),'https://generator.ryuu.lol/files/images/1736800.jpg');
  assert.equal(fallbackCoverForAppId('abc'),null);
});
