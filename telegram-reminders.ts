import {GET as getBookings} from './api';
import {dueEmailJobs,loadEmailSchedule,reminderContent,vietnamClock,type EmailReminderEnv} from './email-reminders';
import type {Booking} from './model';
export interface TelegramEnv extends EmailReminderEnv {TELEGRAM_BOT_TOKEN?:string;TELEGRAM_CHAT_ID?:string;TELEGRAM_ENABLED?:string}
const schema=`CREATE TABLE IF NOT EXISTS booking_telegram_jobs(job_key TEXT PRIMARY KEY,payload TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,next_attempt INTEGER NOT NULL DEFAULT 0,sent_at TEXT,message_id TEXT,error_code TEXT)`;
export function telegramConfig(env:TelegramEnv){
 const token=env.TELEGRAM_BOT_TOKEN?.trim()||'',chatId=env.TELEGRAM_CHAT_ID?.trim()||'';
 return {token,chatId,enabled:env.TELEGRAM_ENABLED==='true',ready:/^\d+:[A-Za-z0-9_-]+$/.test(token)&&/^[1-9]\d*$/.test(chatId)};
}
export function telegramParts(text:string,limit=3500){
 const parts:string[]=[];let rest=text;
 while(rest.length>limit){let end=rest.lastIndexOf('\n',limit);if(end<limit/2)end=limit;if(/[\uD800-\uDBFF]/.test(rest[end-1]))end--;parts.push(rest.slice(0,end));rest=rest.slice(end);if(rest.startsWith('\n'))rest=rest.slice(1);}
 if(rest)parts.push(rest);return parts;
}
export async function telegramStatus(env:TelegramEnv){
 const c=telegramConfig(env),schedule=await loadEmailSchedule(env);let lastSentAt:string|null=null,uncertain=0;
 try{lastSentAt=(await env.DB.prepare("SELECT MAX(sent_at) AS sent FROM booking_telegram_jobs WHERE state='sent' AND job_key LIKE 'daily/%'").first<{sent:string|null}>())?.sent??null;uncertain=(await env.DB.prepare("SELECT COUNT(*) AS n FROM booking_telegram_jobs WHERE state='uncertain'").first<{n:number}>())?.n??0;}catch{}
 return Response.json({configured:c.ready,enabled:c.enabled,dailyTime:schedule.dailyTime,timeZone:'Asia/Ho_Chi_Minh',lastSentAt,uncertain},{headers:{'Cache-Control':'no-store'}});
}
export async function processBookingTelegrams(env:TelegramEnv,now=Date.now(),send:typeof fetch=fetch,test=false){
 const c=telegramConfig(env);if(!c.ready||(!test&&!c.enabled))return {sent:0,skipped:'not_configured'};
 const schedule=await loadEmailSchedule(env),clock=vietnamClock(now);
 if(!test&&clock.time<schedule.dailyTime)return {sent:0,skipped:'before_schedule'};
 await env.DB.prepare(schema).run();
 const prefix=(test?'test/':'daily/')+clock.date+'/'+c.chatId+(test?'/'+clock.time.replace(':',''):'');
 const existing=await env.DB.prepare('SELECT job_key FROM booking_telegram_jobs WHERE job_key LIKE ? LIMIT 1').bind(prefix+'/%').first();
 if(!existing){
  if(test){const n=await env.DB.prepare("SELECT COUNT(*) AS n FROM booking_telegram_jobs WHERE job_key LIKE ? AND job_key LIKE '%/0000'").bind('test/'+clock.date+'/%').first<{n:number}>();if((n?.n??0)>=5)return {sent:0,skipped:'test_limit'};}
  const response=await getBookings(new Request('https://dpa.internal/api/bookings?date='+clock.date),env.DB);if(!response.ok)throw Error('TELEGRAM_BOOKINGS_UNAVAILABLE');
  const data=await response.json() as {bookings:Booking[]};
  const job=dueEmailJobs(data.bookings,now,{dailyTime:'00:00',beforeMinutes:0})[0];if(test)job.kind='test';
  const parts=telegramParts(reminderContent(job).text);
  // Atomic snapshot: concurrent ticks keep the same message parts and quantities.
  await env.DB.batch(parts.map((text,i)=>env.DB.prepare("INSERT OR IGNORE INTO booking_telegram_jobs(job_key,payload,state) VALUES(?,?,'pending')").bind(prefix+'/'+String(i).padStart(4,'0'),JSON.stringify({chat_id:c.chatId,text,link_preview_options:{is_disabled:true}}))));
 }
 // Telegram has no idempotency key. A timed-out delivery must not be retried blindly.
 await env.DB.prepare("UPDATE booking_telegram_jobs SET state='uncertain',error_code='DELIVERY_UNCONFIRMED' WHERE state='sending' AND lease_until<=?").bind(now).run();
 const rows=await env.DB.prepare("SELECT job_key,state FROM booking_telegram_jobs WHERE job_key LIKE ? AND state<>'sent' ORDER BY job_key LIMIT 2").bind(prefix+'/%').all<{job_key:string;state:string}>();let sent=0;
 for(const row of rows.results){
  if(!['pending','retry'].includes(row.state))break;
  const claim=await env.DB.prepare("UPDATE booking_telegram_jobs SET state='sending',attempts=attempts+1,lease_until=? WHERE job_key=? AND state IN ('pending','retry') AND next_attempt<=? AND attempts<8 RETURNING payload,attempts").bind(now+120000,row.job_key,now).first<{payload:string;attempts:number}>();if(!claim)break;
  let response:Response;
  try{response=await send('https://api.telegram.org/bot'+c.token+'/sendMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:claim.payload,signal:AbortSignal.timeout(10000)});}catch{await env.DB.prepare("UPDATE booking_telegram_jobs SET state='uncertain',error_code='DELIVERY_UNCONFIRMED' WHERE job_key=?").bind(row.job_key).run();break;}
  let body:{ok?:boolean;result?:{message_id?:number};error_code?:number;parameters?:{retry_after?:number}};try{body=await response.json();}catch{body={};}
  if(response.ok&&body.ok&&Number.isInteger(body.result?.message_id)){
   await env.DB.prepare("UPDATE booking_telegram_jobs SET state='sent',sent_at=?,message_id=?,error_code=NULL WHERE job_key=?").bind(new Date(now).toISOString(),String(body.result!.message_id),row.job_key).run();sent++;
  }else if(body.ok===false&&body.error_code===429){
   const delay=Math.max(60,Math.min(86400,Number(body.parameters?.retry_after)||60));await env.DB.prepare("UPDATE booking_telegram_jobs SET state='retry',next_attempt=?,lease_until=0,error_code='RATE_LIMIT' WHERE job_key=?").bind(now+delay*1000,row.job_key).run();break;
  }else{
   const definitive=body.ok===false&&response.status>=400&&response.status<500;await env.DB.prepare('UPDATE booking_telegram_jobs SET state=?,error_code=? WHERE job_key=?').bind(definitive?'error':'uncertain',definitive?'TELEGRAM_REJECTED':'DELIVERY_UNCONFIRMED',row.job_key).run();break;
  }
 }
 return {sent};
}