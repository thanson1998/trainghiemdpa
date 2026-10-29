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
 const beforeMinutes=0;
 const validTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(dailyTime);
 const missing=[!env.RESEND_API_KEY?.trim()?'RESEND_API_KEY':'',!email.test(to)?'BOOKING_EMAIL_TO':'',!email.test(sender)||/[\r\n]/.test(from)?'BOOKING_EMAIL_FROM':'',!validTime?'BOOKING_EMAIL_DAILY_TIME':'',!Number.isInteger(beforeMinutes)||beforeMinutes<0||beforeMinutes>1440?'BOOKING_EMAIL_BEFORE_MINUTES':''].filter(Boolean);
 return {to,from,dailyTime,beforeMinutes,missing,enabled:env.BOOKING_EMAIL_ENABLED==='true',ready:!missing.length};
}
export function vietnamClock(now:number){
 const local=new Date(now+7*60*60*1000).toISOString();return {date:local.slice(0,10),time:local.slice(11,16)};
}
export type ReminderJob={key:string;kind:'daily';date:string;bookings:Booking[]};
export function dueEmailJobs(bookings:Booking[],now:number,config:Pick<ReturnType<typeof reminderConfig>,'dailyTime'|'beforeMinutes'>):ReminderJob[]{
 const clock=vietnamClock(now);
 if(clock.time<config.dailyTime)return [];
 const daily=bookings.filter(b=>b.date===clock.date&&b.status==='reserved'&&!b.paidAt&&b.serviceType!=='takeaway').sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name,'vi'));
 return [{key:'daily/'+clock.date,kind:'daily',date:clock.date,bookings:daily}];
}
export type EmailSchedule={enabled:boolean;dailyTime:string;version:number;updatedAt:string|null};
const settingsSchema=`CREATE TABLE IF NOT EXISTS booking_email_settings (id TEXT PRIMARY KEY CHECK(id='daily'),enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),daily_time TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT)`;
export async function loadEmailSchedule(env:EmailReminderEnv):Promise<EmailSchedule>{
 try{
  const row=await env.DB.prepare("SELECT enabled,daily_time,version,updated_at FROM booking_email_settings WHERE id='daily'").first<{enabled:number;daily_time:string;version:number;updated_at:string|null}>();
  if(row)return {enabled:!!row.enabled,dailyTime:row.daily_time,version:row.version,updatedAt:row.updated_at};
 }catch(error){if(!/no such table.*booking_email_settings/i.test(String(error)))throw error;}
 return {enabled:reminderConfig(env).enabled,dailyTime:'06:00',version:0,updatedAt:null};
}
export function nextDailySend(dailyTime:string,now=Date.now(),lastSentAt:string|null=null){
 const clock=vietnamClock(now);let next=Date.parse(clock.date+'T'+dailyTime+':00+07:00');if(next<=now||(lastSentAt&&vietnamClock(Date.parse(lastSentAt)).date===clock.date))next+=86400000;return new Date(next).toISOString();
}
export async function saveEmailSchedule(request:Request,env:EmailReminderEnv){
 let body:any;try{body=await request.json();}catch{return Response.json({error:'Dữ liệu cấu hình không hợp lệ.'},{status:400});}
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['enabled','dailyTime','version'].includes(k))||typeof body.enabled!=='boolean'||typeof body.dailyTime!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.dailyTime)||!Number.isInteger(body.version)||body.version<0)return Response.json({error:'Chọn giờ gửi theo định dạng 24 giờ và kiểm tra cấu hình.'},{status:400});
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
 const date=job.date.split('-').reverse().join('/');
 const subject=`DPA • Hôm nay ${date}: ${job.bookings.length} lượt đặt bàn`;
 const blocks=job.bookings.map(b=>[
  `${b.start}–${b.end} | ${orderLocation(b)}`,
  `Khách: ${b.name} | ${guestCount(b)} người`,
  ...(b.phone?[`Điện thoại: ${b.phone}`]:[]),
  ...(readMenuSet(b.menu)?.name?[`Set đặt: ${readMenuSet(b.menu)!.name}`]:[]),
  `Thực đơn:\n${menuText(b.menu)||'Chưa cập nhật'}`,
  ...(b.note?[`Ghi chú: ${b.note}`]:[]),
 ].join('\n'));
 const text=subject+'\nGiờ Việt Nam\n\n'+(blocks.length?blocks.join('\n\n--------------------\n\n'):'Hôm nay chưa có bàn đặt.')+'\n\nLịch có thể thay đổi sau khi gửi. Kiểm tra website trước khi chuẩn bị:\nhttps://thanson1998.github.io/trainghiemdpa/';
 const html=`<div style="font-family:Arial,sans-serif;color:#234736;max-width:680px;margin:auto"><h2>${escapeHtml(subject)}</h2><p>Giờ Việt Nam</p>${(blocks.length?blocks:['Hôm nay chưa có bàn đặt.']).map(block=>`<div style="padding:16px;background:#f4f6ee;margin:12px 0;border-radius:8px;white-space:pre-line">${escapeHtml(block)}</div>`).join('')}<p>Lịch có thể thay đổi sau khi gửi. <a href="https://thanson1998.github.io/trainghiemdpa/">Mở website DPA để kiểm tra</a>.</p></div>`;
 return {subject,text,html};
}
export async function emailReminderStatus(env:EmailReminderEnv){
 const c=reminderConfig(env),schedule=await loadEmailSchedule(env);let lastSentAt:string|null=null,journalReady=false;
 try{const row=await env.DB.prepare("SELECT MAX(sent_at) AS sent FROM booking_email_jobs WHERE state='sent'").first<{sent:string|null}>();lastSentAt=row?.sent??null;journalReady=true;}catch{/* A new installation has not initialized its journal yet. */}
 return Response.json({...schedule,configured:c.ready,beforeMinutes:0,nextSendAt:schedule.enabled?nextDailySend(schedule.dailyTime,Date.now(),lastSentAt):null,timeZone:'Asia/Ho_Chi_Minh',recipient:c.to&&email.test(c.to)?c.to.slice(0,2)+'***@'+c.to.split('@')[1]:null,lastSentAt,journalReady},{headers:{'Cache-Control':'no-store'}});
}
export async function processBookingEmails(env:EmailReminderEnv,now=Date.now(),send:typeof fetch=fetch){
 const base=reminderConfig(env),schedule=await loadEmailSchedule(env),config={...base,...schedule,beforeMinutes:0};
 if(!config.enabled||!config.ready)return {sent:0,skipped:'not_configured'};
 await env.DB.prepare(journalSchema).run();
 const clock=vietnamClock(now);
 const response=await getBookings(new Request('https://dpa.internal/api/bookings?date='+clock.date),env.DB);
 if(!response.ok)throw new Error('EMAIL_BOOKINGS_UNAVAILABLE');
 const data=await response.json() as {bookings:Booking[]};
 const jobs=dueEmailJobs(data.bookings,now,config);let sent=0,attempted=0;
 // A bounded number per minute avoids exceeding the mail provider rate limit.
 for(const job of jobs){
  if(attempted>=2)break;
  const payload=JSON.stringify({from:config.from,to:[config.to],...reminderContent(job)});
  const claimed=await env.DB.prepare(`INSERT INTO booking_email_jobs(job_key,payload,state,attempts,lease_until,next_attempt)
   VALUES(?,?,'sending',1,?,0)
   ON CONFLICT(job_key) DO UPDATE SET state='sending',attempts=attempts+1,lease_until=excluded.lease_until
   WHERE state<>'sent' AND attempts<8 AND lease_until<=? AND next_attempt<=?
   RETURNING payload,attempts`).bind(job.key,payload,now+120000,now,now).first<{payload:string;attempts:number}>();
  if(!claimed)continue;
  attempted++;
  try{
   const result=await send('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':'Bearer '+env.RESEND_API_KEY!.trim(),'Content-Type':'application/json','Idempotency-Key':'dpa-booking/'+job.key},body:claimed.payload,signal:AbortSignal.timeout(10000)});
   if(!result.ok)throw new Error('PROVIDER_HTTP_'+result.status);
   const body=await result.json() as {id?:string};if(!body.id)throw new Error('PROVIDER_INVALID_RESPONSE');
   await env.DB.prepare("UPDATE booking_email_jobs SET state='sent',sent_at=?,provider_id=?,error_code=NULL WHERE job_key=?").bind(new Date(now).toISOString(),body.id,job.key).run();sent++;
  }catch(error){
   const code=error instanceof Error&&/^PROVIDER_/.test(error.message)?error.message:'SEND_UNCONFIRMED';
   await env.DB.prepare("UPDATE booking_email_jobs SET state='retry',lease_until=0,next_attempt=?,error_code=? WHERE job_key=? AND state<>'sent'").bind(now+Math.min(3600000,60000*2**claimed.attempts),code,job.key).run();
   console.error('Booking email failed',{job:job.key,code});
  }
 }
 return {sent};
}
