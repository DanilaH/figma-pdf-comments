import {PDFDocument,PDFPage,rgb,PDFName,PDFString,pushGraphicsState,popGraphicsState,rectangle,clip,endPath} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {fontBase64} from './font-data';
import {groupComments,type Frame,type Comment,type Thread} from './model';
export type ReportInput={title:string;key:string;frames:Frame[];comments:Comment[];capturedAt:string};
export async function createReport(input:ReportInput){
  const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
  // Embed the already-subsetted TTF intact. Optional ligatures caused incorrect
  // fi/fl ToUnicode mappings in a returned real PDF, so disable them.
  const font=await doc.embedFont(Uint8Array.from(atob(fontBase64),c=>c.charCodeAt(0)),{subset:false,features:{liga:false,clig:false}});
  const supported=new Set(font.getCharacterSet()),missing=new Set<string>();
  const clean=(s:string)=>Array.from(s.replace(/\r\n?/g,'\n').replace(/\t/g,'    ')).map(c=>{
    if(c==='\n'||supported.has(c.codePointAt(0)!))return c;
    const tag='[U+'+c.codePointAt(0)!.toString(16).toUpperCase()+']';missing.add(tag);return tag;
  }).join('');
  const threads=groupComments(input.comments,input.frames),unassigned=threads.filter(t=>!t.frameId);
  const W=595.28,H=841.89,M=40,B=50,CW=W-2*M,GAP=16,SIDE=164;
  const ink=rgb(.13,.16,.22),accent=rgb(.27,.22,.76),muted=rgb(.40,.44,.50);
  const labels=input.frames.map((f,i)=>`${i+1}. ${f.name}`);
  const layout={screenLabels:labels,framePages:{} as Record<string,number[]>,threadPages:{} as Record<string,number>};
  let page!:PDFPage,y=0;
  function lines(s:string,size:number,width:number){
    const result:string[]=[];
    for(const paragraph of clean(s).split('\n')){
      let line='';
      for(const token of paragraph.match(/\S+|\s+/gu)??[]){
        if(line&&font.widthOfTextAtSize(line+token,size)>width){result.push(line);line='';}
        if(font.widthOfTextAtSize(token,size)<=width){line+=token;continue;}
        for(const c of token){if(line&&font.widthOfTextAtSize(line+c,size)>width){result.push(line);line='';}line+=c;}
      }
      result.push(line);
    }
    return result;
  }
  const height=(s:string,size:number,width:number)=>lines(s,size,width).length*size*1.4+4;
  function fresh(label:string){
    if(doc.getPageCount()>=250)throw Error('Diagnostic limit: 250 PDF pages. Nothing was truncated; export stopped.');
    page=doc.addPage([W,H]);y=H-M;text(label,14);y-=12;
  }
  function text(s:string,size=10,width=CW,x=M,color=ink){
    for(const line of lines(s,size,width)){
      if(y-size*1.4<B)fresh('Review Pack - discussion continued');
      page.drawText(line,{x,y:y-size,font,size,color});y-=size*1.4;
    }
    y-=4;
  }
  function link(label:string,url:string,x=M,size=9){
    if(y-size-6<B)fresh('Review Pack - continued');
    const atY=y-size;page.drawText(label,{x,y:atY,font,size,color:accent});
    page.node.addAnnot(doc.context.register(doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[x,atY-2,x+font.widthOfTextAtSize(label,size),atY+11],Border:[0,0,0],A:{S:'URI',URI:PDFString.of(url)}})));
    y-=size*1.4+6;
  }
  function date(s:string){const d=new Date(s);return Number.isNaN(d.getTime())?s:d.toISOString().replace('T',' ').replace(/\.\d{3}Z$/,' UTC');}
  function blocks(t:Thread,width:number){
    const rows:{s:string;size:number;indent:number;color?:ReturnType<typeof rgb>}[]=[{s:`#${t.number} · ${t.root.resolved_at?'Resolved':'Open'}`,size:11,indent:0}];
    if(t.reason)rows.push({s:t.reason,size:9,indent:0,color:muted});
    for(const [i,c] of [t.root,...t.replies].entries()){
      const indent=i?Math.min(12,width/10):0;
      rows.push({s:`${i?'Reply · ':''}${c.user.handle}`,size:9,indent},{s:date(c.created_at),size:8,indent,color:muted},{s:c.message,size:10,indent},{s:'',size:3,indent});
    }
    return rows;
  }
  const threadHeight=(t:Thread,width:number)=>blocks(t,width).reduce((n,r)=>n+height(r.s,r.size,width-r.indent),0)+18;
  function conversation(t:Thread,x=M,width=CW){
    const needed=threadHeight(t,width);
    // Long discussions reflow at full page width; short ones remain inline.
    if((x!==M&&needed>y-B)||(x===M&&Math.min(needed,110)>y-B)){
      fresh(`Thread #${t.number} - continued discussion`);x=M;width=CW;
    }
    layout.threadPages[t.root.id]=doc.getPageCount();
    page.drawLine({start:{x,y:y+3},end:{x:x+width,y:y+3},color:rgb(.85,.87,.90),thickness:.5});
    for(const row of blocks(t,width))text(row.s,row.size,width-row.indent,x+row.indent,row.color);
    y-=8;
  }
  const url=`https://www.figma.com/design/${input.key}`;
  fresh('Review Pack - current snapshot');text(input.title,20);text(`Captured: ${date(input.capturedAt)}`,9);
  text(`${input.frames.length} screens · ${threads.length} threads · ${input.comments.length} messages`,11);
  text('Text comments and current screen images. Comment image/GIF attachments are excluded. This is not a complete archive or an approval record.',9);
  text('The exporter confirmed the source URL. Screens and comments were captured sequentially. Report numbers may differ from Figma; unassigned comments are preserved separately.',9);
  link('Open source file in Figma',url);y-=8;text('Contents',14);
  const toc:{p:PDFPage;y:number;start:number}[]=[];
  for(const label of labels){if(y<80)fresh('Contents - continued');const p=page,at=y-10;text(label,10,CW-50);toc.push({p,y:at,start:0});}
  text(`Unassigned threads: ${unassigned.length}`,9);
  for(const [fi,f] of input.frames.entries()){
    const img=await doc.embedPng(f.png);
    if(Math.abs(img.width/img.height-f.width/f.height)>Math.max(.002,2/img.height))throw Error(`Raster bounds do not match frame "${f.name}"; export stopped to avoid misplaced pins.`);
    const attached=threads.filter(t=>t.frameId===f.id);
    const fullScale=Math.min(1,CW/f.width),sideScale=Math.min(1,(CW-SIDE-GAP)/f.width);
    const side=attached.length>0&&sideScale/fullScale>=.75,baseScale=side?sideScale:fullScale;
    fresh(labels[fi]);toc[fi].start=doc.getPageCount();layout.framePages[f.id]=[];
    let top=y-8;
    const capacity=H-M-height(`${labels[fi]} · part 000/000`,14,CW)-12-8-B-25;
    if(capacity<100)throw Error('A frame name is too long to lay out a readable image. Shorten its name and retry.');
    const fitScale=Math.min(baseScale,capacity/f.height);
    // Ordinary screens fit one page if height fitting costs at most 25% of
    // natural-width readability. Long screens retain width and are split.
    const scale=fitScale/baseScale>=.75?fitScale:baseScale;
    const fullHeight=f.height*scale,count=Math.ceil(fullHeight/capacity),painted=new Set<string>();
    for(let n=0;n<count;n++){
      if(n){fresh(`${labels[fi]} · part ${n+1}/${count}`);top=y-8;}
      const off=n*capacity,shown=Math.min(capacity,fullHeight-off),bottom=top-shown;
      layout.framePages[f.id].push(doc.getPageCount());
      const here=attached.filter(t=>{const py=t.pin!.y*scale;return py>=off&&py<=off+shown&&!(py===off+shown&&n<count-1);});
      page.pushOperators(pushGraphicsState(),rectangle(M,bottom,f.width*scale,shown),clip(),endPath());
      page.drawImage(img,{x:M,y:top-fullHeight+off,width:f.width*scale,height:fullHeight});
      for(const t of attached){
        if(t.region)page.drawRectangle({x:M+t.region.x*scale,y:top-(t.region.y+t.region.height)*scale+off,width:t.region.width*scale,height:t.region.height*scale,borderColor:accent,borderWidth:1.5});
        if(!here.includes(t))continue;
        const actualX=M+t.pin!.x*scale,actualY=top-t.pin!.y*scale+off;
        const px=Math.max(M+12,Math.min(M+f.width*scale-12,actualX)),cy=Math.max(bottom+12,Math.min(top-12,actualY));
        page.drawLine({start:{x:actualX,y:actualY},end:{x:px,y:cy},color:accent,thickness:1});page.drawCircle({x:actualX,y:actualY,size:2,color:accent});page.drawCircle({x:px,y:cy,size:10,color:accent});
        const label=String(t.number),size=label.length>2?6:9;page.drawText(label,{x:px-font.widthOfTextAtSize(label,size)/2,y:cy-3,font,size,color:rgb(1,1,1)});
      }
      page.pushOperators(popGraphicsState());y=bottom-6;link('Open screen in Figma',`${url}?node-id=${encodeURIComponent(f.id)}`,M,8);
      const imagePage=page,afterImage=y;
      if(here.length){
        if(side){y=top;text(`Threads on part ${n+1}/${count}`,9,SIDE,W-M-SIDE,muted);}
        for(const t of here){const inline=side&&page===imagePage;conversation(t,inline?W-M-SIDE:M,inline?SIDE:CW);painted.add(t.root.id);}
        if(side&&page===imagePage)y=Math.min(y,afterImage);
      }else if(!attached.length&&n===count-1&&y-B>25)text('No comments on this screen.',9,CW,M,muted);
    }
    if(painted.size!==attached.length)throw Error('A thread was not laid out on its screen; export stopped.');
  }
  if(unassigned.length){
    const needed=height('Unassigned comments',14,CW)+12+unassigned.reduce((n,t)=>n+threadHeight(t,CW),0);
    if(needed>y-B)fresh('Unassigned comments');else{y-=12;text('Unassigned comments',14);}
    for(const t of unassigned)conversation(t);
  }
  if(missing.size){if(y<130)fresh('Text rendering warnings');else text('Text rendering warnings',14);text('Unsupported characters are shown as Unicode code points. Exact original text remains in diagnostics JSON.',9);text([...missing].join(', '));}
  for(const item of toc){
    item.p.drawText(String(item.start),{x:W-M-35,y:item.y,font,size:10,color:accent});
    item.p.node.addAnnot(doc.context.register(doc.context.obj({Type:'Annot',Subtype:'Link',Rect:[M,item.y-2,W-M,item.y+12],Border:[0,0,0],Dest:[doc.getPage(item.start-1).ref,PDFName.of('Fit')]})));
  }
  for(const [i,p] of doc.getPages().entries())p.drawText(`${i+1} / ${doc.getPageCount()} · comment attachments excluded`,{x:M,y:22,size:8,font,color:muted});
  doc.setTitle(input.title+' - Review Pack');doc.setProducer('Review Pack Diagnostic / pdf-lib');
  return {bytes:await doc.save(),threads,pages:doc.getPageCount(),unsupportedGlyphs:[...missing],layout};
}
