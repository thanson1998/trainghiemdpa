import {tableIds,bookingTotal} from './model';
import {learnCatalogFromMenu} from './catalog-learning';
import {validMenu,readMenu,itemQuantity} from './menu';
import {z} from 'zod';
const schema=z.object({serviceType:z.enum(['dine-in','takeaway']).optional(),totalPeople:z.number().int().min(1).max(50000).nullable().optional(),priceMode:z.enum(['auto','agreed']).default('agreed'),learnDishNames:z.array(z.string().min(1).max(200)).max(80).default([]),id:z.string().uuid(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),name:z.string().trim().min(1).max(100),phone:z.string().trim().max(30),tables:z.array(z.enum(tableIds as [string,...string[]])).min(0).max(tableIds.length).refine(a=>new Set(a).size===a.length),people:z.number().int().min(1).max(1000),platters:z.number().int().min(1).max(100),price:z.number().int().min(0).max(100000000),deposit:z.number().int().min(0).max(4800000000).default(0),menu:z.string().max(40000).refine(validMenu,{message:'Kiểm tra tên và giá từng món: giá phải là số nguyên từ 0 đến 100,000,000 đồng.'}),note:z.string().max(2000),status:z.enum(['reserved','arrived','completed','cancelled']),version:z.number().int().min(0)}).refine(b=>b.serviceType==='takeaway'?b.tables.length===0:b.tables.length>0,{message:'Chọn bàn khi ăn tại quán, hoặc chọn Mang về để không cần bàn.'}).refine(b=>b.end>b.start,{message:'Giờ kết thúc phải sau giờ bắt đầu.'}).refine(b=>b.deposit<=bookingTotal(b),{message:'Tiền cọc không được lớn hơn tổng tiền đặt bàn.'});
function out(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
const overlap=`SELECT 1 FROM reservations r WHERE r.user_id=? AND r.date=? AND r.id<>? AND r.status<>'cancelled' AND NOT EXISTS(SELECT 1 FROM booking_payments paid WHERE paid.booking_id=r.id) AND r.start<? AND r.end>? AND EXISTS(SELECT 1 FROM json_each(r.table_ids) a JOIN json_each(?) b ON a.value=b.value)`;
export async function GET(req:Request,db:D1Database){
 const u={userId:'dpa-shared'};
 const params=new URL(req.url).searchParams;const date=params.get('date'),month=params.get('month');
 const validDate=!!date&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
 if((date&&month)||(!month&&!validDate)||(month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)))return out({error:'Ngày hoặc tháng không hợp lệ.'},400);
 try{const statement=month?db.prepare('SELECT *, (SELECT paid_at FROM booking_payments WHERE booking_id=reservations.id) AS paid_at FROM reservations WHERE user_id=? AND date>=? AND date<=? ORDER BY date, start, name, id').bind(u.userId,month+'-01',month+'-31'):db.prepare('SELECT *, (SELECT paid_at FROM booking_payments WHERE booking_id=reservations.id) AS paid_at FROM reservations WHERE user_id=? AND date=? ORDER BY start, name, id').bind(u.userId,date);
 const {results}=await statement.all<any>();
 return out({bookings:results.map(r=>({id:r.id,...(r.service_type==='takeaway'?{serviceType:'takeaway'}:{}),...(r.paid_at?{paidAt:r.paid_at}:{}),orderCode:r.order_code,date:r.date,start:r.start,end:r.end,name:r.name,phone:r.phone,tables:JSON.parse(r.table_ids),people:r.people,...(r.total_people!=null?{totalPeople:r.total_people}:{}),priceMode:r.price_mode??'agreed',platters:r.platters,price:r.price,deposit:r.deposit??0,menu:r.menu,note:r.note,status:r.status,version:r.version,updatedAt:r.updated_at}))});
 }catch(e){console.error('Booking read failed',e);return out({error:'Không tải được dữ liệu. Vui lòng thử lại.'},503)}
}
export async function POST(req:Request,db:D1Database,restoring=false){
 const u={userId:'dpa-shared'};
 try{const parsed=schema.safeParse(await req.json());if(!parsed.success)return out({error:parsed.error.issues[0].message},400);
 const b={...parsed.data,serviceType:parsed.data.serviceType??'dine-in' as const};if(await isPaid(db,b.id))return out({error:'Đơn đã thanh toán được giữ nguyên để đối soát.'},409);if(b.status!=='cancelled'){
 let catalogRow:{data:string}|null=null;
 try{catalogRow=await db.prepare('SELECT data FROM menu_catalog WHERE id=?').bind('dpa-shared').first<{data:string}>();}catch(e){if(!/no such table: menu_catalog/i.test(String(e)))throw e;}
 const soldOut=(catalogRow?JSON.parse(catalogRow.data).dishes:[]).filter((d:any)=>d.soldOut);
 if(soldOut.length){const previous=await db.prepare('SELECT menu,table_ids,service_type FROM reservations WHERE id=? AND user_id=?').bind(b.id,'dpa-shared').first<{menu:string;table_ids:string;service_type:string}>();const key=(s:string)=>s.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');const quantity=(items:ReturnType<typeof readMenu>,name:string)=>items.filter(i=>key(i.name)===key(name)).reduce((n,i)=>n+itemQuantity(i),0);const oldItems=previous?readMenu(previous.menu,previous.service_type==='takeaway'?1:JSON.parse(previous.table_ids).length):[],newItems=readMenu(b.menu,b.serviceType==='takeaway'?1:b.tables.length);const unavailable=soldOut.find((d:any)=>quantity(newItems,d.name)>quantity(oldItems,d.name));if(unavailable)return out({error:unavailable.name+' đang tạm hết. Không thể gọi thêm món này; các món đã lưu vẫn được giữ.'},409);}
 }
 const tables=JSON.stringify(b.tables);const now=new Date().toISOString();
 const conflict=[u.userId,b.date,b.id,b.end,b.start,tables];
 let result;let savedVersion=b.version+1;if(restoring&&b.version===0){const {results}=await db.prepare('SELECT COALESCE(MAX(version),0)+1 AS next_version FROM reservation_history WHERE booking_id=?').bind(b.id).all<{next_version:number}>();savedVersion=results[0].next_version;}
 if(b.version===0){
 result=await db.prepare(`INSERT INTO reservations (id,user_id,date,start,end,name,phone,table_ids,people,platters,price,menu,note,status,deposit,total_people,price_mode,service_type,version,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (?='cancelled' OR NOT EXISTS(${overlap})) ON CONFLICT(id) DO NOTHING`).bind(b.id,u.userId,b.date,b.start,b.end,b.name,b.phone,tables,b.people,b.platters,b.price,b.menu,b.note,b.status,b.deposit,b.totalPeople??null,b.priceMode,b.serviceType,savedVersion,now,b.status,...conflict).run();
 }else{
 result=await db.prepare(`UPDATE reservations SET date=?,start=?,end=?,name=?,phone=?,table_ids=?,people=?,platters=?,price=?,menu=?,note=?,status=?,deposit=?,total_people=CASE WHEN ? THEN ? ELSE total_people END,price_mode=?,service_type=?,version=version+1,updated_at=? WHERE id=? AND user_id=? AND version=? AND (?='cancelled' OR NOT EXISTS(${overlap}))`).bind(b.date,b.start,b.end,b.name,b.phone,tables,b.people,b.platters,b.price,b.menu,b.note,b.status,b.deposit,(b.totalPeople!==undefined||restoring)?1:0,b.totalPeople??null,b.priceMode,b.serviceType,now,b.id,u.userId,b.version,b.status,...conflict).run();
 }
 if(!result.meta.changes)return out({error:'Bàn đã có lịch trùng giờ hoặc dữ liệu vừa thay đổi. Hãy tải lại rồi kiểm tra.'},409);
 const catalogWarning=await learnCatalogFromMenu(db,b.menu,b.learnDishNames);return out({ok:true,version:savedVersion,catalogWarning});
 }catch(e){console.error('Booking save failed',e);return out({error:'Chưa lưu được đặt bàn. Vui lòng thử lại.'},503)}
}
export async function DELETE(req:Request,db:D1Database){
 const u={userId:'dpa-shared'};
 try{const parsed=z.object({id:z.string().uuid(),version:z.number().int().min(1)}).safeParse(await req.json());if(!parsed.success)return out({error:'Yêu cầu không hợp lệ.'},400);const data=parsed.data;if(await isPaid(db,data.id))return out({error:'Không thể xóa đơn đã thanh toán.'},409);
 const result=await db.prepare('DELETE FROM reservations WHERE id=? AND user_id=? AND version=?').bind(data.id,u.userId,data.version).run();
 if(!result.meta.changes)return out({error:'Dữ liệu vừa thay đổi. Hãy tải lại trước khi xóa.'},409);return out({ok:true});
 }catch{return out({error:'Không thể xóa. Vui lòng thử lại.'},503)}
}

export async function HISTORY(_req:Request,db:D1Database){
 try{
  const {results}=await db.prepare(`SELECT h.*,r.version AS current_version,p.paid_at AS current_paid_at,
   CASE WHEN h.version=p.booking_version+1 THEN p.snapshot END AS payment_snapshot,
   p.total AS payment_total,p.deposit AS payment_deposit,p.received AS payment_received,
   p.tendered AS payment_tendered,p.method AS payment_method
   FROM reservation_history h LEFT JOIN reservations r ON r.id=h.booking_id
   LEFT JOIN booking_payments p ON p.booking_id=h.booking_id
   ORDER BY h.event_id DESC LIMIT 100`).all<any>();
  return out({history:results.map(r=>({id:r.event_id,bookingId:r.booking_id,
   action:r.payment_snapshot?'paid':r.action,version:r.version,currentVersion:r.current_version??0,
   currentPaidAt:r.current_paid_at??undefined,booking:JSON.parse(r.snapshot),
   ...(r.payment_snapshot?{payment:{booking:JSON.parse(r.payment_snapshot),total:r.payment_total,
    deposit:r.payment_deposit,received:r.payment_received,tendered:r.payment_tendered,
    method:r.payment_method,paidAt:r.current_paid_at}}:{}),createdAt:r.created_at}))});
 }catch{return out({error:'Chưa tải được lịch sử đặt bàn.'},503);}
}
export async function RESTORE(req:Request,db:D1Database){
 try{
  const input=z.object({id:z.number().int().positive(),expectedVersion:z.number().int().min(0)}).safeParse(await req.json());if(!input.success)return out({error:'Thông tin khôi phục chưa hợp lệ.'},400);
  const {results}=await db.prepare('SELECT * FROM reservation_history WHERE event_id=?').bind(input.data.id).all<any>();const entry=results[0];if(!entry)return out({error:'Không tìm thấy phiên bản cần khôi phục.'},404);
  const b=JSON.parse(entry.snapshot);const {results:current}=await db.prepare('SELECT version FROM reservations WHERE id=? AND user_id=?').bind(entry.booking_id,'dpa-shared').all<{version:number}>();
  if((current[0]?.version??0)!==input.data.expectedVersion)return out({error:'Đơn vừa thay đổi trên thiết bị khác. Tải lại lịch sử trước khi khôi phục.'},409);
  return POST(new Request(req.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...b,totalPeople:b.totalPeople??undefined,priceMode:b.priceMode??'agreed',version:input.data.expectedVersion,learnDishNames:[]})}),db,true);
 }catch{return out({error:'Chưa khôi phục được đặt bàn. Hãy thử lại.'},503);}
}
export async function BACKUP(_req:Request,db:D1Database){
 try{const [bookings,catalog,history,prints,payments,paymentReversals,bank,shiftReports,adsResearch]=await db.batch([db.prepare('SELECT * FROM reservations WHERE user_id=?').bind('dpa-shared'),db.prepare('SELECT * FROM menu_catalog WHERE id=?').bind('dpa-shared'),db.prepare('SELECT * FROM reservation_history ORDER BY event_id'),db.prepare('SELECT * FROM booking_prints ORDER BY id'),db.prepare('SELECT * FROM booking_payments ORDER BY paid_at'),db.prepare('SELECT * FROM payment_reversals ORDER BY id'),db.prepare('SELECT * FROM pos_bank'),db.prepare('SELECT * FROM pos_shift_reports ORDER BY created_at'),db.prepare('SELECT * FROM ads_research')]);return out({format:'DPA_BACKUP_V1',createdAt:new Date().toISOString(),bookings:bookings.results,catalog:catalog.results,history:history.results,prints:prints.results,payments:payments.results,paymentReversals:paymentReversals.results,bank:bank.results,shiftReports:shiftReports.results,adsResearch:adsResearch.results});}catch{return out({error:'Chưa tạo được bản sao lưu.'},503);}
}
export async function GET_PRINT(req:Request,db:D1Database){
 const params=new URL(req.url).searchParams,date=params.get('date');
 if(date){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)return out({error:'Ngày không hợp lệ.'},400);
  try{const {results}=await db.prepare('SELECT p.booking_id,p.snapshot,p.created_at FROM booking_prints p JOIN reservations r ON r.id=p.booking_id WHERE r.user_id=? AND r.date=? AND p.id=(SELECT MAX(p2.id) FROM booking_prints p2 WHERE p2.booking_id=p.booking_id)').bind('dpa-shared',date).all<any>();return out({lastById:Object.fromEntries(results.map(r=>[r.booking_id,{...JSON.parse(r.snapshot),confirmedAt:r.created_at}]))});}catch{return out({error:'Chưa kiểm tra được phiếu bếp.'},503);}
 }
 const id=params.get('id');if(!id||!z.string().uuid().safeParse(id).success)return out({error:'Thiếu mã đặt bàn hợp lệ.'},400);
 try{const {results}=await db.prepare('SELECT * FROM booking_prints WHERE booking_id=? ORDER BY id DESC LIMIT 1').bind(id).all<any>();return out({last:results[0]?{...JSON.parse(results[0].snapshot),confirmedAt:results[0].created_at}:null});}catch{return out({error:'Chưa tải được lần gửi bếp trước.'},503);}
}
export async function CONFIRM_PRINT(req:Request,db:D1Database){
 try{
  const input=z.object({booking:schema}).safeParse(await req.json());if(!input.success)return out({error:'Hãy lưu phiếu trước khi xác nhận gửi bếp.'},400);const b=input.data.booking;
  const result=await db.prepare(`INSERT INTO booking_prints(booking_id,booking_version,snapshot,created_at) SELECT id,version,?,? FROM reservations WHERE id=? AND user_id=? AND version=? AND menu=? AND table_ids=? AND date=? AND start=? AND end=? AND name=? AND phone=? AND note=? AND price=? AND deposit=? AND people=? AND COALESCE(total_people,0)=? AND status=? AND service_type=?`).bind(JSON.stringify(b),new Date().toISOString(),b.id,'dpa-shared',b.version,b.menu,JSON.stringify(b.tables),b.date,b.start,b.end,b.name,b.phone,b.note,b.price,b.deposit,b.people,b.totalPeople??0,b.status,b.serviceType??'dine-in').run();
  if(!result.meta.changes)return out({error:'Phiếu chưa lưu hoặc đơn vừa thay đổi. Hãy lưu và mở lại phiếu trước khi xác nhận.'},409);return out({ok:true});
 }catch{return out({error:'Chưa ghi nhận được lần gửi bếp.'},503);}
}
export async function MOVE(req:Request,db:D1Database){
 try{
  const parsed=z.object({id:z.string().uuid(),version:z.number().int().min(1),tables:z.array(z.enum(tableIds as [string,...string[]])).min(1).max(tableIds.length).refine(ids=>new Set(ids).size===ids.length)}).safeParse(await req.json());
  if(!parsed.success)return out({error:'Chọn các bàn hợp lệ, không trùng nhau.'},400);
  const b=parsed.data;if(await isPaid(db,b.id))return out({error:'Không thể chuyển bàn của đơn đã thanh toán.'},409);const tables=JSON.stringify(b.tables);
  const result=await db.prepare(`UPDATE reservations AS target SET table_ids=?,version=version+1,updated_at=?
   WHERE id=? AND user_id=? AND version=? AND status<>'cancelled' AND service_type='dine-in' AND json_array_length(table_ids)=?
   AND NOT EXISTS(SELECT 1 FROM reservations r WHERE r.user_id=target.user_id AND r.date=target.date AND r.id<>target.id AND r.status<>'cancelled' AND NOT EXISTS(SELECT 1 FROM booking_payments paid WHERE paid.booking_id=r.id) AND r.start<target.end AND r.end>target.start AND EXISTS(SELECT 1 FROM json_each(r.table_ids) a JOIN json_each(?) b ON a.value=b.value))`).bind(tables,new Date().toISOString(),b.id,'dpa-shared',b.version,b.tables.length,tables).run();
  if(!result.meta.changes)return out({error:'Không thể chuyển: bàn mới đã có lịch, số bàn không khớp, đơn đã hủy hoặc dữ liệu vừa thay đổi. Hãy tải lại danh sách bàn.'},409);
  return out({ok:true,version:b.version+1});
 }catch(e){console.error('Table transfer failed',e);return out({error:'Chưa chuyển được bàn. Vui lòng thử lại.'},503);}
}

async function isPaid(db:D1Database,id:string){const {results}=await db.prepare('SELECT booking_id FROM booking_payments WHERE booking_id=?').bind(id).all();return results.length>0;}

