import {redesignRestaurant} from './restaurant-layout';
export type Zone={id:string;title:string;sub:string;type:string;count:number;tables:string[];tableNames?:Record<string,string>;retired?:boolean};
const originalZones:Zone[] = [
 {id:'OUT',title:'Khu Bàn Đá',sub:'Ngoài trời',type:'outdoor',count:11,tables:Array.from({length:11},(_,i)=>String(i+7))},
 {id:'S3',title:'Sân nhà 3',sub:'Sân vườn',type:'patio',count:9,tables:Array.from({length:9},(_,i)=>`S3-0${i+1}`)},
 {id:'S2',title:'Sân nhà 2',sub:'Sân vườn',type:'patio',count:9,tables:Array.from({length:9},(_,i)=>`S2-0${i+1}`)},
 {id:'S1',title:'Sân nhà 1',sub:'Sân vườn',type:'patio',count:9,tables:Array.from({length:9},(_,i)=>`S1-0${i+1}`)},
 {id:'N3',title:'Trong nhà 3',sub:'Không gian trong nhà',type:'inside',count:4,tables:Array.from({length:4},(_,i)=>`N3-0${i+1}`)},
 {id:'N2',title:'Trong nhà 2',sub:'Không gian trong nhà',type:'inside',count:6,tables:Array.from({length:6},(_,i)=>`N2-0${i+1}`)},
 {id:'N1',title:'Trong nhà 1',sub:'Không gian trong nhà',type:'inside',count:6,tables:Array.from({length:6},(_,i)=>`N1-0${i+1}`)},
 {id:'NTC',title:'Nhà Tre Cao',sub:'Không gian trong nhà',type:'inside',count:6,tables:Array.from({length:6},(_,i)=>`NTC-${String(i+1).padStart(2,'0')}`)},
 {id:'NTD',title:'Nhà Tre Dưới',sub:'Không gian trong nhà',type:'inside',count:10,tables:Array.from({length:10},(_,i)=>`NTD-${String(i+1).padStart(2,'0')}`)},
 {id:'FRONT',title:'Trước quầy',sub:'Trước quầy thanh toán',type:'outdoor',count:3,tables:['20','19','18']},
];
export const defaultZones:Zone[]=redesignRestaurant(originalZones);
export const mapZones=(used:string[]=[])=>zones.filter(z=>!z.retired||z.tables.some(id=>used.includes(id)));
export const zones:Zone[]=defaultZones.map(z=>({...z,tables:[...z.tables]}));
export const tableIds=zones.flatMap(z=>z.tables);
export function applyZones(next:Zone[]){zones.splice(0,zones.length,...next.map(z=>({...z,tables:[...z.tables]})));tableIds.splice(0,tableIds.length,...zones.flatMap(z=>z.tables));}
export const customZone=(id:string)=>id==='NTC'||id==='NTD'||!defaultZones.some(z=>z.id===id);
export const zoneOf=(id:string)=>zones.find(z=>z.tables.includes(id))!;
// Storage IDs stay unique; only the visible label loses its zone prefix.
export const tableNumber=(id:string)=>{const custom=zoneOf(id)?.tableNames?.[id];if(custom)return custom;const number=id.match(/(?:^|-)(\d+)$/)?.[1];return number?String(Number(number)).padStart(2,'0'):id;};
export const tableNumbers=(ids:string[])=>ids.map(tableNumber).join(', ');
export function tableLocation(ids:string[]){
 const groups=new Map<string,string[]>();
 for(const id of ids){const key=zoneOf(id)?.title||defaultZones.find(z=>z.tables.includes(id))?.title||'Khu '+(id.includes('-')?id.slice(0,id.lastIndexOf('-')):'khác');groups.set(key,[...(groups.get(key)||[]),tableNumber(id)]);}
 return [...groups].map(([zone,numbers])=>zone+' · '+numbers.length+' vị trí').join(' | ');
}
export type Booking={id:string;paidAt?:string;orderCode?:string;serviceType?:'dine-in'|'takeaway';tableLabel?:string;date:string;start:string;end:string;name:string;phone:string;tables:string[];people:number;totalPeople?:number;priceMode?:'auto'|'agreed';platters:number;price:number;deposit?:number;menu:string;note:string;status:'reserved'|'arrived'|'completed'|'cancelled';version:number;updatedAt?:string};
export const money=(n:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n).replace(/\./g,',');
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
export const statusNames={reserved:'Đã đặt',arrived:'Đang phục vụ',completed:'Hoàn tất',cancelled:'Đã hủy'};

export const isTakeaway=(b:Pick<Booking,'serviceType'>)=>b.serviceType==='takeaway';
export const orderUnits=(b:Pick<Booking,'serviceType'|'tables'>)=>isTakeaway(b)?1:b.tables.length;
export const bookingTotal=(b:Pick<Booking,'price'|'tables'|'serviceType'>)=>b.price*orderUnits(b);
export const normalizeTableLabel=(value:string)=>value.trim()?value.trim().split(/[\s,;]+/).filter(Boolean).map(n=>/^\d{1,4}$/.test(n)?String(Number(n)):n).join(', '):'';
export function validTableLabel(value:string){const label=normalizeTableLabel(value);if(!label)return true;const parts=label.split(', ');return parts.length<=100&&parts.every(n=>/^[1-9]\d{0,3}$/.test(n))&&new Set(parts).size===parts.length&&label.length<=500;}
export const portableTableText=(b:Pick<Booking,'tableLabel'>)=>b.tableLabel?.trim()?'Thẻ '+normalizeTableLabel(b.tableLabel):'Chưa gán số thẻ';
export const orderLocation=(b:Pick<Booking,'serviceType'|'tables'|'tableLabel'>)=>isTakeaway(b)?'MANG VỀ':portableTableText(b)+(b.tables.length?' · '+[...new Set(b.tables.map(id=>zoneOf(id)?.title||'Khu khác'))].join(', '):'');
export const guestCount=(booking:Pick<Booking,'people'|'tables'|'totalPeople'|'serviceType'>)=>booking.totalPeople??booking.people*orderUnits(booking);

export const balanceDue=(b:Pick<Booking,'price'|'tables'|'deposit'|'paidAt'|'serviceType'>&Partial<Pick<Booking,'status'>>)=>b.paidAt||b.status==='cancelled'?0:Math.max(0,bookingTotal(b)-(b.deposit??0));

