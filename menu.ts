export type MenuItem={name:string;price:number|null};
const prefix='DPA_MENU_V1:';
export function readMenu(value:string):MenuItem[]{
 if(value.startsWith(prefix)){
  try{const items=JSON.parse(value.slice(prefix.length));if(Array.isArray(items))return items.map(item=>({name:typeof item?.name==='string'?item.name:'',price:typeof item?.price==='number'?item.price:null}));}catch{/* Invalid structured input is rejected on save. */}
  return [];
 }
 return value.split(/\r?\n/).map(name=>name.trim()).filter(Boolean).map(name=>({name,price:null}));
}
export const writeMenu=(items:MenuItem[])=>prefix+JSON.stringify(items);
export function validMenu(value:string):boolean{
 if(!value.startsWith(prefix))return value.length<=4000;
 try{
  const items=JSON.parse(value.slice(prefix.length));
  return Array.isArray(items)&&items.length<=80&&items.every(item=>item&&typeof item.name==='string'&&item.name.length<=200&&(item.price===null||(typeof item.price==='number'&&Number.isInteger(item.price)&&item.price>=0&&item.price<=100000000))&&(item.name.trim().length>0||item.price===null));
 }catch{return false}
}
export const menuText=(value:string)=>readMenu(value).filter(item=>item.name.trim()).map(item=>item.name+(item.price===null?'':' – '+new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(item.price))).join('\n');
export const menuSum=(value:string)=>readMenu(value).filter(item=>item.name.trim()).reduce((total,item)=>total+(item.price??0),0);
