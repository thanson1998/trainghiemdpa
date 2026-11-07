/* Download only the receipt, including content below the preview viewport. */
(()=>{'use strict';
 const libraryUrl=new URL('./payment-image-canvas.js',document.currentScript.src).href;
 let library;
 const loadCanvas=()=>library??=(new Promise((resolve,reject)=>{
  if(window.html2canvas){resolve(window.html2canvas);return;}
  const script=document.createElement('script');script.src=libraryUrl;
  script.onload=()=>window.html2canvas?resolve(window.html2canvas):reject(Error());
  script.onerror=()=>{library=undefined;script.remove();reject(Error());};document.head.appendChild(script);
 }));
 const icon='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/></svg>';
 const update=()=>document.querySelectorAll('.payment-backdrop .payment-print-actions').forEach(actions=>{
  if(actions.querySelector('.payment-save-image-button'))return;
  const print=actions.querySelector('.primary-btn');if(!print)return;
  const wrap=document.createElement('span');wrap.className='payment-save-image';
  const button=document.createElement('button');button.type='button';button.className='secondary-btn payment-save-image-button';button.innerHTML=icon+'<span>Lưu ảnh</span>';wrap.appendChild(button);print.after(wrap);
  button.addEventListener('click',async()=>{
   const dialog=actions.closest('.payment-receipt-dialog'),paper=dialog?.querySelector('.payment-receipt');if(!paper||button.disabled)return;
   button.disabled=true;button.textContent='Đang tạo ảnh…';dialog.querySelector('.payment-image-notice')?.remove();
   const notice=document.createElement('p');notice.className='payment-image-notice';notice.setAttribute('role','status');
   try{
    await document.fonts.ready;
    const html2canvas=await loadCanvas(),width=paper.offsetWidth,height=Math.max(paper.scrollHeight,paper.offsetHeight);
    const canvas=await html2canvas(paper,{scale:Math.min(3,Math.sqrt(12000000/(width*height)),16000/height),backgroundColor:'#fff',logging:false,useCORS:true,scrollX:0,scrollY:0,onclone:(doc,clone)=>{
     doc.body.appendChild(clone);Object.assign(clone.style,{position:'absolute',left:'0',top:'0',width:width+'px',minWidth:width+'px',maxWidth:'none',height:'auto',maxHeight:'none',overflow:'visible',margin:'0',boxShadow:'none',transform:'none'});doc.body.style.overflow='visible';doc.documentElement.style.overflow='visible';
    }});
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error()),'image/png'));
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    const code=Array.from(paper.querySelectorAll('p')).map(p=>p.textContent.trim()).find(t=>/^DPA-/i.test(t))||'thanh-toan';
    link.href=url;link.download='DPA-hoa-don-'+code.replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,100)+'.png';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);notice.textContent='Đã tải ảnh hóa đơn PNG.';
   }catch{notice.textContent='Chưa lưu được ảnh. Vui lòng thử lại.';}
   finally{button.disabled=false;button.innerHTML=icon+'<span>Lưu ảnh</span>';if(dialog.isConnected)actions.after(notice);}
  });
 });
 new MutationObserver(update).observe(document.documentElement,{childList:true,subtree:true});update();
})();
