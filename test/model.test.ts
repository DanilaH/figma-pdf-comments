import {test} from 'node:test';import assert from 'node:assert/strict';
import {position,groupComments,validateComments,fileKey,type Frame,type Comment} from '../src/model.ts';
const f:Frame={id:'1:2',name:'Screen',x:100,y:200,width:300,height:600,png:new Uint8Array()};
const c=(id:string,parent_id?:string):Comment=>({id,parent_id,message:'Привет',created_at:'2026-10-13T10:00:00Z',user:{handle:'Tester'},client_meta:{node_id:f.id,node_offset:{x:20,y:30}}});
test('file links reject token destinations, prototypes and branches',()=>{
 assert.equal(fileKey('https://www.figma.com/design/Ab123/Test?node-id=1-2'),'Ab123');
 for(const u of ['https://www.figma.com.evil.test/design/Ab123','http://www.figma.com/design/Ab123','https://www.figma.com/proto/Ab123','https://www.figma.com/design/Ab123/branch/Branch'])assert.throws(()=>fileKey(u));
});
test('relative and absolute positions preserve local point',()=>{
 assert.deepEqual(position(c('a').client_meta,[f]),{frameId:f.id,pin:{x:20,y:30},region:undefined});
 assert.equal(position({x:120,y:230},[f]).frameId,f.id);
});
test('all four region corners map from pin to top-left',()=>{
 for(const corner of ['top-left','top-right','bottom-left','bottom-right']){
  const p=position({node_id:f.id,node_offset:{x:100,y:100},region_width:40,region_height:30,comment_pin_corner:corner},[f]);
  assert.deepEqual(p.region,{x:corner.endsWith('right')?60:100,y:corner.startsWith('bottom')?70:100,width:40,height:30});
 }
 assert.deepEqual(position({x:200,y:300,region_width:40,region_height:30},[f]).region,{x:60,y:70,width:40,height:30});
});
test('never guess ambiguous, missing, invalid or excluded anchors',()=>{
 for(const meta of [{x:120,y:230},{node_id:'deleted',node_offset:{x:20,y:30}},{x:0,y:0},{x:NaN,y:3},{x:120,y:230,region_width:500,region_height:30}]){
  const frames=meta.node_id||!Number.isFinite(meta.x)?[f]:[f,{...f,id:'other'}];
  assert.ok(position(meta,frames).reason);
 }
 assert.ok(position({node_id:f.id,node_offset:{x:500,y:5}},[f]).reason);
});
test('threads preserve replies, orphan/cyclic messages and resolution',()=>{
 const comments=[{...c('root'),resolved_at:'2026-10-13T11:00:00Z'},c('reply','root'),c('orphan','missing'),c('cycle1','cycle2'),c('cycle2','cycle1')];
 const t=groupComments(comments,[f]);assert.equal(t.reduce((n,t)=>n+t.replies.length+1,0),5);assert.equal(t[0].replies.length,1);assert.equal(t.filter(x=>x.reason).length,3);
});
test('malformed or duplicate API messages stop export, never skip',()=>{
 assert.equal(validateComments({comments:[c('a')]}).length,1);
 for(const v of [{},{comments:[c('a'),c('a')]},{comments:[{...c('a'),message:null}]}])assert.throws(()=>validateComments(v));
});
