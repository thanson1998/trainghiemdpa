// Compatibility for previously published bundles; keep React-owned nodes intact.
(()=>{
 const update=()=>document.querySelectorAll('.menu-print-sheet').forEach(sheet=>{
  const original=sheet.querySelector('.menu-print-facts>div:nth-child(2)');
  const location=sheet.querySelector('.menu-print-location');
  if(!original||!location)return;
  let time=location.querySelector('.menu-print-service-time');
  if(!time){time=document.createElement('dl');time.className='menu-print-service-time';location.appendChild(time);}
  if(time.textContent!==original.textContent)time.replaceChildren(...Array.from(original.children,node=>node.cloneNode(true)));
 });
 new MutationObserver(update).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 update();
})();
