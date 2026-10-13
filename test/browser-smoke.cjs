// Runs the real built UI against an explicit mock host and mock REST response.
// This is NOT a Figma integration test and never sends a token to Figma.
const {chromium}=require('playwright');const http=require('node:http');const fs=require('node:fs/promises');const assert=require('node:assert/strict');
(async()=>{
 const ui=await fs.readFile('dist/ui.html','utf8');
 const fixture=await fs.readFile('test/fixture.ts','utf8');const png=fixture.match(/atob\('([^']+)'\)/)[1];
 const host=`<!doctype html><iframe src="/ui" style="width:520px;height:620px;border:0"></iframe><script>let generation=0;window.addEventListener('message',e=>{const m=e.data.pluginMessage;if(m?.type==='snapshot'){const current=++generation;setTimeout(()=>e.source.postMessage({pluginMessage:{type:'snapshot',requestId:m.requestId,title:'MOCK HOST — NOT FIGMA',frames:[{id:'1:2',name:'Long screen',x:100,y:200,width:300,height:1800,png:Uint8Array.from(atob('${png}'),c=>c.charCodeAt(0))}]}},'*'),current===2?500:0)}});</script>`;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(req.url==='/ui'?ui:host)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--single-process','--no-zygote','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:560,height:680},acceptDownloads:true});let requests=0;let denied=false;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://api.figma.com/**',async route=>{
   requests++;assert.equal(route.request().url(),'https://api.figma.com/v1/files/Ab123/comments?as_md=true');
   await route.fulfill({status:denied?403:200,contentType:'application/json',body:JSON.stringify({comments:[{id:'root',message:'Тестовый комментарий 😀',created_at:'2026-10-13T10:00:00Z',user:{handle:'Mock Author'},client_meta:{node_id:'1:2',node_offset:{x:100,y:850}}},{id:'reply',parent_id:'root',message:'MOCK_REPLY',created_at:'2026-10-13T10:01:00Z',user:{handle:'Mock Author'},client_meta:{x:0,y:0}},{id:'outside',message:'MOCK_UNASSIGNED',created_at:'2026-10-13T10:02:00Z',user:{handle:'Mock Author'},client_meta:{x:9000,y:9000}}]})});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);const f=page.frameLocator('iframe');
  await f.locator('#build').click();await f.locator('#status').filter({hasText:'Confirm'}).waitFor();assert.equal(requests,0);
  await f.locator('#url').fill('https://www.figma.com/design/Ab123/Test');await f.locator('#token').fill('DUMMY_TOKEN_NEVER_REAL');await f.locator('#confirmed').check();
  await f.locator('#build').click();await f.locator('#pdf').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('iframe').contentDocument.querySelector('#pdf').disabled===false);
  assert.match(await f.locator('#status').innerText(),/Assigned: 1; unassigned: 1/);
  const jsonWait=page.waitForEvent('download');await f.locator('#json').click();const jd=await jsonWait;const json=await fs.readFile(await jd.path(),'utf8');assert.ok(!json.includes('DUMMY_TOKEN'));assert.equal(JSON.parse(json).comments.length,3);
  const pdfWait=page.waitForEvent('download');await f.locator('#pdf').click();const pd=await pdfWait;const bytes=await fs.readFile(await pd.path());assert.equal(bytes.subarray(0,4).toString(),'%PDF');
  await fs.mkdir('test-output',{recursive:true});await fs.writeFile('test-output/browser-report.pdf',bytes);await page.screenshot({path:'test-output/ui-ready.png'});
  await f.locator('#build').click();await f.locator('#status').filter({hasText:'Exporting selected frames'}).waitFor();await f.locator('#cancel').click();await f.locator('#status').filter({hasText:'Cancelled'}).waitFor();assert.ok(await f.locator('#pdf').isDisabled());
  // Start again before the cancelled mock snapshot arrives. Request IDs prevent
  // that old frame response from being used for the new export.
  denied=true;await f.locator('#build').click();await f.locator('#status').filter({hasText:'Figma denied access'}).waitFor();assert.ok(await f.locator('#pdf').isDisabled());
  await f.locator('#url').fill('https://www.figma.com/design/OtherFile');assert.equal(await f.locator('#confirmed').isChecked(),false);
  assert.deepEqual(errors,[]);const result={host:'explicit mock; not Figma',requests,tests:['consent gate','success and counts','PDF download','token absent from diagnostics','cancel during raster capture','denied access after cancelled capture','URL change invalidates confirmation'],pageErrors:errors};
  await fs.writeFile('test-output/browser-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
