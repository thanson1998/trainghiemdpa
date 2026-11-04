// Compatibility for previously published bundles; keep React-owned nodes intact.
(()=>{
 const update=()=>document.querySelectorAll('.menu-print-sheet').forEach(sheet=>{
  const dishes=sheet.querySelector('.menu-print-dishes'),heading=dishes?.querySelector('h3'),set=dishes?.querySelector('.menu-print-set-name');
  const sets=Array.from(dishes?.querySelectorAll('.menu-print-set-name')??[]);
  const lines=sets.flatMap(row=>row.textContent.split(/\s+\+\s+(?=\d+\s*[×x])/u)).map(text=>{
   const leading=text.match(/^\s*(\d+)\s*[×x]\s*(.+)$/u),trailing=text.match(/^(.+?)\s*[·•]?\s+(\d+)\s*set\s*$/iu);
   return leading?{name:leading[2].replace(/\s*[·•]\s*\d+\s*set\s*$/iu,'').trim(),count:Number(leading[1])}:trailing?{name:trailing[1].replace(/[\s·•]+$/u,''),count:Number(trailing[2])}:{name:text.trim(),count:1};
  });
  const quantity=set?.textContent.match(/(\d+)\s*set\s*$/i);
  if(heading&&set&&quantity){
   let badge=heading.querySelector('.menu-print-set-quantity');
   if(!badge){badge=document.createElement('span');badge.className='menu-print-set-quantity';heading.appendChild(badge);}
   const text='S\u1ed1 set: '+lines.reduce((sum,line)=>sum+line.count,0);if(badge.textContent!==text)badge.textContent=text;
   let caption=dishes.querySelector('.menu-print-set-caption');
   if(!caption){caption=document.createElement('p');caption.className='menu-print-set-caption';set.after(caption);}
   const name=lines.map(line=>line.count+' × '+line.name).join('\n+ ');
   if(caption.textContent!==name)caption.textContent=name;
   sets.forEach(row=>row.classList.add('menu-print-set-relocated'));
   // Presentation only: old mixed orders leave the first set's dishes unlabelled.
   const firstName=/lẩu/iu.test(lines[0]?.name??'')?'Lẩu':lines[0]?.name;
   dishes.querySelectorAll('li').forEach(row=>{
    if(!row.querySelector('.dish-print-included'))return;
    const description=row.querySelector('p');if(!description||!firstName)return;
    const existing=Array.from(description.querySelectorAll('.dish-print-note')).some(note=>!note.dataset.generatedSet&&/Set\s*:/iu.test(note.textContent));
    let label=description.querySelector('[data-generated-set]');
    if(existing){label?.remove();return;}
    if(!label){label=document.createElement('small');label.className='dish-print-note';label.dataset.generatedSet='true';description.appendChild(label);}
    const text='Set: '+firstName;if(label.textContent!==text)label.textContent=text;
   });
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
