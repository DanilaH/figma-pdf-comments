import {getComments} from './api';
import {fileKey,type Frame,type Comment} from './model';
import {createReport} from './pdf';
const $=(id:string)=>document.getElementById(id)!;
const url=$('url') as HTMLInputElement,token=$('token') as HTMLInputElement,confirmed=$('confirmed') as HTMLInputElement;
let controller:AbortController|undefined,pdf:Uint8Array|undefined,diagnostics:string|undefined;
const sessionNonce=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');
let sequence=0,requestId='';
let snapshotResolve:((s:{title:string;frames:Frame[]})=>void)|undefined,snapshotReject:((e:Error)=>void)|undefined;
let snapshotProgress:((message:string)=>void)|undefined;
function status(s:string){$('status').textContent=s;}
function busy(on:boolean){for(const id of ['build','url','token','confirmed'])($(id) as HTMLInputElement).disabled=on;($('cancel') as HTMLButtonElement).disabled=!on;}
function download(bytes:BlobPart,name:string,type:string){const objectURL=URL.createObjectURL(new Blob([bytes],{type}));const a=document.createElement('a');a.href=objectURL;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(objectURL),30000);}
url.oninput=()=>{confirmed.checked=false;};
window.onmessage=e=>{
  // Figma bridges sandbox messages to the UI. The public contract guarantees
  // data.pluginMessage, not event.source === parent. Match a pending, random
  // request ID instead; no credentials are ever sent through this channel.
  const m=e.data?.pluginMessage;
  if(!requestId||m?.requestId!==requestId||!snapshotResolve)return;
  if(m.type==='progress'&&typeof m.message==='string'){snapshotProgress?.(m.message);return;}
  if(m?.type==='snapshot'&&snapshotResolve){
    try{
      if(!Array.isArray(m.frames)||typeof m.title!=='string')throw Error('Unexpected frame response from Figma.');
      // Recreate the byte array in this UI realm; bridge/proxy implementations
      // need not preserve a Uint8Array's original JavaScript prototype.
      snapshotResolve({...m,frames:m.frames.map((f:Frame)=>({...f,png:Uint8Array.from(f.png)}))});
    }catch(error){snapshotReject?.(error instanceof Error?error:Error('Invalid frame image data.'));}
    snapshotResolve=undefined;snapshotReject=undefined;
  }
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
    status('Waiting for Figma plugin response…');
    const snap=await new Promise<{title:string;frames:Frame[]}>((resolve,reject)=>{
      let timer:ReturnType<typeof setTimeout>;
      const arm=(message:string,ms:number)=>{clearTimeout(timer);timer=setTimeout(()=>snapshotReject?.(Error(message)),ms);};
      snapshotResolve=s=>{clearTimeout(timer);snapshotProgress=undefined;resolve(s);};snapshotReject=e=>{clearTimeout(timer);snapshotProgress=undefined;reject(e);};
      snapshotProgress=message=>{status(message);arm(`Figma stopped responding while: ${message} Reopen the plugin and try one frame.`,60000);};
      arm('No response from the Figma plugin code. Reopen the plugin with the updated code.js and ui.html files.',15000);
      signal.addEventListener('abort',()=>snapshotReject?.(new DOMException('Cancelled','AbortError')),{once:true});
      requestId=`${sessionNonce}:${++sequence}`;
      parent.postMessage({pluginMessage:{type:'snapshot',requestId}},'*');
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
  finally{busy(false);controller=undefined;snapshotResolve=undefined;snapshotReject=undefined;snapshotProgress=undefined;requestId='';}
};
$('pdf').onclick=()=>{if(pdf)download(new Uint8Array(pdf).buffer,'review-pack-diagnostic.pdf','application/pdf');};
$('json').onclick=()=>{if(diagnostics)download(diagnostics,'review-pack-diagnostics.json','application/json');};
