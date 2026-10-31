import {readTableLayout} from './table-layout-api';
import {GET as getBookings} from './api';
import {vietnamClock,type EmailReminderEnv} from './email-reminders';
import {applyZones,guestCount,orderLocation,orderUnits,money,type Booking} from './model';
import {readMenuSet,menuText,readMenu,menuSetQuantity,itemQuantity,itemUnit,itemAmount} from './menu';
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
export const reportTimes=['06:00','10:00','14:00','18:00','22:00'];
export function telegramReportSlot(now:number){
 const time=vietnamClock(now).time;
 if(time<reportTimes[0]||time>reportTimes[reportTimes.length-1])return undefined;
 return reportTimes.filter(slot=>slot<=time).at(-1);
}
const statusLabel={reserved:'Đã đặt',arrived:'Đang phục vụ',completed:'Hoàn tất, chưa thanh toán',cancelled:'Đã hủy'};
function telegramBookingDetails(b:Booking){
 return [b.orderCode||b.id,`${b.start}–${b.end} | ${orderLocation(b)}`,'Trạng thái: '+statusLabel[b.status],`Khách: ${b.name} | ${guestCount(b)} người`,...(b.phone?['Điện thoại: '+b.phone]:[]),...(readMenuSet(b.menu)?.name?['Set đặt: '+readMenuSet(b.menu)!.name]:[]),'Thực đơn:\n'+(menuText(b.menu)||'Chưa cập nhật'),...(b.note?['Ghi chú: '+b.note]:[])].join('\n');
}
export function telegramSummary(bookings:Booking[],now:number){
 const clock=vietnamClock(now);
 // Match POS open orders, including serving and completed-but-unpaid orders.
 const open=bookings.filter(b=>b.date===clock.date&&b.status!=='cancelled'&&!b.paidAt).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
 const count=(status:Booking['status'])=>open.filter(b=>b.status===status).length;
 const tables=new Set(open.filter(b=>b.serviceType!=='takeaway').flatMap(b=>b.tables)).size;
 const text=[`DPA · ${clock.date.split('-').reverse().join('/')} · Cập nhật ${clock.time} (giờ Việt Nam)`,`Đơn đang mở: ${open.length} | Bàn: ${tables}`,`Đã đặt: ${count('reserved')} | Đang phục vụ: ${count('arrived')} | Hoàn tất chưa thanh toán: ${count('completed')}`,`Mang về: ${open.filter(b=>b.serviceType==='takeaway').length}`,'',open.length?open.map(telegramBookingDetails).join('\n\n--------------------\n\n'):'Hiện không có đơn đang mở chưa thanh toán trong ngày.','','Dữ liệu tại thời điểm gửi. Kiểm tra website để xem cập nhật mới nhất:','https://thanson1998.github.io/trainghiemdpa/'].join('\n');
 return {text,openCount:open.length,tableCount:tables};
}
export function telegramJobs(bookings:Booking[],now:number){
 const clock=vietnamClock(now),slot=telegramReportSlot(now);
 const summary=telegramSummary(bookings,now);
 const jobs=slot?[{key:'interval/v3/'+clock.date+'/'+slot.replace(':',''),text:'BÁO CÁO ĐƠN ĐANG MỞ — '+slot+'\n'+summary.text}]:[];
 for(const b of bookings){
  const start=Date.parse(b.date+'T'+b.start+':00+07:00');
  if(b.status!=='reserved'||b.paidAt||b.serviceType==='takeaway'||!Number.isFinite(start)||now<start-7200000||now>=start)continue;
  const id=Array.from(new TextEncoder().encode(b.id),byte=>byte.toString(16).padStart(2,'0')).join('');
  jobs.push({key:'arrival/'+b.date+'/'+id+'/'+b.start.replace(':',''),text:'NHẮC LỊCH ĐẶT BÀN — TRƯỚC GIỜ ĐẾN 2 TIẾNG\nNgày '+b.date.split('-').reverse().join('/')+' (giờ Việt Nam)\n'+telegramBookingDetails(b)});
 }
 return jobs;
}
export async function telegramStatus(env:TelegramEnv){
 const c=telegramConfig(env);let lastSentAt:string|null=null,uncertain=0,lastCommandAt:string|null=null,lastPollAt:string|null=null,paymentNotificationsReady=false,lastPaymentAt:string|null=null;
 try{lastSentAt=(await env.DB.prepare("SELECT MAX(sent_at) AS sent FROM booking_telegram_jobs WHERE state='sent'").first<{sent:string|null}>())?.sent??null;uncertain=(await env.DB.prepare("SELECT COUNT(*) AS n FROM booking_telegram_jobs WHERE state='uncertain'").first<{n:number}>())?.n??0;}catch{}
 try{lastCommandAt=(await env.DB.prepare("SELECT MAX(sent_at) AS sent FROM booking_telegram_jobs WHERE state='sent' AND job_key LIKE 'command/%'").first<{sent:string|null}>())?.sent??null;lastPollAt=(await env.DB.prepare('SELECT last_poll_at FROM booking_telegram_poll WHERE id=1').first<{last_poll_at:string|null}>())?.last_poll_at??null;}catch{}
 try{await env.DB.prepare('SELECT event_key FROM booking_telegram_payment_events LIMIT 0').all();paymentNotificationsReady=true;lastPaymentAt=(await env.DB.prepare("SELECT MAX(sent_at) AS sent FROM booking_telegram_jobs WHERE state='sent' AND job_key LIKE 'payment/%'").first<{sent:string|null}>())?.sent??null;}catch{}
 return Response.json({configured:c.ready,enabled:c.enabled,reportVersion:6,paymentQueueLookup:'key_range',paymentNotificationsReady,paymentNotificationsEnabled:c.ready&&c.enabled&&paymentNotificationsReady,lastPaymentAt,reportScope:'pos_open_orders',commands:['/check'],commandPollSeconds:60,lastCommandAt,lastPollAt,intervalHours:4,reportTimes,reportWindow:{from:reportTimes[0],to:reportTimes[reportTimes.length-1]},beforeMinutes:120,timeZone:'Asia/Ho_Chi_Minh',lastSentAt,uncertain},{headers:{'Cache-Control':'no-store'}});
}

