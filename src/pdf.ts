import {PDFDocument,PDFPage,rgb,PDFName,PDFString,pushGraphicsState,popGraphicsState,rectangle,clip,endPath} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {fontBase64} from './font-data';
import {groupComments,type Frame,type Comment,type Thread} from './model';
export type ReportInput={title:string;key:string;frames:Frame[];comments:Comment[];capturedAt:string};
export async function createReport(input:ReportInput){
  const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
  // The bundled TTF is already subsetted. A second fontkit subset produced missing
  // visible glyphs despite valid text extraction in the diagnostic PDF.
  const font=await doc.embedFont(Uint8Array.from(atob(fontBase64),c=>c.charCodeAt(0)),{subset:false});
  const supported=new Set(font.getCharacterSet());const missing=new Set<string>();
  const clean=(s:string)=>Array.from(s.replace(/\r\n?/g,'\n').replace(/\t/g,'    ')).map(c=>{
    if(c==='\n'||supported.has(c.codePointAt(0)!))return c;
    const tag='[U+'+c.codePointAt(0)!.toString(16).toUpperCase()+']';missing.add(tag);return tag;
  }).join('');
  const threads=groupComments(input.comments,input.frames);
  const W=595.28,H=841.89,M=40,B=50,ink=rgb(.13,.16,.22),accent=rgb(.27,.22,.76);
  let page!:PDFPage,y=0;
  function fresh(label:string){
    if(doc.getPageCount()>=250)throw Error('Diagnostic limit: 250 PDF pages. Nothing was truncated; export stopped.');
    page=doc.addPage([W,H]);y=H-M;
    text(label,14);y-=12;
  }
  function lines(s:string,size:number,width:number){
    const result:string[]=[];
    for(const paragraph of clean(s).split('\n')){
      let line='';
      for(const token of paragraph.match(/\S+|\s+/gu)??[]){
        if(line&&font.widthOfTextAtSize(line+token,size)>width){result.push(line);line='';}
        if(font.widthOfTextAtSize(token,size)<=width){line+=token;continue;}
        for(const c of token){
          if(line&&font.widthOfTextAtSize(line+c,size)>width){result.push(line);line='';}
          line+=c;
        }
      }
      result.push(line);
    }
    return result;
  }
  function text(s:string,size=10,width=W-2*M,x=M){
    for(const line of lines(s,size,width)){
      if(y-size*1.4<B)fresh('Review Pack - continued');
      page.drawText(line,{x,y:y-size,font,size,color:ink});y-=size*1.4;
    }
    y-=4;
  }
  function uri(p:PDFPage,label:string,url:string,atY:number){
    p.drawText(label,{x:M,y:atY,font,size:9,color:accent});
    const a=doc.context.register(doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[M,atY-2,M+font.widthOfTextAtSize(label,9),atY+11],Border:[0,0,0],A:{S:'URI',URI:PDFString.of(url)}}));
    p.node.addAnnot(a);
  }
  const url=`https://www.figma.com/design/${input.key}`;
  fresh('Review Pack - diagnostic snapshot');
  text(input.title,20);text(`Captured: ${input.capturedAt}`);text(`${input.frames.length} selected screens | ${threads.length} threads | ${input.comments.length} messages`);
  text('Text and current design snapshot only. Comment image/GIF attachments are not available through the documented API and are not included. This is not a complete archive or proof of approval.');
  text('Screen exports and comments are captured sequentially, not as an atomic historical version. The supplied file URL must match the open Figma document; a public plugin cannot prove that identity automatically.');
  text('Numbers on screens are report numbers, not necessarily the original Figma numbers. Unassigned messages are preserved separately. Unsupported font glyphs are printed as Unicode code points. Original text is available in the local diagnostics JSON.');
  uri(page,'Open source file in Figma',url,y-10);y-=35;
  text('Contents',14);
  const toc: {p:PDFPage;x:number;y:number;label:string;start:number}[]=[];
  for(const f of input.frames){if(y<75)fresh('Contents - continued');const label=clean(f.name);const lineY=y,p=page;text(label,10,W-2*M-55);toc.push({p,x:W-M-35,y:lineY-10,label,start:0});}
  const unassigned=threads.filter(t=>!t.frameId);text(`Unassigned threads: ${unassigned.length}`);
  function conversation(t:Thread){
    if(y<130)fresh('Discussion - continued');
    text(`#${t.number} | ${t.root.resolved_at?'Resolved':'Open'} | Comment ID: ${t.root.id}`,11);
    if(t.reason)text('Unassigned: '+t.reason);
    for(const [i,c] of [t.root,...t.replies].entries()){
      text(`${i?'Reply - ':''}${c.user.handle} | ${c.created_at}`,9);
      text(c.message,10,W-2*M-(i?16:0),M+(i?16:0));y-=8;
    }
  }
  for(const [fi,f] of input.frames.entries()){
    const img=await doc.embedPng(f.png);
    if(Math.abs(img.width/img.height-f.width/f.height)>Math.max(.002,2/img.height))throw Error(`Raster bounds do not match frame "${f.name}"; export stopped to avoid misplaced pins.`);
    const scale=Math.min(1,(W-2*M)/f.width);const fullHeight=f.height*scale;
    const sliceHeight=H-M-100-B;const count=Math.ceil(fullHeight/sliceHeight);
    toc[fi].start=doc.getPageCount()+1;
    const attached=threads.filter(t=>t.frameId===f.id);
    for(let n=0;n<count;n++){
      fresh(`${f.name} - screen ${fi+1}, part ${n+1}/${count}`);
      const top=y-8,off=n*sliceHeight,shown=Math.min(sliceHeight,fullHeight-off),bottom=top-shown;
      page.pushOperators(pushGraphicsState(),rectangle(M,bottom,f.width*scale,shown),clip(),endPath());
      page.drawImage(img,{x:M,y:top-fullHeight+off,width:f.width*scale,height:fullHeight});
      for(const t of attached){
        if(t.region)page.drawRectangle({x:M+t.region.x*scale,y:top-(t.region.y+t.region.height)*scale+off,width:t.region.width*scale,height:t.region.height*scale,borderColor:accent,borderWidth:1.5});
        const py=t.pin!.y*scale;
        if(py<off||py>off+shown||(py===off+shown&&n<count-1))continue;
        const actualX=M+t.pin!.x*scale,actualY=top-py+off;
        const px=Math.max(M+12,Math.min(M+f.width*scale-12,actualX)),cy=Math.max(bottom+12,Math.min(top-12,actualY));
        page.drawLine({start:{x:actualX,y:actualY},end:{x:px,y:cy},color:accent,thickness:1});
        page.drawCircle({x:actualX,y:actualY,size:2,color:accent});
        page.drawCircle({x:px,y:cy,size:10,color:accent});
        const label=String(t.number);const size=label.length>2?6:9;
        page.drawText(label,{x:px-font.widthOfTextAtSize(label,size)/2,y:cy-3,font,size,color:rgb(1,1,1)});
      }
      page.pushOperators(popGraphicsState());y=bottom-20;
      uri(page,'Open screen in Figma',`${url}?node-id=${encodeURIComponent(f.id)}`,Math.max(B-5,y));
    }
    fresh(`Discussion - ${f.name}`);
    if(!attached.length)text('No comments assigned to this selected screen.');
    for(const t of attached)conversation(t);
  }
  if(unassigned.length){fresh('Unassigned comments');for(const t of unassigned)conversation(t);}
  if(missing.size){fresh('Text rendering warnings');text('Unsupported characters were replaced with explicit Unicode code points. Nothing was silently removed.');text([...missing].join(', '));}
  for(const item of toc){
    item.p.drawText(String(item.start),{x:item.x,y:item.y,font,size:10,color:accent});
    const dest=doc.getPage(item.start-1).ref;
    const a=doc.context.register(doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[M,item.y-2,W-M,item.y+12],Border:[0,0,0],Dest:[dest,PDFName.of('Fit')]}));item.p.node.addAnnot(a);
  }
  for(const [i,p] of doc.getPages().entries())p.drawText(`${i+1} / ${doc.getPageCount()} - diagnostic, attachments excluded`,{x:M,y:22,size:8,font,color:ink});
  doc.setTitle(input.title+' - Review Pack');doc.setProducer('Review Pack Diagnostic / pdf-lib');
  return {bytes:await doc.save(),threads,pages:doc.getPageCount(),unsupportedGlyphs:[...missing]};
}
