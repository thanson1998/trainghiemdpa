import {z} from 'zod';
import {BACKUP,POST} from './api';
import {paymentBooking} from './payments-api';
const out=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function backupChecksum(text:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');}
async function unpack(row:{payload:ArrayBuffer|number[]|Uint8Array;checksum:string}){
 const bytes=row.payload instanceof ArrayBuffer?new Uint8Array(row.payload):new Uint8Array(row.payload);
 const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 if(await backupChecksum(text)!==row.checksum)throw Error('Bản sao lưu không vượt qua kiểm tra toàn vẹn.');
 const data=JSON.parse(text);if(data.format!=='DPA_BACKUP_V1'||!Array.isArray(data.bookings))throw Error('Định dạng bản sao lưu không hợp lệ.');return data;
}
export async function createStoredBackup(db:D1Database,id:string,reason:string){
 const existing=await db.prepare('SELECT id,created_at,reason,checksum FROM app_backups WHERE id=?').bind(id).first<any>();if(existing)return existing;
 const response=await BACKUP(new Request('https://dpa.invalid/api/backup'),db);if(!response.ok)throw Error('Chưa đọc được dữ liệu để sao lưu.');
 const text=await response.text(),checksum=await backupChecksum(text),createdAt=new Date().toISOString();
 const payload=await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
 if(payload.byteLength>1800000)throw Error('Bản sao lưu vượt giới hạn lưu trên máy chủ. Hãy tải bản sao lưu JSON về máy.');
 await db.prepare('INSERT INTO app_backups(id,created_at,reason,checksum,payload) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,createdAt,reason,checksum,payload).run();
 // Keep recent snapshots; the original records and audit history are untouched.
 await db.prepare('DELETE FROM app_backups WHERE id NOT IN (SELECT id FROM app_backups ORDER BY created_at DESC,id DESC LIMIT 30)').run();
 return await db.prepare('SELECT id,created_at,reason,checksum FROM app_backups WHERE id=?').bind(id).first<any>();
}
export async function GET_BACKUPS(req:Request,db:D1Database){try{
 const id=new URL(req.url).searchParams.get('id');
 if(id){if(id.length>100)return out({error:'Mã sao lưu không hợp lệ.'},400);const row=await db.prepare('SELECT * FROM app_backups WHERE id=?').bind(id).first<any>();if(!row)return out({error:'Không tìm thấy bản sao lưu.'},404);return out(await unpack(row));}
 const {results}=await db.prepare('SELECT id,created_at,reason,checksum FROM app_backups ORDER BY created_at DESC,id DESC LIMIT 30').all();return out({backups:results});
 }catch{return out({error:'Chưa đọc được sao lưu. Vui lòng thử lại.'},503);}}
export async function CREATE_BACKUP(req:Request,db:D1Database){try{const parsed=z.object({id:z.string().uuid()}).safeParse(await req.json());if(!parsed.success)return out({error:'Mã yêu cầu sao lưu không hợp lệ.'},400);return out({backup:await createStoredBackup(db,'manual:'+parsed.data.id,'Tạo thủ công')});}catch(e){return out({error:(e as Error).message||'Chưa tạo được sao lưu.'},503);}}
export async function RESTORE_BACKUP_ORDER(req:Request,db:D1Database){try{
 if(req.method==='GET'){
  const id=new URL(req.url).searchParams.get('id');if(!z.string().uuid().safeParse(id).success)return out({error:'Mã đơn không hợp lệ.'},400);
  const current=await db.prepare('SELECT r.version,(SELECT paid_at FROM booking_payments WHERE booking_id=r.id) AS paid_at FROM reservations r WHERE r.id=? AND r.user_id=?').bind(id,'dpa-shared').first<{version:number;paid_at:string|null}>();return out({version:current?.version??0,paidAt:current?.paid_at??null});
 }
 const parsed=z.object({backupId:z.string().min(1).max(100),bookingId:z.string().uuid(),expectedVersion:z.number().int().min(0)}).safeParse(await req.json());if(!parsed.success)return out({error:'Chọn bản sao lưu và đơn cần khôi phục.'},400);
 const input=parsed.data,row=await db.prepare('SELECT * FROM app_backups WHERE id=?').bind(input.backupId).first<any>();if(!row)return out({error:'Không tìm thấy bản sao lưu.'},404);
 const snapshot=await unpack(row),stored=snapshot.bookings.find((b:any)=>b.id===input.bookingId);if(!stored)return out({error:'Đơn không có trong bản sao lưu.'},404);
 if(stored.status==='cancelled'||snapshot.payments?.some((p:any)=>p.booking_id===input.bookingId))return out({error:'Chỉ khôi phục đơn chưa thanh toán, chưa hủy. Đơn đã thu tiền cần dùng chức năng hoàn tác để đối soát.'},409);
 const current=await db.prepare('SELECT version FROM reservations WHERE id=? AND user_id=?').bind(input.bookingId,'dpa-shared').first<{version:number}>();if((current?.version??0)!==input.expectedVersion)return out({error:'Đơn vừa thay đổi. Tải lại và kiểm tra trước khi khôi phục.'},409);
 return POST(new Request(req.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...paymentBooking(stored),version:input.expectedVersion,learnDishNames:[]})}),db,true);
 }catch{return out({error:'Chưa khôi phục được đơn. Tải lại để kiểm tra.'},503);}}