export type TelegramPayment={booking:Booking;total:number;deposit:number;received:number;tendered:number;method:'cash'|'transfer';paidAt:string};
export function telegramPaymentText(p:TelegramPayment){
 const b=p.booking,clock=vietnamClock(Date.parse(p.paidAt)),set=readMenuSet(b.menu),units=orderUnits(b);
 const items=readMenu(b.menu,units).filter(i=>i.name.trim()).map((item,i)=>`${i+1}. ${item.name} · ${itemQuantity(item)} ${itemUnit(item)}\n   ${item.included?'Trong set':item.price===null?'Theo giá đã chốt':money(item.price)+' × '+itemQuantity(item)+' = '+money(itemAmount(item))}`);
 return ['THANH TOÁN THÀNH CÔNG',`Lúc: ${clock.time} · ${clock.date.split('-').reverse().join('/')} (giờ Việt Nam)`,`Mã đơn: ${b.orderCode||b.id}`,orderLocation(b),`Khách: ${b.name} | ${guestCount(b)} người`,...(b.phone?['Điện thoại: '+b.phone]:[]),`Ngày phục vụ: ${b.date.split('-').reverse().join('/')} · ${b.start}–${b.end}`,'','CHI TIẾT ĐƠN',...(set?[`${set.name} · ${menuSetQuantity(b.menu,units)} set × ${money(set.pricePerTable)} = ${money(set.pricePerTable*menuSetQuantity(b.menu,units))}`]:[]),...(items.length?items:['Chưa có danh sách món. Thanh toán theo giá đã lưu.']),...(b.note?['Ghi chú: '+b.note]:[]),'',`Tổng hóa đơn: ${money(p.total)}`,`Đã đặt cọc: ${money(p.deposit)}`,`THỰC THU LẦN NÀY: ${money(p.received)}`,'Phương thức: '+(p.method==='cash'?'Tiền mặt':'Chuyển khoản'),...(p.method==='cash'?[`Tiền khách đưa: ${money(p.tendered)}`,`Trả lại khách: ${money(p.tendered-p.received)}`]:[]),'Còn phải thu: '+money(0),'','Đây là giao dịch thanh toán đã được ghi nhận trên POS.'].join('\n');
}
async function loadTelegramTableLabels(env:TelegramEnv){
 try{applyZones((await readTableLayout(env.DB)).zones);}catch{/* Use default area names if the shared layout is temporarily unavailable. */}
}
export async function processTelegramPayments(env:TelegramEnv,now=Date.now(),send:typeof fetch=fetch){
 const c=telegramConfig(env);if(!c.ready||!c.enabled)return {sent:0,skipped:'not_configured'};
 await loadTelegramTableLabels(env);
 await env.DB.prepare(schema).run();
 const events=await env.DB.prepare("SELECT event_key,payment_snapshot FROM booking_telegram_payment_events WHERE state IN ('pending','queued') ORDER BY created_at,event_key LIMIT 5").all<{event_key:string;payment_snapshot:string}>();let sent=0;
 for(const event of events.results){
  const id=Array.from(new TextEncoder().encode(event.event_key),byte=>byte.toString(16).padStart(2,'0')).join(''),prefix='payment/'+id+'/'+c.chatId;
  const existing=await env.DB.prepare('SELECT job_key FROM booking_telegram_jobs WHERE job_key>=? AND job_key<? LIMIT 1').bind(prefix+'/',prefix+'0').first();
  if(!existing){
   const payment=JSON.parse(event.payment_snapshot) as TelegramPayment;
   const parts=telegramParts(telegramPaymentText(payment));
   await env.DB.batch(parts.map((text,i)=>env.DB.prepare("INSERT OR IGNORE INTO booking_telegram_jobs(job_key,payload,state) VALUES(?,?,'pending')").bind(prefix+'/'+String(i).padStart(4,'0'),JSON.stringify({chat_id:c.chatId,text,link_preview_options:{is_disabled:true}}))));
  }
  await env.DB.prepare("UPDATE booking_telegram_payment_events SET state='queued' WHERE event_key=? AND state='pending'").bind(event.event_key).run();
  sent+=await deliverTelegramPrefix(env,prefix,now,send);
  const rows=await env.DB.prepare('SELECT state FROM booking_telegram_jobs WHERE job_key>=? AND job_key<?').bind(prefix+'/',prefix+'0').all<{state:string}>();
  const states=rows.results.map(row=>row.state),state=states.some(s=>s==='uncertain')?'uncertain':states.some(s=>s==='error')?'error':states.length&&states.every(s=>s==='sent')?'sent':'queued';
  await env.DB.prepare('UPDATE booking_telegram_payment_events SET state=? WHERE event_key=?').bind(state,event.event_key).run();
 }
 return {sent};
}

