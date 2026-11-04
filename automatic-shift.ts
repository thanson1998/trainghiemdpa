import {shiftSummary} from './pos-tools-api';
import {enqueueBackup,processBackupJobs} from './backup-jobs';
export function noonShiftPeriod(now:Date){
 const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now),value=(key:string)=>parts.find(p=>p.type===key)?.value??'';
 if(Number(value('hour'))<12)return null;
 const day=value('year')+'-'+value('month')+'-'+value('day'),end=new Date(day+'T12:00:00+07:00');
 return {day,from:new Date(end.getTime()-86400000).toISOString(),to:end.toISOString()};
}
export async function processAutomaticShift(db:D1Database,now=new Date()){
 const period=noonShiftPeriod(now);let row:{data:string}|null=null;
 if(period){
  const id='auto:'+period.day;
  row=await db.prepare("SELECT data FROM pos_shift_reports WHERE id=? AND source='automatic'").bind(id).first<{data:string}>();
  if(!row){
   const summary=await shiftSummary(db,period.from,period.to,true);
   const report={id,source:'automatic',serviceDate:period.day,from:period.from,to:period.to,summary,opening:null,expenses:null,counted:null,expected:null,difference:null,createdAt:now.toISOString()};
   await db.prepare("INSERT INTO pos_shift_reports(id,service_date,data,created_at,source) VALUES(?,?,?,?,'automatic') ON CONFLICT(id) DO NOTHING").bind(id,period.day,JSON.stringify(report),report.createdAt).run();
   row=await db.prepare("SELECT data FROM pos_shift_reports WHERE id=? AND source='automatic'").bind(id).first<{data:string}>();if(!row)throw Error('Chưa lưu được chốt ca tự động.');
  }
  await enqueueBackup(db,'auto-shift:'+period.day,'Chốt ca tự động 12:00 · '+period.day,JSON.parse(row.data).createdAt,now);
 }
 // The queue and cleanup run before noon as well, including jobs from previous days.
 const backup=await processBackupJobs(db,now,period?'auto-shift:'+period.day:undefined);
 return row?{report:JSON.parse(row.data),backup}:backup;
}
