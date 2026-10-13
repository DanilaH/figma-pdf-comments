export type Point = {x:number;y:number};
export type Rect = Point & {width:number;height:number};
export type Frame = Rect & {id:string;name:string;png:Uint8Array};
export type Comment = {id:string;parent_id?:string;message:string;created_at:string;resolved_at?:string|null;order_id?:string|number|null;user:{handle:string};client_meta?:unknown};
export type Thread = {number:number;root:Comment;replies:Comment[];frameId?:string;pin?:Point;region?:Rect;reason?:string};
export function fileKey(url:string):string {
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='www.figma.com'||u.username||u.password) throw Error('Use an HTTPS www.figma.com file link.');
  const m=u.pathname.match(/^\/(?:design|file)\/([a-zA-Z0-9]+)(?:\/|$)/);
  if(!m) throw Error('Use a Figma Design file link, not a prototype or Community link.');
  if(u.pathname.includes('/branch/'))throw Error('Branch links are outside this diagnostic. Use the main file.');
  return m[1];
}
export function validateComments(value:unknown):Comment[] {
  if(!value||typeof value!=='object'||!Array.isArray((value as any).comments)) throw Error('Figma returned an unexpected comments response.');
  const out:Comment[]=[]; const ids=new Set<string>();
  for(const c of (value as any).comments){
    if(!c||typeof c.id!=='string'||ids.has(c.id)||typeof c.message!=='string'||typeof c.created_at!=='string'||typeof c.user?.handle!=='string'||(c.parent_id!=null&&typeof c.parent_id!=='string')) throw Error('A comment is incomplete or duplicated; export stopped instead of dropping it.');
    ids.add(c.id);out.push(c);
  }
  if(out.length>2000) throw Error('Diagnostic limit: 2000 messages per file.');
  return out;
}
const finite=(p:any):p is Point=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const inside=(r:Rect,p:Point)=>p.x>=r.x&&p.y>=r.y&&p.x<=r.x+r.width&&p.y<=r.y+r.height;
export function position(meta:unknown,frames:Frame[]):Pick<Thread,'frameId'|'pin'|'region'|'reason'> {
  const m=meta as any;
  let p:Point;let anchor:Frame|undefined;
  if(m&&typeof m.node_id==='string'){
    anchor=frames.find(f=>f.id===m.node_id);
    if(!anchor)return {reason:'Anchor is not one of the selected frames (it may have been deleted or excluded).'};
    if(!finite(m.node_offset))return {reason:'Invalid node-relative coordinates.'};
    p={x:anchor.x+m.node_offset.x,y:anchor.y+m.node_offset.y};
  } else if(finite(m))p={x:m.x,y:m.y};
  else return {reason:'No usable position was returned by the API.'};
  let region:Rect|undefined;
  if(m.region_width!==undefined||m.region_height!==undefined){
    if(!(Number.isFinite(m.region_width)&&m.region_width>0&&Number.isFinite(m.region_height)&&m.region_height>0))return {reason:'Invalid region dimensions.'};
    const corner=m.comment_pin_corner??'bottom-right';
    if(!['top-left','top-right','bottom-left','bottom-right'].includes(corner))return {reason:'Unknown region pin corner.'};
    region={x:p.x-(corner.endsWith('right')?m.region_width:0),y:p.y-(corner.startsWith('bottom')?m.region_height:0),width:m.region_width,height:m.region_height};
  }
  const matches=(anchor?[anchor]:frames).filter(f=>inside(f,p)&&(!region||(inside(f,region)&&inside(f,{x:region.x+region.width,y:region.y+region.height}))));
  if(matches.length!==1)return {reason:matches.length?'Position overlaps selected frames; assignment is ambiguous.':'Position or region is outside the selected frames.'};
  const f=matches[0];
  return {frameId:f.id,pin:{x:p.x-f.x,y:p.y-f.y},region:region?{...region,x:region.x-f.x,y:region.y-f.y}:undefined};
}
export function groupComments(comments:Comment[],frames:Frame[]):Thread[]{
  const roots=comments.filter(c=>!c.parent_id);const threads:Thread[]=roots.map((root,i)=>({number:i+1,root,replies:[],...position(root.client_meta,frames)}));
  const byId=new Map(threads.map(t=>[t.root.id,t]));
  for(const c of comments.filter(c=>c.parent_id)){
    const parent=byId.get(c.parent_id!);
    if(parent)parent.replies.push(c);
    else threads.push({number:threads.length+1,root:c,replies:[],reason:'Reply parent is missing or is not a root thread; preserved without guessing.'});
  }
  for(const t of threads)t.replies.sort((a,b)=>a.created_at.localeCompare(b.created_at));
  if(threads.reduce((n,t)=>n+1+t.replies.length,0)!==comments.length)throw Error('Message count mismatch.');
  return threads;
}
