// Progressive enhancement for older published clients. Original form controls
// stay in React's tree; the compact controls forward edits through their events.
(()=>{
 const cache=new WeakMap();let frame=0;
 const caption=label=>Array.from(label.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;sync();});};
 function sync(){
  document.querySelectorAll('.pos-cart').forEach(cart=>{
   cart.querySelectorAll('.pos-cart-head button').forEach(button=>{if(['Chọn bàn','Tại quán / chọn bàn'].includes(button.textContent.trim())&&!button.classList.contains('pos-hidden-table-picker'))button.classList.add('pos-hidden-table-picker');});
   const details=cart.querySelector('.pos-details'),meta=cart.querySelector('.pos-ticket-meta'),more=cart.querySelector('.pos-add-inline'),customer=cart.querySelector('.pos-customer');
   if(!details||!meta||!more||!customer)return;
   const labels=Array.from(details.querySelectorAll('.pos-fields>label'));
   const find=text=>labels.find(label=>caption(label)===text);
   if(!find('Ngày đặt')||!find('Bắt đầu')||!find('Kết thúc')||!find('Cách tính giá'))return;
   let state=cache.get(cart);
   if(!state){
    const dates=document.createElement('fieldset');dates.className='pos-inline-schedule';meta.appendChild(dates);
    const pricing=document.createElement('fieldset');pricing.className='pos-inline-pricing';more.before(pricing);
    const tools=document.createElement('div');tools.className='pos-inline-order-tools';more.before(tools);
    const mode=document.createElement('fieldset');mode.className='pos-header-price-mode';cart.querySelector('.pos-cart-view-actions')?.appendChild(mode);
    state={dates,pricing,tools,mode,pairs:new Map(),buttons:new Map()};cache.set(cart,state);
    meta.querySelector('span')?.classList.add('pos-legacy-schedule-text');
    cart.classList.add('pos-cart-refined');cart.dataset.posEditorUpgraded='true';
   }
   const cloneField=(key,original,title,aria)=>{
    const control=original?.querySelector('input,select');if(!control)return;
    let pair=state.pairs.get(key);
    if(!pair){
     const label=document.createElement('label');label.appendChild(document.createTextNode(title));
     const input=control.cloneNode(true);input.removeAttribute('id');input.setAttribute('aria-label',aria);label.appendChild(input);
     pair={label,input,original:control};state.pairs.set(key,pair);
     const edit=()=>{
      const target=pair.original;if(!target?.isConnected||target.matches(':disabled')||target.readOnly)return;
      const proto=target instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto,'value').set.call(target,input.value);
      target.dispatchEvent(new Event(target instanceof HTMLSelectElement?'change':'input',{bubbles:true}));schedule();
     };
     input.addEventListener('input',edit);input.addEventListener('change',edit);
     input.addEventListener('focusout',()=>{
      if(pair.original?.isConnected)pair.original.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));schedule();
     });
    }
    pair.original=control;
    if(pair.label.firstChild.textContent!==title)pair.label.firstChild.textContent=title;
    const disabled=control.matches(':disabled');if(pair.input.disabled!==disabled)pair.input.disabled=disabled;
    if(document.activeElement!==pair.input&&pair.input.value!==control.value)pair.input.value=control.value;
    return pair.label;
   };
   const arrange=(parent,nodes)=>{
    nodes=nodes.filter(Boolean);
    for(const node of Array.from(parent.children))if(!nodes.includes(node))node.remove();
    nodes.forEach((node,index)=>{if(parent.children[index]!==node)parent.insertBefore(node,parent.children[index]??null);});
   };
   arrange(state.dates,[cloneField('date',find('Ngày đặt'),'Ngày phục vụ','Ngày phục vụ POS'),cloneField('start',find('Bắt đầu'),'Bắt đầu','Giờ bắt đầu POS'),cloneField('end',find('Kết thúc'),'Kết thúc','Giờ kết thúc POS')]);
   const phone=cloneField('phone',find('Số điện thoại'),'Điện thoại','Số điện thoại POS');
   if(phone&&phone.parentElement!==customer){phone.className='pos-ticket-phone';customer.appendChild(phone);}
   const agreed=labels.find(label=>caption(label).startsWith('Giá đã chốt /'));
   arrange(state.mode,[cloneField('mode',find('Cách tính giá'),'Cách tính giá','Cách tính giá POS')]);
   arrange(state.pricing,[cloneField('agreed',agreed,agreed?caption(agreed):'Giá đã chốt / bàn','Giá chốt POS mỗi bàn'),cloneField('deposit',find('Đã cọc'),'Đã cọc','Tiền cọc POS'),cloneField('status',find('Trạng thái'),'Trạng thái','Trạng thái POS')]);
   const tools=Array.from(details.querySelectorAll('button')).map(original=>{
    const name=original.textContent.trim();let button=state.buttons.get(name);
    if(!button){button=document.createElement('button');button.type='button';button.className='text-btn';button.textContent=name;button.addEventListener('click',()=>button.source?.click());state.buttons.set(name,button);}
    button.source=original;const disabled=original.matches(':disabled');if(button.disabled!==disabled)button.disabled=disabled;return button;
   });arrange(state.tools,tools);
  });
 }
 new MutationObserver(records=>{if(records.some(record=>record.target instanceof Element&&record.target.closest('.pos-cart')||Array.from(record.addedNodes).some(node=>node instanceof Element&&(node.matches('.pos-cart')||node.querySelector('.pos-cart')))))schedule();}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['value','disabled','selected']});
 schedule();
})();
