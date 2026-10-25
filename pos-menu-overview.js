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
   if(info)root.style.setProperty('--pos-inline-info-height',info.offsetHeight+'px');
   if(body&&!observed.has(body)){observed.add(body);observer.observe(body);}
   if(!list)return;
   if(!matchMedia('(min-width:801px)').matches){list.style.removeProperty('--pos-menu-scale');list.style.removeProperty('--pos-menu-columns');return;}
   const count=list.querySelectorAll('.pos-cart-item').length;
   const columns=1;
   list.style.setProperty('--pos-menu-columns',String(columns));
   // Find the largest scale that fits, including names that wrap as width changes.
   const available=Math.max(1,list.clientHeight-3);
   const rows=[...list.querySelectorAll('.pos-cart-item')];
   let low=0,high=1,scale=1;
   for(let step=0;step<12;step++){
    list.style.setProperty('--pos-menu-scale',String(scale));
    const needed=Math.max(1,...rows.map(row=>row.offsetTop+row.offsetHeight));
    if(needed*scale<=available){low=scale;if(scale===1)break;}else high=scale;
    scale=(low+high)/2;
   }
   list.style.setProperty('--pos-menu-scale',String(Math.max(.01,low)));
   list.dataset.visibleMenuCount=String(count);
  });
 }
 new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true});
 for(const event of ['pointerover','pointerout','focusin','focusout'])document.addEventListener(event,schedule,true);
 document.addEventListener('input',schedule,true);document.addEventListener('change',schedule,true);document.addEventListener('toggle',schedule,true);window.addEventListener('resize',schedule);
 void document.fonts.ready.then(schedule);schedule();
})();
