import {test} from 'node:test';import assert from 'node:assert/strict';import {getComments} from '../src/api.ts';
test('only official read endpoint receives ephemeral token',async()=>{
 let observed:any;
 const fake:typeof fetch=async(u,o)=>{observed={u,o};return new Response(JSON.stringify({comments:[]}));};
 const r=await getComments('https://www.figma.com/design/Ab123/Test',' secret ',new AbortController().signal,fake);
 assert.equal(r.key,'Ab123');assert.equal(observed.u,'https://api.figma.com/v1/files/Ab123/comments?as_md=true');assert.equal(observed.o.headers['X-Figma-Token'],'secret');assert.equal(observed.o.redirect,'error');assert.equal(observed.o.credentials,'omit');
});
test('rate limit and denied access cannot produce a report',async()=>{
 for(const status of [403,404,429,500])await assert.rejects(getComments('https://www.figma.com/design/Ab123','x',new AbortController().signal,async()=>new Response('{}',{status,headers:{'Retry-After':'30'}})));
});
