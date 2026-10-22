import {validMenu} from './menu';
import {tableIds} from './model';
import {z} from 'zod';
const schema=z.object({id:z.string().uuid(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),name:z.string().trim().min(1).max(100),phone:z.string().trim().max(30),tables:z.array(z.enum(tableIds as [string,...string[]])).min(1).max(tableIds.length).refine(a=>new Set(a).size===a.length),people:z.number().int().min(1).max(1000),platters:z.number().int().min(1).max(100),price:z.number().int().min(0).max(100000000),deposit:z.number().int().min(0).max(4800000000).default(0),menu:z.string().max(40000).refine(validMenu,{message:'Kiểm tra tên và giá từng món: giá phải là số nguyên từ 0 đến 100.000.000 đồng.'}),note:z.string().max(2000),status:z.enum(['reserved','arrived','completed','cancelled']),version:z.number().int().min(0)}).refine(b=>b.end>b.start,{message:'Giờ kết thúc phải sau giờ bắt đầu.'}).refine(b=>b.deposit<=b.price*b.tables.length,{message:'Tiền cọc không được lớn hơn tổng tiền đặt bàn.'});
function out(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}})}
const overlap=`SELECT 1 FROM reservations r WHERE r.user_id=? AND r.date=? AND r.id<>? AND r.status<>'cancelled' AND r.start<? AND r.end>? AND EXISTS(SELECT 1 FROM json_each(r.table_ids) a JOIN json_each(?) b ON a.value=b.value)`;
export async function GET(req:Request,db:D1Database){
 const u={userId:'dpa-shared'};
 const params=new URL(req.url).searchParams;const date=params.get('date'),month=params.get('month');
 const validDate=!!date&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
 if((date&&month)||(!month&&!validDate)||(month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)))return out({error:'Ngày hoặc tháng không hợp lệ.'},400);
 try{const statement=month?db.prepare('SELECT * FROM reservations WHERE user_id=? AND date>=? AND date<=? ORDER BY date, start, name, id').bind(u.userId,month+'-01',month+'-31'):db.prepare('SELECT * FROM reservations WHERE user_id=? AND date=? ORDER BY start, name, id').bind(u.userId,date);
 const {results}=await statement.all<any>();
 return out({bookings:results.map(r=>({id:r.id,orderCode:r.order_code,date:r.date,start:r.start,end:r.end,name:r.name,phone:r.phone,tables:JSON.parse(r.table_ids),people:r.people,platters:r.platters,price:r.price,deposit:r.deposit??0,menu:r.menu,note:r.note,status:r.status,version:r.version,updatedAt:r.updated_at}))});
 }catch(e){console.error('Booking read failed',e);return out({error:'Không tải được dữ liệu. Vui lòng thử lại.'},503)}
}
export async function POST(req:Request,db:D1Database){
 const u={userId:'dpa-shared'};
 try{const parsed=schema.safeParse(await req.json());if(!parsed.success)return out({error:parsed.error.issues[0].message},400);
 const b=parsed.data;const tables=JSON.stringify(b.tables);const now=new Date().toISOString();
 const conflict=[u.userId,b.date,b.id,b.end,b.start,tables];
 let result;
 if(b.version===0){
 result=await db.prepare(`INSERT INTO reservations (id,user_id,date,start,end,name,phone,table_ids,people,platters,price,menu,note,status,deposit,version,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,? WHERE (?='cancelled' OR NOT EXISTS(${overlap})) ON CONFLICT(id) DO NOTHING`).bind(b.id,u.userId,b.date,b.start,b.end,b.name,b.phone,tables,b.people,b.platters,b.price,b.menu,b.note,b.status,b.deposit,now,b.status,...conflict).run();
 }else{
 result=await db.prepare(`UPDATE reservations SET date=?,start=?,end=?,name=?,phone=?,table_ids=?,people=?,platters=?,price=?,menu=?,note=?,status=?,deposit=?,version=version+1,updated_at=? WHERE id=? AND user_id=? AND version=? AND (?='cancelled' OR NOT EXISTS(${overlap}))`).bind(b.date,b.start,b.end,b.name,b.phone,tables,b.people,b.platters,b.price,b.menu,b.note,b.status,b.deposit,now,b.id,u.userId,b.version,b.status,...conflict).run();
 }
 if(!result.meta.changes)return out({error:'Bàn đã có lịch trùng giờ hoặc dữ liệu vừa thay đổi. Hãy tải lại rồi kiểm tra.'},409);
 return out({ok:true,version:b.version+1});
 }catch(e){console.error('Booking save failed',e);return out({error:'Chưa lưu được đặt bàn. Vui lòng thử lại.'},503)}
}
export async function DELETE(req:Request,db:D1Database){
 const u={userId:'dpa-shared'};
 try{const parsed=z.object({id:z.string().uuid(),version:z.number().int().min(1)}).safeParse(await req.json());if(!parsed.success)return out({error:'Yêu cầu không hợp lệ.'},400);const data=parsed.data;
 const result=await db.prepare('DELETE FROM reservations WHERE id=? AND user_id=? AND version=?').bind(data.id,u.userId,data.version).run();
 if(!result.meta.changes)return out({error:'Dữ liệu vừa thay đổi. Hãy tải lại trước khi xóa.'},409);return out({ok:true});
 }catch{return out({error:'Không thể xóa. Vui lòng thử lại.'},503)}
}
