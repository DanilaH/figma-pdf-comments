figma.showUI(__html__,{width:520,height:620});
let busy=false;
figma.ui.onmessage=async(m)=>{
  if(m?.type!=='snapshot')return;
  if(busy){figma.ui.postMessage({type:'error',requestId:m.requestId,message:'The previous frame export is still running. Wait a moment and retry.'});return;}
  busy=true;
  try{
    const nodes=[...figma.currentPage.selection];
    if(nodes.length<1||nodes.length>12)throw Error('Select 1–12 top-level frames on the current page.');
    const frames=[];
    for(const node of nodes){
      if(node.type!=='FRAME'||node.parent?.type!=='PAGE')throw Error('Only frames directly on the current page are supported.');
      if(!node.visible||!node.clipsContent)throw Error('Frames must be visible and Clip content must be enabled for reliable raster bounds.');
      const [[a,b,x],[c,d,y]]=node.absoluteTransform;
      if(Math.abs(a-1)>0.00001||Math.abs(d-1)>0.00001||Math.abs(b)>0.00001||Math.abs(c)>0.00001)throw Error('Rotated, flipped or transformed frames are not supported in this diagnostic.');
      if(node.effects.some(e=>e.visible!==false))throw Error('Remove effects from the frame container for this diagnostic (effects inside it are allowed).');
      if(node.width<1||node.height<1||node.width*node.height>20000000||node.height>20000)throw Error('A selected frame is too large for this diagnostic.');
      const scale=Math.min(1,1500/node.width);
      const png=await node.exportAsync({format:'PNG',constraint:{type:'SCALE',value:scale},contentsOnly:true,useAbsoluteBounds:true});
      frames.push({id:node.id,name:node.name,x,y,width:node.width,height:node.height,png});
    }
    figma.ui.postMessage({type:'snapshot',requestId:m.requestId,title:figma.root.name,page:figma.currentPage.name,frames});
  }catch(e){figma.ui.postMessage({type:'error',requestId:m.requestId,message:e instanceof Error?e.message:'Could not export the selected frames.'});}
  finally{busy=false;}
};
