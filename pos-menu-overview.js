// Fit the existing editable menu in place; never clone, save or fetch order data.
(()=>{
 let raf=0;const observed=new WeakSet();
 const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(fit);};
 const observer=new ResizeObserver(schedule);
 function fit(){
  document.querySelectorAll('.pos-menu-overview-open').forEach(e=>e.remove());
  document.querySelectorAll('.pos-cart').forEach(cart=>{
   const body=cart.querySelector('.pos-cart-body'),list=cart.querySelector('.pos-cart-items'),root=cart.closest('.pos-workbench'),catalog=root?.querySelector('.pos-catalog'),info=cart.querySelector('.pos-ticket-info');
   if(catalog){root.style.setProperty('--pos-catalog-width',catalog.clientWidth+'px');root.style.setProperty('--pos-catalog-head-height',catalog.querySelector('.pos-catalog-header').offsetHeight+'px');}
   if(info){
    root.style.setProperty('--pos-inline-info-height',info.offsetHeight+'px');
    const head=cart.querySelector('.pos-cart-head');
    if(head){const h=head.getBoundingClientRect(),i=info.getBoundingClientRect();
     const options=cart.querySelector('.pos-menu-options');
     options?.querySelectorAll('button').forEach(button=>{
      const label=button.textContent.trim();
      if(label&&button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);
     });
     const toolsHeight=Math.max(30,options?.offsetHeight||0);
     root.style.setProperty('--pos-header-tools-height',toolsHeight+'px');
     root.style.setProperty('--pos-service-left',(h.left-i.left+10)+'px');
     root.style.setProperty('--pos-menu-actions-left',(h.left-i.left+160)+'px');
     root.style.setProperty('--pos-menu-actions-width',Math.max(150,h.width-170)+'px');
     root.style.setProperty('--pos-service-top',(h.bottom-i.top-toolsHeight-6)+'px');
    }
   }
   if(body&&!observed.has(body)){observed.add(body);observer.observe(body);}
   if(!list)return;
   list.style.removeProperty('--pos-menu-scale');
   list.style.removeProperty('--pos-menu-columns');
   list.dataset.visibleMenuCount=String(list.querySelectorAll('.pos-cart-item').length);
  });
 }
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
 for(const event of ['pointerover','pointerout','focusin','focusout'])document.addEventListener(event,schedule,true);
 document.addEventListener('input',schedule,true);document.addEventListener('change',schedule,true);document.addEventListener('toggle',schedule,true);window.addEventListener('resize',schedule);
 void document.fonts.ready.then(schedule);schedule();
})();
