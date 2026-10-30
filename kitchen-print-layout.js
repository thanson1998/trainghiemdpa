// Compatibility for previously published bundles; keep React-owned nodes intact.
(()=>{
 const update=()=>document.querySelectorAll('.menu-print-sheet').forEach(sheet=>{
  const dishes=sheet.querySelector('.menu-print-dishes'),heading=dishes?.querySelector('h3'),set=dishes?.querySelector('.menu-print-set-name');
  const quantity=set?.textContent.match(/(\d+)\s*set\s*$/i);
  if(heading&&set&&quantity){
   let badge=heading.querySelector('.menu-print-set-quantity');
   if(!badge){badge=document.createElement('span');badge.className='menu-print-set-quantity';heading.appendChild(badge);}
   const text='S\u1ed1 set: '+quantity[1];if(badge.textContent!==text)badge.textContent=text;
   let caption=dishes.querySelector('.menu-print-set-caption');
   if(!caption){caption=document.createElement('p');caption.className='menu-print-set-caption';set.after(caption);}
   const name=set.textContent.slice(0,quantity.index).replace(/[\s\u00b7\u2022]+$/u,'');
   if(caption.textContent!==name)caption.textContent=name;
   if(!set.classList.contains('menu-print-set-relocated'))set.classList.add('menu-print-set-relocated');
  }else{
   dishes?.querySelector('.menu-print-set-quantity')?.remove();dishes?.querySelector('.menu-print-set-caption')?.remove();
   set?.classList.remove('menu-print-set-relocated');
  }
  const original=sheet.querySelector('.menu-print-facts>div:nth-child(2)');
  const location=sheet.querySelector('.menu-print-location');
  if(!original||!location)return;
  let time=location.querySelector('.menu-print-service-time');
  if(!time){time=document.createElement('dl');time.className='menu-print-service-time';location.appendChild(time);}
  if(time.textContent!==original.textContent)time.replaceChildren(...Array.from(original.children,node=>node.cloneNode(true)));
  const zones=Array.from(location.children).filter(node=>node.tagName==='DIV'&&!node.classList.contains('menu-print-grouped-locations')&&node.querySelector('strong')&&node.querySelector('span')).map(node=>({name:node.querySelector('strong').textContent,tables:node.querySelector('span').textContent.split(/\s*[·•]\s*/).filter(Boolean).sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}))}));
  if(zones.length){
   let grouped=location.querySelector('.menu-print-grouped-locations');
   if(!grouped){grouped=document.createElement('div');grouped.className='menu-print-grouped-locations';grouped.dataset.generated='true';location.appendChild(grouped);}
   const signature=JSON.stringify(zones);
   if(grouped.dataset.generated==='true'&&grouped.dataset.signature!==signature){
    const nodes=zones.map(zone=>{
     const section=document.createElement('div');section.className='menu-print-grouped-zone';
     const title=document.createElement('strong');title.textContent='Vị trí bàn: '+zone.name;section.appendChild(title);
     const lines=document.createElement('div');lines.className='menu-print-table-lines';
     for(let i=0;i<zone.tables.length;i+=2){const row=document.createElement('span');row.textContent=zone.tables.slice(i,i+2).join(', ');lines.appendChild(row);}
     section.appendChild(lines);return section;
    });
    grouped.replaceChildren(...nodes);grouped.dataset.signature=signature;
   }
   if(!location.classList.contains('has-table-groups'))location.classList.add('has-table-groups');
  }
 });
 new MutationObserver(update).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 update();
})();
