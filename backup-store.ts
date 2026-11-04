import {BACKUP} from './api';
export const BACKUP_RETENTION_DAYS=60;
export const backupExpiry=(createdAt:string)=>new Date(Date.parse(createdAt)+BACKUP_RETENTION_DAYS*86400000).toISOString();
export const backupCutoff=(now=new Date())=>new Date(now.getTime()-BACKUP_RETENTION_DAYS*86400000).toISOString();
export async function purgeStoredBackups(db:D1Database,now=new Date()){await db.prepare('DELETE FROM app_backups WHERE created_at<=?').bind(backupCutoff(now)).run();}
export async function backupChecksum(text:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');}
export async function unpack(row:{payload:ArrayBuffer|number[]|Uint8Array;checksum:string}){
 const bytes=row.payload instanceof ArrayBuffer?new Uint8Array(row.payload):new Uint8Array(row.payload);
 const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 if(await backupChecksum(text)!==row.checksum)throw Error('Bản sao lưu không vượt qua kiểm tra toàn vẹn.');
 const data=JSON.parse(text);if(data.format!=='DPA_BACKUP_V1'||!Array.isArray(data.bookings))throw Error('Định dạng bản sao lưu không hợp lệ.');return data;
}
export async function createStoredBackup(db:D1Database,id:string,reason:string,now=new Date()){
 await purgeStoredBackups(db,now);
 const existing=await db.prepare('SELECT id,created_at,reason,checksum FROM app_backups WHERE id=?').bind(id).first<any>();if(existing)return existing;
 const response=await BACKUP(new Request('https://dpa.invalid/api/backup'),db);if(!response.ok)throw Error('Chưa đọc được dữ liệu để sao lưu.');
 const text=await response.text(),checksum=await backupChecksum(text),createdAt=now.toISOString();
 const payload=await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
 if(payload.byteLength>1800000)throw Error('Bản sao lưu vượt giới hạn lưu trên máy chủ. Hãy tải bản sao lưu JSON về máy.');
 await db.prepare('INSERT INTO app_backups(id,created_at,reason,checksum,payload) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,createdAt,reason,checksum,payload).run();

 return await db.prepare('SELECT id,created_at,reason,checksum FROM app_backups WHERE id=?').bind(id).first<any>();
}
