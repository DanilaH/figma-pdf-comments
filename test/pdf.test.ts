import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import {PDFDocument} from 'pdf-lib';
import {createReport} from '../src/pdf.ts';import {png,ordinaryPng} from './fixture.ts';import type {Comment,Frame} from '../src/model.ts';
const frame:Frame={id:'1:2',name:'Long diagnostic screen',x:100,y:200,width:300,height:1800,png};
const comment=(id:string,message:string,meta:unknown,parent_id?:string):Comment=>({id,message,client_meta:meta,parent_id,created_at:'2026-10-13T10:00:00Z',user:{handle:'Diagnostic Author'}});
test('long screen, thread overflow, orphan and Unicode produce a readable PDF without dropping messages',async()=>{
 const comments=[comment('root','Начало длинного комментария. '+('Текст для проверки переноса. '.repeat(220))+' КОНЕЦ_КОММЕНТАРИЯ_42',{node_id:'1:2',node_offset:{x:40,y:850},region_width:20,region_height:60}),comment('reply','Ответ 😀 END_REPLY',{x:1,y:1},'root'),comment('outside','OUTSIDE_PRESERVED',{x:9000,y:9000}),comment('edge','EDGE_PIN',{node_id:'1:2',node_offset:{x:300,y:1800}})];
 const r=await createReport({title:'SYNTHETIC DIAGNOSTIC — not live Figma',key:'TestKey123',frames:[frame],comments,capturedAt:'2026-10-13T10:00:00Z'});
 assert.equal(r.threads.length,3);assert.equal(r.threads.filter(t=>!t.frameId).length,1);assert.ok(r.layout.framePages[frame.id].length>=2);assert.equal(Object.keys(r.layout.threadPages).length,3);assert.ok(r.unsupportedGlyphs.includes('[U+1F600]'));
 const parsed=await PDFDocument.load(r.bytes);assert.equal(parsed.getPageCount(),r.pages);
 await mkdir('test-output',{recursive:true});await writeFile('test-output/diagnostic.pdf',r.bytes);await writeFile('test-output/result.json',JSON.stringify({pages:r.pages,messages:comments.length,threads:r.threads.length,unassigned:1,unsupported:r.unsupportedGlyphs},null,2));
});
test('ordinary screens fit once, duplicate names are distinct, short discussion stays on the image page',async()=>{
 const frames=[0,1,2].map(i=>({...frame,id:`1:${i+10}`,name:'Same screen name',height:800,png:ordinaryPng}));
 const r=await createReport({title:'Compact fixture',key:'Test',frames,comments:[comment('short','SHORT_INLINE_END',{node_id:'1:12',node_offset:{x:100,y:100}})],capturedAt:'2026-10-13T10:00:00Z'});
 assert.equal(r.pages,4);assert.equal(new Set(r.layout.screenLabels).size,3);
 assert.ok(frames.every(f=>r.layout.framePages[f.id].length===1));
 assert.equal(r.layout.threadPages.short,r.layout.framePages['1:12'][0]);
 await writeFile('test-output/ordinary.pdf',r.bytes);
});
test('mismatched raster bounds stop PDF instead of silently moving pins',async()=>{
 await assert.rejects(createReport({title:'Bad raster',key:'Test',frames:[{...frame,width:800}],comments:[],capturedAt:'now'}),/Raster bounds/);
});
