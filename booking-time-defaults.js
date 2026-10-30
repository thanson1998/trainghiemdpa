// Keep previously published Pages clients aligned with the current form behavior.
(()=>{
 const labelText=label=>label?.textContent.trim().replace(/\s*\(24h\)/gi,'')??'';
 const stripLabels=()=>document.querySelectorAll('label').forEach(label=>{
  if(!/^(Bắt đầu|Kết thúc)(?:\s*\(24h\))?$/.test(label.textContent.trim()))return;
  for(const node of label.childNodes)if(node.nodeType===3&&node.textContent.includes('(24h)'))node.textContent=node.textContent.replace(/\s*\(24h\)/g,'');
 });
 const update=target=>{
  if(!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement))return;
  if(!target.isConnected)return;
  const label=target.closest('label');
  const group=target.closest('.time-24-control');
  let value,endInputs;
  if(label&&labelText(label)==='Bắt đầu'){
   const scope=label.parentElement;
   const endLabel=[...scope.querySelectorAll('label')].find(x=>labelText(x)==='Kết thúc');
   value=target.value;endInputs=endLabel?[endLabel.querySelector('input')]:[];
  }else if(group?.getAttribute('aria-label')?.startsWith('Giờ bắt đầu')){
   const controls=group.querySelectorAll('select');
   value=controls[0].value+':'+controls[1].value;
   const endGroup=group.closest('.form-row')?.querySelector('.time-24-control[aria-label^="Giờ kết thúc"]');
   endInputs=endGroup?[...endGroup.querySelectorAll('select')]:[];
  }else return;
  if(/^\d{4}$/.test(value))value=value.slice(0,2)+':'+value.slice(2);
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return;
  const [h,m]=value.split(':').map(Number),minutes=Math.min(1439,h*60+m+180);
  const end=String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  endInputs.forEach((input,index)=>{
   if(!input||input.disabled||input.readOnly)return;
   const next=input instanceof HTMLSelectElement?end.split(':')[index]:end;
   if(input.value===next)return;
   const proto=input instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
   Object.getOwnPropertyDescriptor(proto,'value').set.call(input,next);
   input.dispatchEvent(new Event(input instanceof HTMLSelectElement?'change':'input',{bubbles:true}));
  });
 };
 const edited=new WeakSet();
 for(const name of ['input','change','focusout'])document.addEventListener(name,event=>{
  if(!event.target||typeof event.target!=='object')return;
  if(name==='focusout'){if(!edited.has(event.target))return;edited.delete(event.target);}else edited.add(event.target);
  queueMicrotask(()=>update(event.target));
 },true);
 new MutationObserver(records=>{if(records.some(record=>record.addedNodes.length))stripLabels();}).observe(document.documentElement,{childList:true,subtree:true});
 stripLabels();
})();
