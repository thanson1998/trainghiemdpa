/* Print an isolated, measured 80 mm roll instead of paginating the POS dialog. */
(()=>{'use strict';
 const active=new WeakSet();
 const css=`
 html,body{box-sizing:border-box;width:80mm;min-width:80mm;max-width:80mm;min-height:0;height:auto;margin:0;padding:0;background:#fff;color:#000;overflow:visible}
 *,*:before,*:after{box-sizing:border-box}
 .checkout-bill-paper{display:block;width:80mm;max-width:80mm;margin:0;padding:4mm;background:#fff}
 .checkout-bill{display:block;margin:0;padding:0;font:15px/1.45 Arial,Helvetica,sans-serif;color:#000;overflow-wrap:anywhere}
 .checkout-bill>header{text-align:center;border-bottom:1px dashed #999;padding-bottom:12px}
 .checkout-bill h2{font-size:18px;margin:0 0 6px}.checkout-bill h3{font-size:16px;margin:0}.checkout-bill header p{font-size:14px;margin:5px 0 0}
 .checkout-bill-facts{padding:12px 0}.checkout-bill-facts p{margin:4px 0;font-size:14px}.checkout-bill-facts p:first-child{font-size:18px}
 .checkout-bill-table{table-layout:auto;width:100%;border-collapse:collapse;font:12px/1.4 Arial,Helvetica,sans-serif}
 .checkout-bill-table thead{display:table-row-group}.checkout-bill-table tr{break-inside:avoid;page-break-inside:avoid}
 .checkout-bill-table th,.checkout-bill-table td{padding:6px 2px;vertical-align:top;border-bottom:1px dotted #bbb}
 .checkout-bill-table th{font-size:11.5px;line-height:1.35;border-top:1px solid #999;border-bottom:1px solid #999;vertical-align:middle}
 .checkout-bill-table th:first-child{width:34%;text-align:left}.checkout-bill-table th:nth-child(2){width:16%;text-align:left}
 .checkout-bill-table th:nth-child(3),.checkout-bill-table th:nth-child(4){width:25%;text-align:right}
 .checkout-bill-table td:first-child{font-size:12px;line-height:1.45;white-space:normal;overflow-wrap:anywhere;text-align:left}
 .checkout-bill-table td:nth-child(2){font-size:12px;line-height:1.45;white-space:normal;text-align:left}
 .checkout-bill-table td:nth-child(3),.checkout-bill-table td:nth-child(4){font-size:11.5px;line-height:1.52;white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums;letter-spacing:-.1px}
 .checkout-bill-table td:nth-child(3){padding-right:5px}.checkout-bill-table td:nth-child(4){padding-left:5px}
 .checkout-bill-table td small{font-size:10px;white-space:normal;display:inline-block;max-width:18mm;line-height:1.35}
 .checkout-bill-agreed,.checkout-bill-empty{font-size:13px;line-height:1.5;margin:12px 0}
 .checkout-bill-note{font-size:14px;border-top:1px dashed #999;padding-top:10px;margin-top:12px}.checkout-bill-note p{white-space:pre-wrap;margin:4px 0}
 .checkout-bill-settlement{break-inside:avoid;page-break-inside:avoid}
 .checkout-bill-totals{border-top:1px dashed #999;margin-top:8px;padding-top:4px}.checkout-bill-totals p{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:15px;line-height:1.4;margin:4px 0}
 .checkout-bill-totals p>:last-child{flex-shrink:0;white-space:nowrap;font-variant-numeric:tabular-nums}.checkout-bill-totals strong{font-size:16px}
 .checkout-bill-payment{display:grid;grid-template-columns:minmax(0,1fr) 40mm;column-gap:6px;row-gap:2px;align-items:center;padding-top:6px;margin-top:4px;text-align:left}
 .checkout-bill-payment h3{grid-column:1/-1;text-align:center;font-size:13px;line-height:1.3;margin:0 0 4px}
 .checkout-bill-payment p{grid-column:1;font-size:12px;line-height:1.35;margin:1px 0;min-width:0;overflow-wrap:anywhere}
 .checkout-bill-payment small{grid-column:1/-1;display:block;text-align:center;font-size:11px;line-height:1.35;margin-top:4px}
 .checkout-bill-payment img{grid-column:2;grid-row:2/span 4;display:block;width:40mm;height:40mm;max-width:100%;object-fit:contain;margin:0;background:#fff}
 .checkout-bill>footer{text-align:center;font-size:13px;border-top:1px dashed #999;margin-top:6px;padding-top:6px;break-before:avoid}
 @media print{html,body{width:80mm!important;margin:0!important;padding:0!important;min-height:0!important;height:auto!important}.checkout-bill-paper{margin:0!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}}
 `;
 const frames=win=>new Promise(resolve=>win.requestAnimationFrame(()=>win.requestAnimationFrame(resolve)));
 async function printPaper(paper){
  const frame=document.createElement('iframe');frame.title='Bill tạm tính 80mm';frame.setAttribute('aria-hidden','true');
  Object.assign(frame.style,{position:'fixed',left:'-10000px',top:'0',width:'80mm',height:'1px',border:'0'});document.body.appendChild(frame);
  let timer;const cleanup=()=>{clearTimeout(timer);frame.remove();};
  try{
   const doc=frame.contentDocument,win=frame.contentWindow;if(!doc||!win)throw Error('Không mở được khung in. Vui lòng thử lại.');
   doc.open();doc.write('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Bill tạm tính DPA</title></head><body></body></html>');doc.close();
   const base=doc.createElement('base');base.href=document.baseURI;doc.head.appendChild(base);
   const layout=doc.createElement('style');layout.textContent=css;doc.head.appendChild(layout);
   const clone=paper.cloneNode(true);doc.body.appendChild(clone);
   await doc.fonts.ready;
   await Promise.all(Array.from(clone.querySelectorAll('img')).map(async img=>{
    if(img.complete){if(!img.naturalWidth)throw Error('Mã QR chưa tải được. Vui lòng thử lại.');return;}
    await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{done();reject(Error('Mã QR chưa tải xong. Vui lòng thử lại.'));},15000);const done=()=>{clearTimeout(timeout);img.removeEventListener('load',loaded);img.removeEventListener('error',failed);};const loaded=()=>{done();resolve();};const failed=()=>{done();reject(Error('Mã QR chưa tải được. Vui lòng thử lại.'));};img.addEventListener('load',loaded,{once:true});img.addEventListener('error',failed,{once:true});});
   }));
   await frames(win);
   const page=doc.createElement('style');doc.head.appendChild(page);
   const measure=()=>{const px=Math.max(clone.scrollHeight,clone.getBoundingClientRect().height);page.textContent='@page{size:80mm '+Math.ceil(px*25.4/96+4)+'mm;margin:0}';};
   measure();win.addEventListener('beforeprint',measure);win.addEventListener('afterprint',cleanup,{once:true});
   await frames(win);timer=setTimeout(cleanup,300000);win.focus();win.print();
  }catch(error){cleanup();throw error;}
 }
 document.addEventListener('keydown',event=>{
  if(!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='p')return;
  const button=document.querySelector('.checkout-bill-overlay .checkout-bill-print-actions .primary-btn');
  if(button){event.preventDefault();event.stopImmediatePropagation();button.click();}
 },true);
 document.addEventListener('click',async event=>{
  const button=event.target instanceof Element?event.target.closest('.checkout-bill-print-actions .primary-btn'):null;
  if(!button)return;const overlay=button.closest('.checkout-bill-overlay'),paper=overlay?.querySelector('.checkout-bill-paper');if(!paper)return;
  event.preventDefault();event.stopImmediatePropagation();if(active.has(overlay)||button.disabled)return;
  active.add(overlay);button.disabled=true;const label=button.textContent;button.textContent='Đang chuẩn bị bill…';overlay.querySelector('[data-continuous-bill-error]')?.remove();
  try{await printPaper(paper);}catch(error){const message=document.createElement('p');message.dataset.continuousBillError='true';message.className='form-error checkout-bill-print-error';message.setAttribute('role','alert');message.textContent=error instanceof Error?error.message:'Chưa chuẩn bị được bill. Vui lòng thử lại.';button.parentElement.after(message);}
  finally{button.disabled=false;button.textContent=label;active.delete(overlay);}
 },true);
})();
