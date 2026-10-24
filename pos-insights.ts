import {orderUnits,type Booking} from './model';
import {readMenu,itemQuantity,itemUnit,type MenuItem} from './menu';
import {kitchenDelta} from './kitchen-delta';
const fold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().trim().replace(/\s+/g,' ');
export function selectedQuantity(items:MenuItem[],name:string){return Math.round(items.filter(i=>fold(i.name)===fold(name)).reduce((n,i)=>n+itemQuantity(i),0)*100)/100;}
export function kitchenState(b:Booking,last:Booking|null|undefined){
 const items=readMenu(b.menu,orderUnits(b));
 if(last===undefined)return {tone:'neutral',label:'Đang kiểm tra bếp',count:0,pending:false};
 if(!items.length&&!last)return {tone:'neutral',label:'Chưa có món',count:0,pending:false};
 if(!last)return {tone:'warning',label:`${items.length} món chưa gửi bếp`,count:items.length,pending:true};
 const delta=kitchenDelta(last,b),keys=new Set([...delta.added,...delta.removed].map(i=>fold(i.name)+'|'+i.unit));
 return delta.changed?{tone:'warning',label:keys.size?`${keys.size} món thay đổi chưa gửi bếp`:'Ghi chú / thông tin chưa báo bếp',count:keys.size,pending:true}:{tone:'success',label:'Đã xác nhận gửi bếp',count:0,pending:false};
}
export function servedProgress(b:Booking){const items=readMenu(b.menu,orderUnits(b));return {done:items.filter(i=>(i.served??0)>=itemQuantity(i)).length,total:items.length};}
export function cashSuggestions(due:number){return [...new Set([due,...[50000,100000,200000,500000,1000000].map(step=>Math.ceil(due/step)*step)])].filter(n=>n>=due&&n<=5000000000).slice(0,5);}
export type BankSettings={bankId:string;account:string;name:string;version:number};
export function transferQr(bank:BankSettings,due:number,code:string){
 if(!/^\d{6}$/.test(bank.bankId)||!/^\d{6,30}$/.test(bank.account)||!bank.name.trim()||!Number.isSafeInteger(due)||due<=0)return '';
 const query=new URLSearchParams({amount:String(due),addInfo:code.replace(/[^a-zA-Z0-9 -]/g,'').slice(0,40),accountName:bank.name});
 return `https://img.vietqr.io/image/${bank.bankId}-${bank.account}-compact2.png?${query}`;
}
