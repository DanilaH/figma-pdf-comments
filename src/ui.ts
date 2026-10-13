import {getComments} from './api';
import {fileKey,type Frame,type Comment} from './model';
import {createReport} from './pdf';
const $=(id:string)=>document.getElementById(id)!;
const url=$('url') as HTMLInputElement,token=$('token') as HTMLInputElement,confirmed=$('confirmed') as HTMLInputElement;
let controller:AbortController|undefined,pdf:Uint8Array|undefined,diagnostics:string|undefined;
let requestId=0;
let snapshotResolve:((s:{title:string;frames:Frame[]})=>void)|undefined,snapshotReject:((e:Error)=>void)|undefined;
function status(s:string){$('status').textContent=s;}
function busy(on:boolean){for(const id of ['build','url','token','confirmed'])($(id) as HTMLInputElement).disabled=on;($('cancel') as HTMLButtonElement).disabled=!on;}
function download(bytes:BlobPart,name:string,type:string){const objectURL=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=objectURL;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(objectURL),30000);}
url.oninput=()=>{confirmed.checked=false;};
window.onmessage=e=>{
  if(e.source!==parent)return;
  const m=e.data?.pluginMessage;
  if(m?.requestId!==requestId)return;
  if(m?.type==='snapshot'&&snapshotResolve){snapshotResolve(m);snapshotResolve=undefined;snapshotReject=undefined;}
  else if(m?.type==='error'&&snapshotReject){snapshotReject(new Error(m.message));snapshotResolve=undefined;snapshotReject=undefined;}
};
$('cancel').onclick=()=>controller?.abort();
$('build').onclick=async()=>{
  if(!confirmed.checked){status('Confirm that the URL matches the open file and that attachments are excluded.');return;}
  try{fileKey(url.value);}catch(e){status((e as Error).message);return;}
  pdf=undefined;diagnostics=undefined;($('pdf') as HTMLButtonElement).disabled=true;($('json') as HTMLButtonElement).disabled=true;
  controller=new AbortController();const signal=controller.signal;busy(true);
  try{
    status('Reading comments from Figma…');
    const data=await getComments(url.value,token.value,signal);
    if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    status('Exporting selected frames…');
    const snap=await new Promise<{title:string;frames:Frame[]}>((resolve,reject)=>{
      const timer=setTimeout(()=>{snapshotResolve=undefined;snapshotReject=undefined;reject(Error('Frame export timed out. Reopen the plugin before retrying.'));},60000);
      snapshotResolve=s=>{clearTimeout(timer);resolve(s);};snapshotReject=e=>{clearTimeout(timer);reject(e);};
      signal.addEventListener('abort',()=>snapshotReject?.(new DOMException('Cancelled','AbortError')),{once:true});
      parent.postMessage({pluginMessage:{type:'snapshot',requestId:++requestId}},'*');
    });
    if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    status('Building the PDF locally…');
    const input={title:snap.title,key:data.key,frames:snap.frames,comments:data.comments,capturedAt:new Date().toISOString()};
    const result=await createReport(input);
    if(signal.aborted)throw new DOMException('Cancelled','AbortError');
    pdf=result.bytes;
    diagnostics=JSON.stringify({schema:'review-pack-diagnostic-v1',...input,frames:input.frames.map(({png,...f})=>f),threads:result.threads,unsupportedGlyphs:result.unsupportedGlyphs,limitations:['Comment attachments excluded','URL/open-document identity confirmed manually','Sequential current snapshot; no historical guarantee','No live Figma verification by developer yet']},null,2);
    ($('pdf') as HTMLButtonElement).disabled=false;($('json') as HTMLButtonElement).disabled=false;
    status(`Ready: ${data.comments.length} messages, ${result.threads.length} threads, ${result.pages} PDF pages.\nAssigned: ${result.threads.filter(t=>t.frameId).length}; unassigned: ${result.threads.filter(t=>!t.frameId).length}.\nUnsupported glyphs: ${result.unsupportedGlyphs.length}. Review the PDF and diagnostics before sharing.`);
  }catch(e){status((e as Error).name==='AbortError'?'Cancelled. No new report is available.':(e as Error).message);}
  finally{busy(false);controller=undefined;snapshotResolve=undefined;snapshotReject=undefined;}
};
$('pdf').onclick=()=>{if(pdf)download(new Uint8Array(pdf).buffer,'review-pack-diagnostic.pdf','application/pdf');};
$('json').onclick=()=>{if(diagnostics)download(diagnostics,'review-pack-diagnostics.json','application/json');};
