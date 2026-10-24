import {bookingTotal} from './model';
import {z} from 'zod';
const out=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const bankSchema=z.object({bankId:z.string().regex(/^\d{6}$/),account:z.string().regex(/^\d{6,30}$/),name:z.string().trim().min(1).max(100),version:z.number().int().min(0)});
export async function GET_BANK(_req:Request,db:D1Database){try{const row=await db.prepare('SELECT data,version FROM pos_bank WHERE id=1').first<{data:string;version:number}>();return out(row?{...JSON.parse(row.data),version:row.version}:{bankId:'',account:'',name:'',version:0});}catch{return out({error:'Chưa tải được tài khoản nhận tiền.'},503);}}
export async function SAVE_BANK(req:Request,db:D1Database){try{
 const parsed=bankSchema.safeParse(await req.json());if(!parsed.success)return out({error:'Chọn ngân hàng, nhập số tài khoản 6–30 chữ số và tên chủ tài khoản.'},400);
 const {version,...data}=parsed.data;
 const result=version===0?await db.prepare('INSERT INTO pos_bank(id,data,version) VALUES(1,?,1) ON CONFLICT(id) DO NOTHING').bind(JSON.stringify(data)).run():await db.prepare('UPDATE pos_bank SET data=?,version=version+1 WHERE id=1 AND version=?').bind(JSON.stringify(data),version).run();
 return result.meta.changes?out({...data,version:version+1}):out({error:'Tài khoản vừa thay đổi trên máy khác. Đóng rồi mở lại để kiểm tra.'},409);
 }catch{return out({error:'Chưa lưu được tài khoản nhận tiền.'},503);}}
const periodSchema=z.object({from:z.string().datetime(),to:z.string().datetime(),opening:z.number().int().min(0).max(5000000000),expenses:z.number().int().min(0).max(5000000000),counted:z.number().int().min(0).max(5000000000)}).refine(v=>Date.parse(v.to)>Date.parse(v.from)&&Date.parse(v.to)-Date.parse(v.from)<=86400000);
export async function shiftSummary(db:D1Database,from:string,to:string){
 const {results:payments}=await db.prepare('SELECT method,total,deposit,received FROM booking_payments WHERE paid_at>=? AND paid_at<?').bind(from,to).all<{method:string;total:number;deposit:number;received:number}>();
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(from));
 const {results:rows}=await db.prepare("SELECT r.* FROM reservations r WHERE r.user_id='dpa-shared' AND r.date=? AND NOT EXISTS(SELECT 1 FROM booking_payments p WHERE p.booking_id=r.id)").bind(day).all<any>();
 const unpaid=rows.filter(r=>r.status!=='cancelled');
 const {results:reversals}=await db.prepare("SELECT payment_snapshot FROM payment_reversals WHERE reversed_at>=? AND reversed_at<?").bind(from,to).all<{payment_snapshot:string}>();
 return {paidCount:payments.length,cash:payments.filter(p=>p.method==='cash').reduce((n,p)=>n+p.received,0),transfer:payments.filter(p=>p.method==='transfer').reduce((n,p)=>n+p.received,0),depositApplied:payments.reduce((n,p)=>n+p.deposit,0),paidTotal:payments.reduce((n,p)=>n+p.total,0),unpaidCount:unpaid.length,unpaidTotal:unpaid.reduce((n,r)=>n+Math.max(0,bookingTotal({price:r.price,tables:JSON.parse(r.table_ids),serviceType:r.service_type})-(r.deposit??0)),0),cancelledCount:rows.filter(r=>r.status==='cancelled').length,reversedCount:reversals.length,reversedAmount:reversals.reduce((n,r)=>n+JSON.parse(r.payment_snapshot).received,0)};
}
export async function GET_SHIFT(req:Request,db:D1Database){try{
 const params=new URL(req.url).searchParams,parsed=periodSchema.safeParse({from:params.get('from'),to:params.get('to'),opening:0,expenses:0,counted:0});if(!parsed.success)return out({error:'Chọn khoảng ca hợp lệ, tối đa 24 giờ.'},400);
 const {from,to}=parsed.data,summary=await shiftSummary(db,from,to);
 const {results:history}=await db.prepare('SELECT data FROM pos_shift_reports ORDER BY created_at DESC LIMIT 10').all<{data:string}>();
 return out({summary,fingerprint:JSON.stringify(summary),history:history.map(r=>JSON.parse(r.data))});
 }catch{return out({error:'Chưa tải được đối soát ca.'},503);}}
export async function SAVE_SHIFT(req:Request,db:D1Database){try{
 const parsed=periodSchema.and(z.object({id:z.string().uuid(),fingerprint:z.string().max(5000)})).safeParse(await req.json());if(!parsed.success)return out({error:'Kiểm tra thời gian ca và các số tiền.'},400);
 const input=parsed.data,summary=await shiftSummary(db,input.from,input.to);
 if(JSON.stringify(summary)!==input.fingerprint)return out({error:'Có giao dịch thay đổi. Bấm Cập nhật số liệu rồi kiểm tra lại trước khi lưu ca.'},409);
 const report={...input,summary,expected:input.opening+summary.cash-input.expenses,difference:input.counted-(input.opening+summary.cash-input.expenses),createdAt:new Date().toISOString()};
 const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(input.from));
 const result=await db.prepare('INSERT INTO pos_shift_reports(id,service_date,data,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(input.id,day,JSON.stringify(report),report.createdAt).run();
 return result.meta.changes?out({report}):out({error:'Bản đối soát đã lưu. Mở lịch sử ca để kiểm tra.'},409);
 }catch{return out({error:'Chưa lưu được đối soát ca. Cập nhật số liệu để kiểm tra trước khi thử lại.'},503);}}
