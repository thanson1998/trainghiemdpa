// Update POS geometry only when its content or dimensions change.
(()=>{
 let raf=0;const observed=new Set();
 const schedule=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;fit();});};
 const observer=new ResizeObserver(schedule);
 const set=(element,key,value)=>{if(element.style.getPropertyValue(key)!==value)element.style.setProperty(key,value);};
 function fit(){
  const carts=[...document.querySelectorAll('.pos-cart')],targets=new Set(),updates=[];
  for(const cart of carts){
   const root=cart.closest('.pos-workbench');if(!root)continue;
   const catalog=root.querySelector('.pos-catalog'),catalogHead=catalog?.querySelector('.pos-catalog-header'),info=cart.querySelector('.pos-ticket-info'),head=cart.querySelector('.pos-cart-head'),body=cart.querySelector('.pos-cart-body'),list=cart.querySelector('.pos-cart-items');
   for(const node of [root,catalog,catalogHead,info,head,body])if(node)targets.add(node);
   // Collect all layout reads before applying style writes.
   const values=[];
   if(catalog){values.push(['--pos-catalog-width',catalog.clientWidth+'px']);if(catalogHead)values.push(['--pos-catalog-head-height',catalogHead.offsetHeight+'px']);}
   if(info){values.push(['--pos-inline-info-height',info.offsetHeight+'px']);if(head){const h=head.getBoundingClientRect(),i=info.getBoundingClientRect(),options=cart.querySelector('.pos-menu-options'),toolsHeight=Math.max(30,options?.offsetHeight||0);values.push(['--pos-header-tools-height',toolsHeight+'px'],['--pos-service-left',(h.left-i.left+10)+'px'],['--pos-menu-actions-left',(h.left-i.left+160)+'px'],['--pos-menu-actions-width',Math.max(150,h.width-170)+'px'],['--pos-service-top',(h.bottom-i.top-toolsHeight-6)+'px']);}}
   updates.push({root,values,list,count:list?String(list.querySelectorAll('.pos-cart-item').length):'',buttons:[...cart.querySelectorAll('.pos-menu-options button')]});
  }
  for(const node of observed)if(!targets.has(node)){observer.unobserve(node);observed.delete(node);}
  for(const node of targets)if(!observed.has(node)){observed.add(node);observer.observe(node);}
  for(const update of updates){for(const [key,value] of update.values)set(update.root,key,value);for(const button of update.buttons){const label=button.textContent.trim();if(label&&button.getAttribute('aria-label')!==label)button.setAttribute('aria-label',label);}if(update.list){if(update.list.style.getPropertyValue('--pos-menu-scale'))update.list.style.removeProperty('--pos-menu-scale');if(update.list.style.getPropertyValue('--pos-menu-columns'))update.list.style.removeProperty('--pos-menu-columns');if(update.list.dataset.visibleMenuCount!==update.count)update.list.dataset.visibleMenuCount=update.count;}}
  document.querySelectorAll('.pos-menu-overview-open').forEach(node=>node.remove());
 }
 const relevant=record=>record.target instanceof Element&&!!record.target.closest('.pos-cart')||[...record.addedNodes,...record.removedNodes].some(node=>node instanceof Element&&(node.matches('.pos-workbench,.pos-cart')||node.querySelector('.pos-cart')));
 new MutationObserver(records=>{if(records.some(relevant))schedule();}).observe(document.body,{childList:true,subtree:true,characterData:true});
 const changed=event=>{if(event.target instanceof Element&&event.target.closest('.pos-cart,.pos-catalog'))schedule();};
 for(const event of ['input','change','toggle'])document.addEventListener(event,changed,true);
 window.addEventListener('resize',schedule);void document.fonts.ready.then(schedule);schedule();
})();
