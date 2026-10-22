export type MenuItem={name:string;price:number|null;quantity?:number;unit?:string};
const prefix='DPA_MENU_V1:';
export const itemQuantity=(item:MenuItem)=>item.quantity??1;
export const itemUnit=(item:MenuItem)=>item.unit?.trim()||'phần';
export const itemAmount=(item:MenuItem)=>Math.round((item.price??0)*itemQuantity(item));
export function readMenu(value:string):MenuItem[]{
 if(value.startsWith(prefix)){
  try{const items=JSON.parse(value.slice(prefix.length));if(Array.isArray(items))return items.map(item=>({name:typeof item?.name==='string'?item.name:'',price:typeof item?.price==='number'?item.price:null,...(item?.quantity!==undefined?{quantity:item.quantity}:{}),...(item?.unit!==undefined?{unit:item.unit}:{})}));}catch{/* Rejected on save. */}
  return [];
 }
 return value.split(/\r?\n/).map(name=>name.trim()).filter(Boolean).map(name=>({name,price:null}));
}
// Keep the first row's edited price and unit when the same dish is added again.
export function mergeMenuItems(items:MenuItem[]):MenuItem[]{
 const merged:MenuItem[]=[],indices=new Map<string,number>();
 for(const item of items){
  const key=item.name.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi-VN');
  const index=key?indices.get(key):undefined;
  if(index===undefined){if(key)indices.set(key,merged.length);merged.push({...item});continue;}
  const quantity=Math.round((itemQuantity(merged[index])+itemQuantity(item))*100)/100;
  if(quantity>1000)throw new Error('Tổng số lượng của một món không được vượt quá 1.000.');
  merged[index]={...merged[index],quantity};
 }
 return merged;
}
export const writeMenu=(items:MenuItem[])=>prefix+JSON.stringify(items);
export function validMenu(value:string):boolean{
 if(!value.startsWith(prefix))return value.length<=4000;
 try{
  const items=JSON.parse(value.slice(prefix.length));
  return Array.isArray(items)&&items.length<=80&&items.every(item=>item&&typeof item.name==='string'&&item.name.length<=200&&(item.price===null||(typeof item.price==='number'&&Number.isInteger(item.price)&&item.price>=0&&item.price<=100000000))&&(item.quantity===undefined||(typeof item.quantity==='number'&&Number.isFinite(item.quantity)&&item.quantity>0&&item.quantity<=1000&&Math.abs(item.quantity*100-Math.round(item.quantity*100))<0.000001))&&(item.unit===undefined||(typeof item.unit==='string'&&item.unit.length<=30))&&(item.name.trim().length>0||item.price===null));
 }catch{return false}
}
const currency=(value:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(value);
export const menuText=(value:string)=>readMenu(value).filter(item=>item.name.trim()).map(item=>item.name+' · '+itemQuantity(item)+' '+itemUnit(item)+(item.price===null?'':' × '+currency(item.price)+' = '+currency(itemAmount(item)))).join('\n');
export const menuSum=(value:string)=>readMenu(value).filter(item=>item.name.trim()).reduce((total,item)=>total+itemAmount(item),0);

export const formatUnitPrice=(value:number|null)=>value===null?'':new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value);
export function parseUnitPrice(value:string):number|null|undefined{
 if(!/^[\d,\s]*$/.test(value))return undefined;
 const digits=value.replace(/[,\s]/g,'');if(!digits)return null;
 const amount=Number(digits);return Number.isSafeInteger(amount)&&amount<=100000000?amount:undefined;
}

export const pricePerSelectedTable=(value:string,count:number)=>count>0?Math.round(menuSum(value)/count):0;
