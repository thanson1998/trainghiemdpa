export type MenuItem={name:string;price:number|null;quantity?:number;unit?:string;included?:boolean;category?:string};
export type MenuSet={name:string;pricePerTable:number;people?:number;quantity?:number};
const prefix='DPA_MENU_V1:';
const setPrefix='DPA_MENU_V2:';
export function readMenuSet(value:string):MenuSet|undefined{
 if(!value.startsWith(setPrefix))return;
 try{return JSON.parse(value.slice(setPrefix.length)).set;}catch{return;}
}
export const menuSetQuantity=(value:string,tableCount=1)=>readMenuSet(value)?.quantity??tableCount;
export const hasPricedMenu=(value:string)=>!!readMenuSet(value)||readMenu(value).some(item=>item.name.trim()&&item.price!==null);
export const itemQuantity=(item:MenuItem)=>item.quantity??1;
export const normalizeUnit=(unit?:string)=>!unit?.trim()||unit.trim().normalize('NFC').toLocaleLowerCase('vi')==='phần'?'đĩa':unit.trim();
export const itemUnit=(item:MenuItem)=>normalizeUnit(item.unit);
export const itemAmount=(item:MenuItem)=>Math.round((item.price??0)*itemQuantity(item));
export function readMenu(value:string,tableCount=1,expandSet=true):MenuItem[]{
 if(value.startsWith(prefix)||value.startsWith(setPrefix)){
  try{const parsed=JSON.parse(value.slice(value.startsWith(setPrefix)?setPrefix.length:prefix.length));const items=Array.isArray(parsed)?parsed:parsed.items;if(Array.isArray(items))return items.map(item=>({name:typeof item?.name==='string'?item.name:'',price:typeof item?.price==='number'?item.price:null,...(item?.quantity!==undefined?{quantity:item.quantity}:{}),...(item?.unit!==undefined?{unit:normalizeUnit(item.unit)}:{}),...(typeof item?.category==='string'?{category:item.category.trim()}:{}),...(value.startsWith(setPrefix)&&item?.included?{included:true,quantity:(item.quantity??1)*(expandSet&&readMenuSet(value)?.quantity===undefined?tableCount:1)}:{})}));}catch{/* Rejected on save. */}
  return [];
 }
 return value.split(/\r?\n/).map(name=>name.trim()).filter(Boolean).map(name=>({name,price:null}));
}
export function setMenuQuantity(value:string,quantity:number,tableCount=1):string{
 const set=readMenuSet(value);if(!set||!Number.isInteger(quantity)||quantity<1||quantity>1000)throw new Error('Số lượng set phải từ 1 đến 1.000.');
 const previous=menuSetQuantity(value,tableCount);
 const items=readMenu(value,tableCount).map(item=>item.included?{...item,quantity:Math.round(itemQuantity(item)*quantity/previous*100)/100}:item);
 const next=writeMenu(items,{...set,quantity});if(!validMenu(next))throw new Error('Số lượng món sau khi nhân set phải từ 0,01 đến 1.000.');return next;
}
// Keep the first row's edited price and unit when the same dish is added again.
export function mergeMenuItems(items:MenuItem[]):MenuItem[]{
 const merged:MenuItem[]=[],indices=new Map<string,number>();
 for(const item of items){
  const key=item.name.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi-VN');
  const index=key?indices.get(key):undefined;
  if(index===undefined){if(key)indices.set(key,merged.length);merged.push({...item});continue;}
  if(!!merged[index].included!==!!item.included)throw new Error('Món này đã nằm trong set. Hãy đặt tên phân biệt cho món gọi thêm ngoài giá set, ví dụ Gà gọi thêm.');
  const quantity=Math.round((itemQuantity(merged[index])+itemQuantity(item))*100)/100;
  if(quantity>1000)throw new Error('Tổng số lượng của một món không được vượt quá 1.000.');
  merged[index]={...merged[index],quantity};
 }
 return merged;
}
const normalizeItemUnit=(item:MenuItem)=>item.unit!==undefined?{...item,unit:normalizeUnit(item.unit)}:item;
export const writeMenu=(items:MenuItem[],set?:MenuSet)=>set?setPrefix+JSON.stringify({items:items.map(normalizeItemUnit),set}):prefix+JSON.stringify(items.map(normalizeItemUnit));
export function validMenu(value:string):boolean{
 if(value.startsWith(setPrefix)){
  try{
   const data=JSON.parse(value.slice(setPrefix.length)),set=data.set;
   return !!set&&typeof set.name==='string'&&set.name.trim().length>0&&set.name.length<=100&&Number.isInteger(set.pricePerTable)&&set.pricePerTable>=0&&set.pricePerTable<=100000000&&(set.people===undefined||(Number.isInteger(set.people)&&set.people>=1&&set.people<=1000))&&(set.quantity===undefined||(Number.isInteger(set.quantity)&&set.quantity>=1&&set.quantity<=1000))&&Array.isArray(data.items)&&data.items.some((item:MenuItem)=>item?.included&&item.name?.trim())&&data.items.every((item:MenuItem)=>item.included===undefined||typeof item.included==='boolean')&&data.items.every((item:MenuItem)=>!item.included||item.price===null)&&validMenu(prefix+JSON.stringify(data.items));
  }catch{return false;}
 }
 if(!value.startsWith(prefix))return value.length<=4000;
 try{
  const items=JSON.parse(value.slice(prefix.length));
  return Array.isArray(items)&&items.length<=80&&items.every(item=>item&&typeof item.name==='string'&&item.name.length<=200&&(item.price===null||(typeof item.price==='number'&&Number.isInteger(item.price)&&item.price>=0&&item.price<=100000000))&&(item.quantity===undefined||(typeof item.quantity==='number'&&Number.isFinite(item.quantity)&&item.quantity>0&&item.quantity<=1000&&Math.abs(item.quantity*100-Math.round(item.quantity*100))<0.000001))&&(item.unit===undefined||(typeof item.unit==='string'&&item.unit.length<=30))&&(item.category===undefined||(typeof item.category==='string'&&item.category.trim().length>0&&item.category.length<=60))&&(item.name.trim().length>0||item.price===null));
 }catch{return false}
}
export const formatMoneyText=(text:string)=>text.replace(/\b\d{1,3}(?:\.\d{3})+(?=\s*(?:đ|₫|VNĐ|VND|đồng))/gi,value=>value.replace(/\./g,','));
const currency=(value:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(value).replace(/\./g,',');
export const menuText=(value:string)=>readMenu(value).filter(item=>item.name.trim()).map(item=>item.name+' · '+itemQuantity(item)+' '+itemUnit(item)+(item.price===null?'':' × '+currency(item.price)+' = '+currency(itemAmount(item)))).join('\n');
export const menuSum=(value:string,tableCount=1)=>(readMenuSet(value)?.pricePerTable??0)*menuSetQuantity(value,tableCount)+readMenu(value).filter(item=>item.name.trim()&&!item.included).reduce((total,item)=>total+itemAmount(item),0);

export const formatUnitPrice=(value:number|null)=>value===null?'':new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(value);
export function parseUnitPrice(value:string,max=100000000):number|null|undefined{
 if(!/^[\d,\s]*$/.test(value))return undefined;
 const digits=value.replace(/[,\s]/g,'');if(!digits)return null;
 const amount=Number(digits);return Number.isSafeInteger(amount)&&amount<=max?amount:undefined;
}

export const pricePerSelectedTable=(value:string,count:number)=>count>0?Math.round(menuSum(value,count)/count):0;

