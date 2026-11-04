export type KitchenPaperMode='single'|'roll';
export function kitchenPageLayout(heightPx:number,mode:KitchenPaperMode){
 if(!Number.isFinite(heightPx)||heightPx<=0)throw Error('Chưa đo được chiều dài phiếu bếp. Vui lòng thử lại.');
 const naturalMm=heightPx*25.4/96;
 return {scale:mode==='single'?Math.min(1,Math.floor(281/naturalMm*10000)/10000):1,heightMm:mode==='single'?297:Math.ceil(naturalMm+4)};
}
const frames=(win:Window)=>new Promise<void>(resolve=>win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>resolve())));
export async function printKitchenPaper(paper:HTMLElement,mode:KitchenPaperMode){
 const frame=document.createElement('iframe');frame.title='Phiếu gửi bếp XP-80C';frame.setAttribute('aria-hidden','true');
 Object.assign(frame.style,{position:'fixed',left:'-10000px',top:'0',width:'80mm',height:'1px',border:'0'});document.body.appendChild(frame);
 let timer:ReturnType<typeof setTimeout>|undefined;
 const cleanup=()=>{if(timer)clearTimeout(timer);frame.remove();};
 try{
  const doc=frame.contentDocument,win=frame.contentWindow;if(!doc||!win)throw Error('Không mở được khung in phiếu bếp.');
  doc.open();doc.write('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu gửi bếp DPA</title></head><body></body></html>');doc.close();
  const base=doc.createElement('base');base.href=document.baseURI;doc.head.appendChild(base);
  // Reuse the preview's current formatting, set labels and table positions.
  await Promise.all(Array.from(document.head.querySelectorAll('link[rel="stylesheet"],style')).filter(node=>node.tagName!=='LINK'||new URL((node as HTMLLinkElement).href,document.baseURI).origin===location.origin).map(node=>{
   const copy=node.cloneNode(true) as HTMLLinkElement|HTMLStyleElement;
   if(copy.tagName!=='LINK'){doc.head.appendChild(copy);return Promise.resolve();}
   const link=copy as HTMLLinkElement;link.media='all';
   return new Promise<void>((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('Chưa tải xong định dạng phiếu in. Vui lòng thử lại.')),15000);
    link.onload=()=>{clearTimeout(timeout);resolve();};link.onerror=()=>{clearTimeout(timeout);reject(Error('Không tải được định dạng phiếu in.'));};doc.head.appendChild(link);
   });
  }));
  const layout=doc.createElement('style');layout.textContent=`html,body{box-sizing:border-box;width:80mm;min-width:80mm;max-width:80mm;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;overflow:visible!important;background:#fff}body>.menu-print-sheet{display:block!important;box-sizing:border-box;width:80mm!important;max-width:80mm!important;min-height:0!important;height:auto!important;margin:0!important;padding:${mode==='single'?'3mm':'4mm 4mm 5mm'}!important;box-shadow:none!important}body>.menu-print-sheet *{box-sizing:border-box}body>.menu-print-sheet .menu-print-set-caption{white-space:pre-line}`;doc.head.appendChild(layout);
  const clone=paper.cloneNode(true) as HTMLElement;doc.body.appendChild(clone);
  await doc.fonts.ready;await frames(win);
  const page=doc.createElement('style');doc.head.appendChild(page);
  const measure=()=>{
   clone.style.zoom='1';const fit=kitchenPageLayout(Math.max(clone.scrollHeight,clone.getBoundingClientRect().height),mode);
   clone.style.zoom=String(fit.scale);clone.style.marginInline='auto';page.textContent=`@page{size:80mm ${fit.heightMm}mm;margin:0}`;
  };
  measure();win.addEventListener('beforeprint',measure);win.addEventListener('afterprint',cleanup,{once:true});
  await frames(win);timer=setTimeout(cleanup,300000);win.focus();win.print();
 }catch(error){cleanup();throw error;}
}
