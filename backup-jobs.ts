import {backupExpiry,createStoredBackup,purgeStoredBackups} from './backup-store';
export type BackupJob={id:string;reason:string;status:'queued'|'running'|'succeeded'|'failed'|'expired';attempts:number;next_attempt:string;lease:string|null;lease_until:number;created_at:string;updated_at:string;expires_at:string;error:string};
export const backupRetryMinutes=(attempts:number)=>[1,5,15,60][Math.min(3,Math.max(0,attempts-1))];
export async function enqueueBackup(db:D1Database,id:string,reason:string,requestedAt=new Date().toISOString(),now=new Date()){
 const existing=await db.prepare('SELECT * FROM backup_jobs WHERE id=?').bind(id).first<BackupJob>();if(existing)return existing;
 const snapshot=await db.prepare('SELECT created_at FROM app_backups WHERE id=?').bind(id).first<{created_at:string}>(),createdAt=snapshot?.created_at??requestedAt,expiresAt=backupExpiry(createdAt),status=expiresAt<=now.toISOString()?'expired':snapshot?'succeeded':'queued';
 await db.prepare('INSERT INTO backup_jobs(id,reason,status,next_attempt,created_at,updated_at,expires_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,reason,status,now.toISOString(),createdAt,now.toISOString(),expiresAt).run();
 return (await db.prepare('SELECT * FROM backup_jobs WHERE id=?').bind(id).first<BackupJob>())!;
}
export async function cleanupBackupRetention(db:D1Database,now=new Date()){
 await db.prepare("UPDATE backup_jobs SET status='expired',lease=NULL,lease_until=0,error='',updated_at=? WHERE status<>'expired' AND expires_at<=? AND (status<>'running' OR lease_until<=?)").bind(now.toISOString(),now.toISOString(),now.getTime()).run();
 await purgeStoredBackups(db,now);
}
export async function runBackupJob(db:D1Database,id:string,now=new Date()){
 let job=await db.prepare('SELECT * FROM backup_jobs WHERE id=?').bind(id).first<BackupJob>();if(!job)throw Error('Chưa có yêu cầu sao lưu.');
 if(job.status==='expired')return {ok:false as const,job};
 if(job.expires_at<=now.toISOString()&&!(job.status==='running'&&job.lease_until>now.getTime())){await cleanupBackupRetention(db,now);job=(await db.prepare('SELECT * FROM backup_jobs WHERE id=?').bind(id).first<BackupJob>())!;return {ok:false as const,job};}
 if(job.status==='succeeded'){
  const snapshot=await db.prepare('SELECT id,created_at,reason,checksum FROM app_backups WHERE id=?').bind(id).first<any>();
  if(snapshot)return {ok:true as const,snapshot,job};
  // A completed job is not silently recreated if its retained file disappears.
  return {ok:false as const,job};
 }
 const lease=crypto.randomUUID();
 const claimed=await db.prepare("UPDATE backup_jobs SET status='running',attempts=attempts+1,lease=?,lease_until=?,updated_at=? WHERE id=? AND expires_at>? AND ((status IN ('queued','failed') AND next_attempt<=?) OR (status='running' AND lease_until<=?))").bind(lease,now.getTime()+300000,now.toISOString(),id,now.toISOString(),now.toISOString(),now.getTime()).run();
 if(!claimed.meta.changes)return {ok:false as const,job};
 job=(await db.prepare('SELECT * FROM backup_jobs WHERE id=?').bind(id).first<BackupJob>())!;
 try{
  const snapshot=await createStoredBackup(db,id,job.reason,now);if(!snapshot)throw Error('Chưa xác minh được bản sao lưu.');
  const saved=await db.prepare("UPDATE backup_jobs SET status='succeeded',lease=NULL,lease_until=0,error='',updated_at=?,expires_at=? WHERE id=? AND lease=? AND status='running'").bind(now.toISOString(),backupExpiry(snapshot.created_at),id,lease).run();
  if(!saved.meta.changes)throw Error('Phiên xử lý sao lưu đã thay đổi.');
  return {ok:true as const,snapshot,job:{...job,status:'succeeded' as const,error:'',expires_at:backupExpiry(snapshot.created_at)}};
 }catch{
  const next=new Date(now.getTime()+backupRetryMinutes(job.attempts)*60000).toISOString();
  await db.prepare("UPDATE backup_jobs SET status='failed',lease=NULL,lease_until=0,error=?,next_attempt=?,updated_at=? WHERE id=? AND lease=? AND status='running'").bind('Chưa tạo được bản sao lưu. Hệ thống sẽ tự thử lại.',next,now.toISOString(),id,lease).run();
  return {ok:false as const,job:{...job,status:'failed' as const,next_attempt:next,error:'Chưa tạo được bản sao lưu. Hệ thống sẽ tự thử lại.'}};
 }
}
export async function processBackupJobs(db:D1Database,now=new Date(),preferredId?:string){
 await cleanupBackupRetention(db,now);
 const {results:missing}=await db.prepare("SELECT s.id,s.source,s.service_date,s.created_at FROM pos_shift_reports s LEFT JOIN backup_jobs j ON j.id=CASE WHEN s.source='automatic' THEN 'auto-shift:'||s.service_date ELSE 'shift:'||s.id END WHERE j.id IS NULL ORDER BY s.created_at LIMIT 5").all<{id:string;source:string;service_date:string;created_at:string}>();
 for(const row of missing)await enqueueBackup(db,row.source==='automatic'?'auto-shift:'+row.service_date:'shift:'+row.id,row.source==='automatic'?'Chốt ca tự động 12:00 · '+row.service_date:'Chốt ca thủ công',row.created_at,now);
 const job=await db.prepare("SELECT id FROM backup_jobs WHERE expires_at>? AND ((status IN ('queued','failed') AND next_attempt<=?) OR (status='running' AND lease_until<=?)) ORDER BY CASE WHEN id=? AND attempts=0 THEN 0 ELSE 1 END,next_attempt,created_at LIMIT 1").bind(now.toISOString(),now.toISOString(),now.getTime(),preferredId??'').first<{id:string}>();
 return job?runBackupJob(db,job.id,now):null;
}
