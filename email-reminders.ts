import {vietnamClock} from './vietnam-time';
import {telegramJobs,telegramSummary,telegramPaymentText,reportTimes,type TelegramPayment} from './order-notifications';
import {readTableLayout} from './table-layout-api';
import {applyZones} from './model';
import {GET as getBookings} from './api';
import {guestCount,orderLocation,type Booking} from './model';
import {readMenuSet,menuText} from './menu';

export interface EmailReminderEnv {
 DB:D1Database;
 RESEND_API_KEY?:string;
 BOOKING_EMAIL_TO?:string;
 BOOKING_EMAIL_FROM?:string;
 BOOKING_EMAIL_ENABLED?:string;
 BOOKING_EMAIL_DAILY_TIME?:string;
 BOOKING_EMAIL_BEFORE_MINUTES?:string;
}
const journalSchema=`CREATE TABLE IF NOT EXISTS booking_email_jobs (
 job_key TEXT PRIMARY KEY, payload TEXT NOT NULL, state TEXT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL,
 next_attempt INTEGER NOT NULL DEFAULT 0, sent_at TEXT, provider_id TEXT, error_code TEXT
)`;
const email=/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;
export function reminderConfig(env:EmailReminderEnv){
 const to=env.BOOKING_EMAIL_TO?.trim()||'';
 const from=env.BOOKING_EMAIL_FROM?.trim()||'';
 const sender=from.match(/<([^<>]+)>$/)?.[1]||from;
 const dailyTime='06:00';
 const beforeMinutes=120;
 const validTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(dailyTime);
 const missing=[!env.RESEND_API_KEY?.trim()?'RESEND_API_KEY':'',!email.test(to)?'BOOKING_EMAIL_TO':'',!email.test(sender)||/[\r\n]/.test(from)?'BOOKING_EMAIL_FROM':'',!validTime?'BOOKING_EMAIL_DAILY_TIME':'',!Number.isInteger(beforeMinutes)||beforeMinutes<0||beforeMinutes>1440?'BOOKING_EMAIL_BEFORE_MINUTES':''].filter(Boolean);
 return {to,from,dailyTime,beforeMinutes,missing,enabled:env.BOOKING_EMAIL_ENABLED==='true',ready:!missing.length};
}
export {vietnamClock} from './vietnam-time';
export type ReminderJob={key:string;kind:'daily'|'test'|'interval'|'arrival'|'payment';date:string;bookings:Booking[];text?:string};
export function dueEmailJobs(bookings:Booking[],now:number,_config?:unknown):ReminderJob[]{return telegramJobs(bookings,now).map(job=>({key:job.key,kind:job.key.startsWith('arrival/')?'arrival':'interval',date:job.key.startsWith('arrival/')?job.key.split('/')[1]:vietnamClock(now).date,bookings:[],text:job.text}));}
export type EmailSchedule={enabled:boolean;dailyTime:string;version:number;updatedAt:string|null};
const settingsSchema=`CREATE TABLE IF NOT EXISTS booking_email_settings (id TEXT PRIMARY KEY CHECK(id='daily'),enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),daily_time TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT)`;
export async function loadEmailSchedule(env:EmailReminderEnv):Promise<EmailSchedule>{
 try{
  const row=await env.DB.prepare("SELECT enabled,daily_time,version,updated_at FROM booking_email_settings WHERE id='daily'").first<{enabled:number;daily_time:string;version:number;updated_at:string|null}>();
  if(row)return {enabled:!!row.enabled,dailyTime:'06:00',version:row.version,updatedAt:row.updated_at};
 }catch(error){if(!/no such table.*booking_email_settings/i.test(String(error)))throw error;}
 return {enabled:reminderConfig(env).enabled,dailyTime:'06:00',version:0,updatedAt:null};
}
export function nextDailySend(dailyTime:string,now=Date.now(),lastSentAt:string|null=null){
 const clock=vietnamClock(now);let next=Date.parse(clock.date+'T'+dailyTime+':00+07:00');if(next<=now||(lastSentAt&&vietnamClock(Date.parse(lastSentAt)).date===clock.date))next+=86400000;return new Date(next).toISOString();
}
export async function saveEmailSchedule(request:Request,env:EmailReminderEnv){
 let body:any;try{body=await request.json();}catch{return Response.json({error:'Dữ liệu cấu hình không hợp lệ.'},{status:400});}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['enabled','dailyTime','version'].includes(k))||typeof body.enabled!=='boolean'||typeof body.dailyTime!=='string'||body.dailyTime!=='06:00'||!Number.isInteger(body.version)||body.version<0)return Response.json({error:'Chọn giờ gửi theo định dạng 24 giờ và kiểm tra cấu hình.'},{status:400});
 try{
  await env.DB.prepare(settingsSchema).run();
  const previous=await loadEmailSchedule(env);
  if(previous.version!==body.version)return Response.json({error:'Cấu hình vừa thay đổi trên thiết bị khác. Tải lại trước khi lưu.'},{status:409});
  const stamp=new Date().toISOString();
  const saved=await env.DB.prepare(`INSERT INTO booking_email_settings(id,enabled,daily_time,version,updated_at) VALUES('daily',?,?,1,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,daily_time=excluded.daily_time,version=booking_email_settings.version+1,updated_at=excluded.updated_at WHERE booking_email_settings.version=? RETURNING version`).bind(body.enabled?1:0,body.dailyTime,stamp,body.version).first<{version:number}>();
  if(!saved)return Response.json({error:'Cấu hình vừa thay đổi. Tải lại và thử lại.'},{status:409});
  return emailReminderStatus(env);
 }catch{return Response.json({error:'Chưa lưu được lịch gửi mail. Vui lòng thử lại.'},{status:503});}
}
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function reminderContent(job:ReminderJob){
 const subject=(job.kind==='test'?'[GỬI THỬ] ':job.kind==='payment'?'Thanh toán thành công · ':job.kind==='arrival'?'Nhắc bàn trước 2 giờ · ':'Báo cáo đơn POS · ')+'DPA · '+job.date.split('-').reverse().join('/');
 const text=job.text??telegramSummary(job.bookings,Date.parse(job.date+'T12:00:00+07:00')).text;
 const html='<div style="font-family:Arial,sans-serif;color:#234736;max-width:720px;margin:auto"><h2>'+escapeHtml(subject)+'</h2><div style="white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6">'+escapeHtml(text)+'</div></div>';
 return {subject,text,html};
}
export function nextReportSend(now:number){const date=vietnamClock(now).date;for(const time of reportTimes){const stamp=Date.parse(date+'T'+time+':00+07:00');if(stamp>now)return new Date(stamp).toISOString();}return new Date(Date.parse(date+'T06:00:00+07:00')+86400000).toISOString();}
async function loadEmailTableNames(env:EmailReminderEnv){try{applyZones((await readTableLayout(env.DB)).zones);}catch{}}
export async function emailReminderStatus(env:EmailReminderEnv){
 const c=reminderConfig(env),schedule=await loadEmailSchedule(env);let lastSentAt:string|null=null,journalReady=false;
 try{const row=await env.DB.prepare("SELECT MAX(sent_at) AS sent FROM booking_email_jobs WHERE state='sent' AND job_key NOT LIKE 'test/%'").first<{sent:string|null}>();lastSentAt=row?.sent??null;journalReady=true;}catch{/* A new installation has not initialized its journal yet. */}
 return Response.json({...schedule,configured:c.ready,reportVersion:2,reportTimes,intervalHours:4,beforeMinutes:120,paymentNotificationsEnabled:schedule.enabled&&c.ready,nextSendAt:schedule.enabled?nextReportSend(Date.now()):null,timeZone:'Asia/Ho_Chi_Minh',recipient:c.to&&email.test(c.to)?c.to.slice(0,2)+'***@'+c.to.split('@')[1]:null,lastSentAt,journalReady},{headers:{'Cache-Control':'no-store'}});
}
async function enqueueEmail(env:EmailReminderEnv,job:ReminderJob){const c=reminderConfig(env);await env.DB.prepare("INSERT OR IGNORE INTO booking_email_jobs(job_key,payload,state,attempts,lease_until,next_attempt) VALUES(?,?,'pending',0,0,0)").bind(job.key,JSON.stringify({from:c.from,to:[c.to],...reminderContent(job)})).run();}
async function enqueueEmailPayments(env:EmailReminderEnv){
 const events=await env.DB.prepare("SELECT event_key,payment_snapshot FROM booking_email_payment_events WHERE state IN ('pending','queued') ORDER BY created_at,event_key LIMIT 10").all<{event_key:string;payment_snapshot:string}>();
 for(const event of events.results){const payment=JSON.parse(event.payment_snapshot) as TelegramPayment,key='payment/'+Array.from(new TextEncoder().encode(event.event_key),x=>x.toString(16).padStart(2,'0')).join('');await enqueueEmail(env,{key,kind:'payment',date:vietnamClock(Date.parse(payment.paidAt)).date,bookings:[],text:telegramPaymentText(payment)});await env.DB.prepare("UPDATE booking_email_payment_events SET state=COALESCE((SELECT CASE WHEN state='sent' THEN 'sent' WHEN state='error' THEN 'error' ELSE 'queued' END FROM booking_email_jobs WHERE job_key=?),'queued') WHERE event_key=?").bind(key,event.event_key).run();}
}
async function deliverEmailQueue(env:EmailReminderEnv,now:number,send:typeof fetch){
 const clock=vietnamClock(now),reportWindow=clock.time>=reportTimes[0]&&clock.time<=reportTimes.at(-1)!;
 const ready=await env.DB.prepare("SELECT job_key FROM booking_email_jobs WHERE state IN ('pending','retry','sending') AND attempts<8 AND lease_until<=? AND next_attempt<=? AND (job_key LIKE 'payment/%' OR job_key LIKE 'arrival/%' OR (?=1 AND job_key LIKE ?)) ORDER BY CASE WHEN job_key LIKE 'payment/%' THEN 0 WHEN job_key LIKE 'arrival/%' THEN 1 ELSE 2 END,next_attempt,job_key LIMIT 2").bind(now,now,reportWindow?1:0,'interval/v3/'+clock.date+'/%').all<{job_key:string}>();let sent=0;
 for(const {job_key:key} of ready.results){
  if(key.startsWith('arrival/')){const parts=key.split('/'),time=parts.at(-1)!;if(now>=Date.parse(parts[1]+'T'+time.slice(0,2)+':'+time.slice(2)+':00+07:00')){await env.DB.prepare("UPDATE booking_email_jobs SET state='error',error_code='REMINDER_EXPIRED' WHERE job_key=? AND state<>'sent'").bind(key).run();continue;}}
  const claimed=await env.DB.prepare("UPDATE booking_email_jobs SET state='sending',attempts=attempts+1,lease_until=? WHERE job_key=? AND state IN ('pending','retry','sending') AND attempts<8 AND lease_until<=? AND next_attempt<=? RETURNING payload,attempts").bind(now+120000,key,now,now).first<{payload:string;attempts:number}>();if(!claimed)continue;
  try{const result=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY!.trim(),'Content-Type':'application/json','Idempotency-Key':'dpa-booking/'+key},body:claimed.payload,signal:AbortSignal.timeout(10000)});if(!result.ok)throw Error('PROVIDER_HTTP_'+result.status);const body=await result.json() as {id?:string};if(!body.id)throw Error('PROVIDER_INVALID_RESPONSE');await env.DB.prepare("UPDATE booking_email_jobs SET state='sent',sent_at=?,provider_id=?,error_code=NULL WHERE job_key=?").bind(new Date(now).toISOString(),body.id,key).run();if(key.startsWith('payment/'))await env.DB.prepare("UPDATE booking_email_payment_events SET state='sent' WHERE 'payment/'||lower(hex(event_key))=?").bind(key).run();sent++;
  }catch(error){const code=error instanceof Error&&/^PROVIDER_/.test(error.message)?error.message:'SEND_UNCONFIRMED';await env.DB.prepare("UPDATE booking_email_jobs SET state=?,lease_until=0,next_attempt=?,error_code=? WHERE job_key=? AND state<>'sent'").bind(claimed.attempts>=8?'error':'retry',now+Math.min(3600000,60000*2**claimed.attempts),code,key).run();}
 }return {sent};
}
export async function processEmailPayments(env:EmailReminderEnv,now=Date.now(),send:typeof fetch=fetch){const c=reminderConfig(env),schedule=await loadEmailSchedule(env);if(!c.ready||!schedule.enabled)return {sent:0,skipped:'not_configured'};await loadEmailTableNames(env);await env.DB.prepare(journalSchema).run();await enqueueEmailPayments(env);return deliverEmailQueue(env,now,send);}
export async function processBookingEmails(env:EmailReminderEnv,now=Date.now(),send:typeof fetch=fetch){
 const c=reminderConfig(env),schedule=await loadEmailSchedule(env);if(!c.ready||!schedule.enabled)return {sent:0,skipped:'not_configured'};await loadEmailTableNames(env);await env.DB.prepare(journalSchema).run();await enqueueEmailPayments(env);
 const bookings:Booking[]=[];for(const date of [vietnamClock(now).date,vietnamClock(now+86400000).date]){const response=await getBookings(new Request('https://dpa.internal/api/bookings?date='+date),env.DB);if(!response.ok)throw Error('EMAIL_BOOKINGS_UNAVAILABLE');const data=await response.json() as {bookings:Booking[]};bookings.push(...data.bookings.filter(b=>b.date===date));}for(const job of dueEmailJobs(bookings,now))await enqueueEmail(env,job);return deliverEmailQueue(env,now,send);
}