type TelegramUpdate={update_id:number;message?:{date?:number;text?:string;from?:{id:number;is_bot?:boolean};chat:{id:number;type:string}}};
export function isTelegramCheck(update:TelegramUpdate,chatId:string){
 const m=update.message;
 return !!m&&m.chat?.type==='private'&&String(m.chat.id)===chatId&&String(m.from?.id)===chatId&&!m.from?.is_bot&&typeof m.text==='string'&&/^\/check(?:@dpa_baocao_2026_bot)?\s*$/i.test(m.text.trim());
}
export async function processTelegramChecks(env:TelegramEnv,now=Date.now(),send:typeof fetch=fetch){
 const c=telegramConfig(env);if(!c.ready)return {sent:0,skipped:'not_configured'};
 await env.DB.prepare(schema).run();
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS booking_telegram_poll(id INTEGER PRIMARY KEY CHECK(id=1),next_offset INTEGER NOT NULL DEFAULT 0,lease_until INTEGER NOT NULL DEFAULT 0,last_poll_at TEXT)').run();
 await env.DB.prepare('INSERT OR IGNORE INTO booking_telegram_poll(id) VALUES(1)').run();
 const lease=now+120000;
 const claim=await env.DB.prepare('UPDATE booking_telegram_poll SET lease_until=? WHERE id=1 AND lease_until<=? RETURNING next_offset').bind(lease,now).first<{next_offset:number}>();
 if(!claim)return {sent:0,skipped:'poll_busy'};
 try{
  let updates:TelegramUpdate[]|null=null;
  try{
   const response=await send('https://api.telegram.org/bot'+c.token+'/getUpdates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({offset:claim.next_offset,timeout:0,limit:30,allowed_updates:['message']}),signal:AbortSignal.timeout(10000)});
   const body=await response.json() as {ok?:boolean;result?:TelegramUpdate[]};
   if(response.ok&&body.ok&&Array.isArray(body.result))updates=body.result;
  }catch{/* Keep the cursor and pending replies intact when Telegram is unavailable. */}
  if(updates){
   for(const update of updates){
    if(!Number.isSafeInteger(update.update_id)||update.update_id<claim.next_offset)continue;
    if(isTelegramCheck(update,c.chatId)){
     const messageTime=Number(update.message?.date)*1000;
     const stamp=Number.isFinite(messageTime)&&messageTime>0&&messageTime<=now+60000?messageTime:now;
     const date=vietnamClock(stamp).date,prefix='command/'+date+'/'+update.update_id+'/'+c.chatId;
     const existing=await env.DB.prepare('SELECT job_key FROM booking_telegram_jobs WHERE job_key>=? AND job_key<? LIMIT 1').bind(prefix+'/',prefix+'0').first();
     if(!existing){
      const response=await getBookings(new Request('https://dpa.internal/api/bookings?date='+date),env.DB);if(!response.ok)throw Error('TELEGRAM_BOOKINGS_UNAVAILABLE');
      const data=await response.json() as {bookings:Booking[]};
      const snapshotTime=date===vietnamClock(now).date?now:stamp;
      const text='TRA CỨU /check\n'+telegramSummary(data.bookings,snapshotTime).text;
      await env.DB.batch(telegramParts(text).map((part,i)=>env.DB.prepare("INSERT OR IGNORE INTO booking_telegram_jobs(job_key,payload,state) VALUES(?,?,'pending')").bind(prefix+'/'+String(i).padStart(4,'0'),JSON.stringify({chat_id:c.chatId,text:part,link_preview_options:{is_disabled:true}}))));
     }
    }
    // Confirm an update only after its reply is durably queued.
    await env.DB.prepare('UPDATE booking_telegram_poll SET next_offset=MAX(next_offset,?) WHERE id=1').bind(update.update_id+1).run();
   }
   await env.DB.prepare('UPDATE booking_telegram_poll SET last_poll_at=? WHERE id=1').bind(new Date(now).toISOString()).run();
  }
  const pending=await env.DB.prepare("SELECT job_key FROM booking_telegram_jobs WHERE job_key LIKE 'command/%' AND state IN ('pending','retry','sending') ORDER BY job_key LIMIT 100").all<{job_key:string}>();
  const prefixes=[...new Set(pending.results.map(row=>row.job_key.slice(0,row.job_key.lastIndexOf('/'))))];let sent=0;
  for(const prefix of prefixes.slice(0,5))sent+=await deliverTelegramPrefix(env,prefix,now,send);
  return {sent};
 }finally{await env.DB.prepare('UPDATE booking_telegram_poll SET lease_until=0 WHERE id=1 AND lease_until=?').bind(lease).run();}
}
export async function processBookingTelegrams(env:TelegramEnv,now=Date.now(),send:typeof fetch=fetch,test=false){
 const c=telegramConfig(env);if(!c.ready||(!test&&!c.enabled))return {sent:0,skipped:'not_configured'};
 const clock=vietnamClock(now);
 await env.DB.prepare(schema).run();
 const bookings:Booking[]=[];
 // The next day is required for bookings whose two-hour reminder falls before midnight.
 for(const date of [clock.date,vietnamClock(now+86400000).date]){
  const response=await getBookings(new Request('https://dpa.internal/api/bookings?date='+date),env.DB);if(!response.ok)throw Error('TELEGRAM_BOOKINGS_UNAVAILABLE');
  const data=await response.json() as {bookings:Booking[]};bookings.push(...data.bookings.filter(b=>b.date===date));
 }
 const jobs=test?[{key:'test/'+clock.date+'/'+clock.time.replace(':',''),text:'[GỬI THỬ]\n'+telegramSummary(bookings,now).text}]:telegramJobs(bookings,now);
 let sent=0;
 // Booking reminders take priority over the periodic summary.
 jobs.sort((a,b)=>Number(b.key.startsWith('arrival/'))-Number(a.key.startsWith('arrival/')));
 for(const job of jobs){
 if(sent>=10)break;
 const prefix=job.key+'/'+c.chatId;
 const existing=await env.DB.prepare('SELECT job_key FROM booking_telegram_jobs WHERE job_key>=? AND job_key<? LIMIT 1').bind(prefix+'/',prefix+'0').first();
 if(!existing){
  if(test){const n=await env.DB.prepare("SELECT COUNT(*) AS n FROM booking_telegram_jobs WHERE job_key LIKE ? AND job_key LIKE '%/0000'").bind('test/'+clock.date+'/%').first<{n:number}>();if((n?.n??0)>=5)return {sent:0,skipped:'test_limit'};}
  const parts=telegramParts(job.text);
  // Atomic snapshot: concurrent ticks keep the same message parts and quantities.
  await env.DB.batch(parts.map((text,i)=>env.DB.prepare("INSERT OR IGNORE INTO booking_telegram_jobs(job_key,payload,state) VALUES(?,?,'pending')").bind(prefix+'/'+String(i).padStart(4,'0'),JSON.stringify({chat_id:c.chatId,text,link_preview_options:{is_disabled:true}}))));
 }
 sent+=await deliverTelegramPrefix(env,prefix,now,send);
 }
 return {sent};
}

async function deliverTelegramPrefix(env:TelegramEnv,prefix:string,now:number,send:typeof fetch){
 const c=telegramConfig(env);let sent=0;
 // Telegram has no idempotency key. A timed-out delivery must not be retried blindly.
 await env.DB.prepare("UPDATE booking_telegram_jobs SET state='uncertain',error_code='DELIVERY_UNCONFIRMED' WHERE state='sending' AND lease_until<=?").bind(now).run();
 const rows=await env.DB.prepare("SELECT job_key,state FROM booking_telegram_jobs WHERE job_key>=? AND job_key<? AND state<>'sent' ORDER BY job_key LIMIT 2").bind(prefix+'/',prefix+'0').all<{job_key:string;state:string}>();
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
 return sent;
}
