import {backupCutoff,backupExpiry,unpack} from './backup-store';
import {enqueueBackup,runBackupJob} from './backup-jobs';
export {backupChecksum,createStoredBackup} from './backup-store';
import {z} from 'zod';
import {POST} from './api';
import {paymentBooking} from './payments-api';
const out=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET_BACKUPS(req:Request,db:D1Database){try{
 const id=new URL(req.url).searchParams.get('id');
 if(id){if(id.length>100)return out({error:'Mã sao lưu không hợp lệ.'},400);const row=await db.prepare('SELECT * FROM app_backups WHERE id=? AND created_at>?').bind(id,backupCutoff()).first<any>();if(!row)return out({error:'Không tìm thấy bản sao lưu.'},404);return out(await unpack(row));}
 const offset=Number(new URL(req.url).searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>1000000)return out({error:'Trang sao lưu không hợp lệ.'},400);
 const {results}=await db.prepare('SELECT id,created_at,reason,checksum FROM app_backups WHERE created_at>? ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ?').bind(backupCutoff(),offset).all<any>();
 const {results:jobs}=await db.prepare("SELECT id,reason,status,attempts,next_attempt AS nextAttemptAt,created_at AS createdAt,error FROM backup_jobs WHERE status IN ('queued','running','failed') ORDER BY created_at DESC LIMIT 50").all();
 return out({backups:results.slice(0,50).map(row=>({...row,expiresAt:backupExpiry(row.created_at)})),jobs,hasMore:results.length>50,nextOffset:offset+50,retentionDays:60});
 }catch{return out({error:'Chưa đọc được sao lưu. Vui lòng thử lại.'},503);}}
export async function CREATE_BACKUP(req:Request,db:D1Database){try{
 const parsed=z.object({id:z.string().uuid()}).safeParse(await req.json());if(!parsed.success)return out({error:'Mã yêu cầu sao lưu không hợp lệ.'},400);
 const id='manual:'+parsed.data.id;await enqueueBackup(db,id,'Tạo thủ công');
 const result=await runBackupJob(db,id);return result.ok?out({backup:result.snapshot}):out({error:'Sao lưu chưa hoàn thành. Hệ thống đã ghi nhận và sẽ thử lại.',job:result.job},503);
 }catch{return out({error:'Chưa tạo được sao lưu. Kiểm tra trạng thái và thử lại.'},503);}}
export async function RESTORE_BACKUP_ORDER(req:Request,db:D1Database){try{
 if(req.method==='GET'){
  const id=new URL(req.url).searchParams.get('id');if(!z.string().uuid().safeParse(id).success)return out({error:'Mã đơn không hợp lệ.'},400);
  const current=await db.prepare('SELECT r.version,r.status,(SELECT paid_at FROM booking_payments WHERE booking_id=r.id) AS paid_at FROM reservations r WHERE r.id=? AND r.user_id=?').bind(id,'dpa-shared').first<{version:number;paid_at:string|null;status:string}>();return out({version:current?.version??0,paidAt:current?.paid_at??null,status:current?.status??null});
 }
 const parsed=z.object({backupId:z.string().min(1).max(100),bookingId:z.string().uuid(),expectedVersion:z.number().int().min(0)}).safeParse(await req.json());if(!parsed.success)return out({error:'Chọn bản sao lưu và đơn cần khôi phục.'},400);
 const input=parsed.data,row=await db.prepare('SELECT * FROM app_backups WHERE id=? AND created_at>?').bind(input.backupId,backupCutoff()).first<any>();if(!row)return out({error:'Không tìm thấy bản sao lưu.'},404);
 const snapshot=await unpack(row),stored=snapshot.bookings.find((b:any)=>b.id===input.bookingId);if(!stored)return out({error:'Đơn không có trong bản sao lưu.'},404);
 if(stored.status==='cancelled'||snapshot.payments?.some((p:any)=>p.booking_id===input.bookingId))return out({error:'Chỉ khôi phục đơn chưa thanh toán, chưa hủy. Đơn đã thu tiền cần dùng chức năng hoàn tác để đối soát.'},409);
 const current=await db.prepare('SELECT version FROM reservations WHERE id=? AND user_id=?').bind(input.bookingId,'dpa-shared').first<{version:number}>();if((current?.version??0)!==input.expectedVersion)return out({error:'Đơn vừa thay đổi. Tải lại và kiểm tra trước khi khôi phục.'},409);
 return POST(new Request(req.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...paymentBooking(stored),version:input.expectedVersion,learnDishNames:[]})}),db,true);
 }catch{return out({error:'Chưa khôi phục được đơn. Tải lại để kiểm tra.'},503);}}
