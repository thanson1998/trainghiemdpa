export const zones = [
 {id:'OUT',title:'Khu Bàn Đá',sub:'Ngoài trời',type:'outdoor',count:11,tables:Array.from({length:11},(_,i)=>String(i+7))},
 {id:'S3',title:'Sân nhà 3',sub:'Sân vườn',type:'patio',count:6,tables:Array.from({length:6},(_,i)=>`S3-0${i+1}`)},
 {id:'S2',title:'Sân nhà 2',sub:'Sân vườn',type:'patio',count:6,tables:Array.from({length:6},(_,i)=>`S2-0${i+1}`)},
 {id:'S1',title:'Sân nhà 1',sub:'Sân vườn',type:'patio',count:8,tables:Array.from({length:8},(_,i)=>`S1-0${i+1}`)},
 {id:'N3',title:'Trong nhà 3',sub:'Không gian trong nhà',type:'inside',count:4,tables:Array.from({length:4},(_,i)=>`N3-0${i+1}`)},
 {id:'N2',title:'Trong nhà 2',sub:'Không gian trong nhà',type:'inside',count:6,tables:Array.from({length:6},(_,i)=>`N2-0${i+1}`)},
 {id:'N1',title:'Trong nhà 1',sub:'Không gian trong nhà',type:'inside',count:6,tables:Array.from({length:6},(_,i)=>`N1-0${i+1}`)},
 {id:'FRONT',title:'Trước quầy',sub:'Trước quầy thanh toán',type:'outdoor',count:3,tables:['20','19','18']},
];
export const tableIds=zones.flatMap(z=>z.tables);
export const zoneOf=(id:string)=>zones.find(z=>z.tables.includes(id))!;
export type Booking={id:string;paidAt?:string;orderCode?:string;date:string;start:string;end:string;name:string;phone:string;tables:string[];people:number;totalPeople?:number;priceMode?:'auto'|'agreed';platters:number;price:number;deposit?:number;menu:string;note:string;status:'reserved'|'arrived'|'completed'|'cancelled';version:number;updatedAt?:string};
export const money=(n:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(n).replace(/\./g,',');
export const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
export const statusNames={reserved:'Đã đặt',arrived:'Đang phục vụ',completed:'Hoàn tất',cancelled:'Đã hủy'};

export const guestCount=(booking:Pick<Booking,'people'|'tables'|'totalPeople'>)=>booking.totalPeople??booking.people*booking.tables.length;

export const balanceDue=(b:Pick<Booking,'price'|'tables'|'deposit'|'paidAt'>)=>b.paidAt?0:Math.max(0,b.price*b.tables.length-(b.deposit??0));