// Explicit manual tests use a separate journal; they never consume or reset a daily delivery.
export async function sendTestBookingEmail(request:Request,env:EmailReminderEnv,now=Date.now(),send:typeof fetch=fetch){
 const config=reminderConfig(env);
 if(!config.ready)return Response.json({error:'Chưa kết nối đầy đủ dịch vụ gửi mail.'},{status:409});
 let body:any;try{body=await request.json();}catch{return Response.json({error:'Yêu cầu không hợp lệ.'},{status:400});}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)return Response.json({error:'Email thử chỉ gửi tới địa chỉ đã cấu hình.'},{status:400});
 try{
  await env.DB.prepare(journalSchema).run();
  const clock=vietnamClock(now),key='test/'+clock.date+'/'+clock.time.replace(':','');
  const response=await getBookings(new Request('https://dpa.internal/api/bookings?date='+clock.date),env.DB);
  if(!response.ok)return Response.json({error:'Chưa đọc được lịch đặt bàn để gửi thử.'},{status:503});
  const data=await response.json() as {bookings:Booking[]};
  await loadEmailTableNames(env);const job:ReminderJob={kind:'test',key,date:clock.date,bookings:data.bookings,text:telegramSummary(data.bookings,now).text};
  const payload=JSON.stringify({from:config.from,to:[config.to],...reminderContent(job)});
  const claim=await env.DB.prepare(`INSERT OR IGNORE INTO booking_email_jobs(job_key,payload,state,attempts,lease_until,next_attempt) SELECT ?,?,'sending',1,?,0 WHERE (SELECT COUNT(*) FROM booking_email_jobs WHERE job_key LIKE ?) < 5 RETURNING job_key`).bind(key,payload,now+120000,'test/'+clock.date+'/%').first<{job_key:string}>();
  if(!claim)return Response.json({error:'Đã gửi thử trong phút này hoặc đủ 5 lần hôm nay. Vui lòng thử lại sau.'},{status:429});
  try{
   const result=await send('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+env.RESEND_API_KEY!.trim(),'Content-Type':'application/json','Idempotency-Key':'dpa-booking/'+key},body:payload,signal:AbortSignal.timeout(10000)});
   if(!result.ok)throw new Error('PROVIDER_HTTP_'+result.status);
   const accepted=await result.json() as {id?:string};if(!accepted.id)throw Error('PROVIDER_INVALID_RESPONSE');
   await env.DB.prepare("UPDATE booking_email_jobs SET state='sent',sent_at=?,provider_id=?,error_code=NULL WHERE job_key=?").bind(new Date(now).toISOString(),accepted.id,key).run();
   return Response.json({accepted:true,sentAt:new Date(now).toISOString(),message:'Đã gửi email thử tới hộp thư đã cấu hình. Kiểm tra Hộp thư đến hoặc Spam.'});
  }catch(error){
   const code=error instanceof Error&&/^PROVIDER_/.test(error.message)?error.message:'SEND_UNCONFIRMED';
   await env.DB.prepare("UPDATE booking_email_jobs SET state='error',lease_until=0,error_code=? WHERE job_key=?").bind(code,key).run();
   return Response.json({error:'Chưa xác nhận được email thử đã gửi. Kiểm tra Resend hoặc hộp thư trước khi thử lại.',code},{status:502});
  }
 }catch{return Response.json({error:'Chưa gửi được email thử. Vui lòng thử lại.'},{status:503});}
}
