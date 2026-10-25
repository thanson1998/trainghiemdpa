// Read-only full-menu view. Reads the rendered ticket; never saves or fetches data.
(()=>{
 let active=null;
 const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const text=(root,selector)=>root.querySelector(selector)?.textContent.trim()||'';
 const cash=value=>{const n=Number(String(value).replace(/[,\s]/g,''));return value!==''&&Number.isFinite(n)?new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(n).replaceAll('.',',')+' ₫':'Chưa nhập';};
 function open(cart,trigger){
  if(active)return;
  const rows=[...cart.querySelectorAll('.pos-cart-item')];
  const previous=document.activeElement,oldOverflow=document.body.style.overflow;
  const dialog=make('section','pos-menu-overview');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','menu-overview-title');
  const header=make('header'),heading=make('div'),title=make('h2','',`Toàn bộ menu · ${rows.length} món`);title.id='menu-overview-title';
  heading.append(make('small','',text(cart,'.pos-cart-head>div:first-child>span')),title,make('p','',[text(cart,'.pos-cart-head h2'),cart.querySelector('.pos-customer input')?.value||text(cart,'.pos-cart-customer')].filter(Boolean).join(' · ')));
  const close=make('button','secondary-btn','Đóng · Esc');close.type='button';header.append(heading,close);
  const frame=make('div','pos-menu-overview-frame'),paper=make('div','pos-menu-overview-paper'),grid=make('div','pos-menu-overview-grid');frame.append(paper);
  const set=cart.querySelector('.pos-set');if(set)paper.append(make('p','pos-menu-overview-set',[text(set,'b'),(set.querySelector('input')?.value||'1')+' set',text(set,':scope>span')].filter(Boolean).join(' · ')));
  rows.forEach((row,index)=>{
   const item=make('article','pos-menu-overview-item'),name=make('div','pos-menu-overview-name');name.append(make('span','',String(index+1)),make('b','',(text(row,'.pos-item-name>b')||text(row,'.pos-item-title>b')).replace(/^\d+\.\s*/,'')));
   const amount=make('div','pos-menu-overview-amounts'),included=!!row.querySelector('.pos-included');
   const quantity=row.querySelector('.pos-quantity input')?.value||'1',unit=text(row,'.pos-item-unit'),price=row.querySelector('.pos-item-controls>input')?.value||'';
   [['Số lượng',quantity+' '+unit],['Đơn giá',included?'Trong set':cash(price)],['Thành tiền',included?'Trong set':text(row,'.pos-item-controls>strong')||'Chưa nhập']].forEach(([label,value],i)=>{const cell=make('span');cell.append(make('small','',label),make(i===2?'strong':'b','',value));amount.append(cell);});
   item.append(name,amount);const note=row.querySelector('.pos-item-extras input')?.value||text(row,'.pos-item-note-summary');if(note)item.append(make('p','pos-menu-overview-note','Ghi chú: '+note));grid.append(item);
  });
  paper.append(grid);if(!rows.length)paper.append(make('p','','Phiếu chưa có món ăn.'));
  const note=cart.querySelector('.pos-order-note textarea')?.value;if(note)paper.append(make('p','pos-menu-overview-order-note','Ghi chú cho bếp: '+note));
  const footer=make('footer');cart.querySelectorAll('.pos-cart-footer .pos-amount').forEach(row=>{const cell=make('span');cell.append(make('span','',text(row,'span')),make(row.classList.contains('due')?'strong':'b','',text(row,'strong')||text(row,'b')));footer.append(cell);});
  dialog.append(header,frame,footer);document.body.append(dialog);document.body.style.overflow='hidden';active=dialog;close.focus();
  let raf=0,closed=false;const fit=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(closed)return;const cols=frame.clientWidth>=1050&&rows.length>18?3:frame.clientWidth>=700&&rows.length>6?2:1;paper.style.setProperty('--menu-overview-columns',String(cols));paper.style.transform='scale('+Math.min(1,frame.clientHeight/Math.max(1,paper.scrollHeight))+')';});};
  const observer=new ResizeObserver(fit);observer.observe(frame);observer.observe(paper);fit();void document.fonts.ready.then(fit);
  const dismiss=()=>{closed=true;cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('keydown',key);dialog.remove();document.body.style.overflow=oldOverflow;active=null;if(previous?.isConnected)previous.focus();else if(trigger.isConnected)trigger.focus();};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();dismiss();}if(e.key==='Tab'){e.preventDefault();close.focus();}};close.addEventListener('click',dismiss);document.addEventListener('keydown',key);
 }
 const attach=()=>{document.querySelectorAll('.pos-cart-head').forEach(head=>{if(head.querySelector('.pos-menu-overview-open'))return;const cart=head.closest('.pos-cart'),button=make('button','secondary-btn pos-menu-overview-open','Xem toàn bộ menu');button.type='button';button.addEventListener('click',()=>open(cart,button));head.append(button);});};
 const observer=new MutationObserver(attach);observer.observe(document.body,{subtree:true,childList:true});attach();
})();
