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
 const dailyTime=env.BOOKING_EMAIL_DAILY_TIME?.trim()||'08:00';
 const beforeMinutes=env.BOOKING_EMAIL_BEFORE_MINUTES===undefined?120:Number(env.BOOKING_EMAIL_BEFORE_MINUTES);
 const validTime=/^([01]\d|2[0-3]):[0-5]\d$/.test(dailyTime);
 const missing=[!env.RESEND_API_KEY?.trim()?'RESEND_API_KEY':'',!email.test(to)?'BOOKING_EMAIL_TO':'',!email.test(sender)||/[\r\n]/.test(from)?'BOOKING_EMAIL_FROM':'',!validTime?'BOOKING_EMAIL_DAILY_TIME':'',!Number.isInteger(beforeMinutes)||beforeMinutes<0||beforeMinutes>1440?'BOOKING_EMAIL_BEFORE_MINUTES':''].filter(Boolean);
 return {to,from,dailyTime,beforeMinutes,missing,enabled:env.BOOKING_EMAIL_ENABLED==='true',ready:!missing.length};
}
export function vietnamClock(now:number){
 const local=new Date(now+7*60*60*1000).toISOString();return {date:local.slice(0,10),time:local.slice(11,16)};
}
export type ReminderJob={key:string;kind:'daily'|'before';bookings:Booking[]};
export function dueEmailJobs(bookings:Booking[],now:number,config:Pick<ReturnType<typeof reminderConfig>,'dailyTime'|'beforeMinutes'>):ReminderJob[]{
 const clock=vietnamClock(now);
 const pending=bookings.filter(b=>b.status==='reserved'&&!b.paidAt&&b.serviceType!=='takeaway');
 const jobs:ReminderJob[]=[];
 const daily=pending.filter(b=>b.date===clock.date&&b.start>clock.time).sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name,'vi'));
 if(clock.time>=config.dailyTime&&daily.length)jobs.push({key:'daily/'+clock.date,kind:'daily',bookings:daily});
 if(config.beforeMinutes>0)for(const b of pending){
  const arrival=Date.parse(b.date+'T'+b.start+':00+07:00');
  if(arrival>now&&arrival-now<=config.beforeMinutes*60000)jobs.push({key:'before/'+b.id+'/'+b.date+'/'+b.start.replace(':',''),kind:'before',bookings:[b]});
 }
 return jobs;
}
const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function reminderContent(job:ReminderJob){
 const date=job.bookings[0].date.split('-').reverse().join('/');
 const subject=job.kind==='daily'?`DPA • Hôm nay ${date}: ${job.bookings.length} lượt đặt bàn`:`DPA • Sắp đón khách ${job.bookings[0].start} — ${orderLocation(job.bookings[0])}`;
 const blocks=job.bookings.map(b=>[
  `${b.start}–${b.end} | ${orderLocation(b)}`,
  `Khách: ${b.name} | ${guestCount(b)} người`,
  ...(b.phone?[`Điện thoại: ${b.phone}`]:[]),
  ...(readMenuSet(b.menu)?.name?[`Set đặt: ${readMenuSet(b.menu)!.name}`]:[]),
  `Thực đơn:\n${menuText(b.menu)||'Chưa cập nhật'}`,
  ...(b.note?[`Ghi chú: ${b.note}`]:[]),
 ].join('\n'));
 const text=subject+'\nGiờ Việt Nam\n\n'+blocks.join('\n\n--------------------\n\n')+'\n\nLịch có thể thay đổi sau khi gửi. Kiểm tra website trước khi chuẩn bị:\nhttps://thanson1998.github.io/trainghiemdpa/';
 const html=`<div style="font-family:Arial,sans-serif;color:#234736;max-width:680px;margin:auto"><h2>${escapeHtml(subject)}</h2><p>Giờ Việt Nam</p>${blocks.map(block=>`<div style="padding:16px;background:#f4f6ee;margin:12px 0;border-radius:8px;white-space:pre-line">${escapeHtml(block)}</div>`).join('')}<p>Lịch có thể thay đổi sau khi gửi. <a href="https://thanson1998.github.io/trainghiemdpa/">Mở website DPA để kiểm tra</a>.</p></div>`;
 return {subject,text,html};
}
export async function emailReminderStatus(env:EmailReminderEnv){
 const c=reminderConfig(env);let lastSentAt:string|null=null,journalReady=false;
 try{const row=await env.DB.prepare("SELECT MAX(sent_at) AS sent FROM booking_email_jobs WHERE state='sent'").first<{sent:string|null}>();lastSentAt=row?.sent??null;journalReady=true;}catch{/* A new installation has not initialized its journal yet. */}
 return Response.json({enabled:c.enabled,configured:c.ready,dailyTime:c.dailyTime,beforeMinutes:c.beforeMinutes,timeZone:'Asia/Ho_Chi_Minh',recipient:c.to&&email.test(c.to)?c.to.slice(0,2)+'***@'+c.to.split('@')[1]:null,lastSentAt,journalReady},{headers:{'Cache-Control':'no-store'}});
}
export async function processBookingEmails(env:EmailReminderEnv,now=Date.now(),send:typeof fetch=fetch){
 const config=reminderConfig(env);
 if(!config.enabled||!config.ready)return {sent:0,skipped:'not_configured'};
 await env.DB.prepare(journalSchema).run();
 const clock=vietnamClock(now),tomorrow=vietnamClock(now+86400000).date;
 const response=await getBookings(new Request('https://dpa.internal/api/bookings?from='+clock.date+'&to='+tomorrow),env.DB);
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
