import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),loaded=new Map(),asUrl=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
function compile(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]([^'"]+)['"]/g,(_,spec)=>'from '+JSON.stringify(resolve(spec)));}
function resolve(spec){if(!spec.startsWith('./'))return pathToFileURL(require.resolve(spec)).href;if(loaded.has(spec))return loaded.get(spec);let source=fs.readFileSync(spec+'.ts','utf8');if(spec==='./api')source='export async function GET(req,db){const date=new URL(req.url).searchParams.get("date");return Response.json({bookings:db.bookings.filter(b=>b.date===date)});}';const url=asUrl(compile(source));loaded.set(spec,url);return url;}
const mod=await import(resolve('./email-reminders')),reports=await import(resolve('./order-notifications')),menu=await import(resolve('./menu'));
const at=s=>Date.parse(s+'+07:00');
const b=(patch={})=>({id:'booking-1',orderCode:'DPA-06112026-01',date:'2026-11-06',start:'18:00',end:'21:00',name:'Khách DPA',phone:'',tables:['S1-05'],people:10,platters:1,price:1000000,menu:menu.writeMenu([{name:'Xôi',price:null,included:true}],{name:'Mẹt xôi gà',pricePerTable:1000000}),note:'',status:'reserved',version:1,...patch});
function db(){const sql=new DatabaseSync(':memory:');sql.exec("CREATE TABLE booking_payments(booking_id TEXT,booking_version INTEGER,snapshot TEXT,total INTEGER,deposit INTEGER,received INTEGER,tendered INTEGER,method TEXT,paid_at TEXT)");sql.exec(fs.readFileSync('0026_email_payment_events.sql','utf8'));return {bookings:[b()],prepare(q){const s=sql.prepare(q);const bound=(args=[])=>({bind(...a){return bound(a)},async run(){return {meta:{changes:s.run(...args).changes}}},async first(){return s.get(...args)||null},async all(){return {results:s.all(...args)}}});return bound();},sql};}
const env=DB=>({DB,RESEND_API_KEY:'test-only-key',BOOKING_EMAIL_TO:'owner@example.com',BOOKING_EMAIL_FROM:'DPA <sender@example.com>',BOOKING_EMAIL_ENABLED:'true'});
const request=body=>new Request('https://dpa.internal/api/email-reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const sender=calls=>async(url,options)=>{calls.push({url,...options,payload:JSON.parse(options.body)});return Response.json({id:'provider-'+calls.length});};
function payment(DB,version=1,paidAt='2026-11-06T12:00:00Z'){const booking=b({status:'completed'});DB.sql.prepare('INSERT INTO booking_payments VALUES(?,?,?,?,?,?,?,?,?)').run(booking.id,version,JSON.stringify(booking),1000000,200000,800000,1000000,'cash',paidAt);}
test('same five report times as Telegram and same open POS scope',()=>{
 assert.deepEqual(mod.vietnamClock(Date.parse('2026-11-05T17:30:00Z')),{date:'2026-11-06',time:'00:30'});
 for(const time of ['05:59','06:00','09:59','10:00','14:00','18:00','22:00','22:01','23:59']){
 const now=at('2026-11-06T'+time+':00'),bookings=[b({status:'arrived'}),b({id:'completed',status:'completed'}),b({id:'takeaway',serviceType:'takeaway',tables:[]}),b({id:'cancel',status:'cancelled'}),b({id:'paid',paidAt:'paid'})];
 assert.deepEqual(mod.dueEmailJobs(bookings,now).map(x=>x.text),reports.telegramJobs(bookings,now).map(x=>x.text));
 }
 const jobs=mod.dueEmailJobs([b({status:'arrived'})],at('2026-11-06T10:00:00'));
 assert.match(jobs[0].text,/Đang phục vụ: 1/);assert.equal(mod.dueEmailJobs([],at('2026-11-06T23:00:00')).length,0);
 assert.equal(mod.reminderConfig(env(db())).beforeMinutes,120);
});
test('email safely includes full shared content and escapes user text',()=>{
 const booking=b({name:'<img onerror=alert(1)>',note:'A & B'});
 const text=reports.telegramSummary([booking],at('2026-11-06T10:00:00')).text;
 const content=mod.reminderContent({kind:'interval',date:booking.date,key:'test',bookings:[],text});
 assert.equal(content.text,text);assert.match(content.text,/Mẹt xôi gà/);assert.match(content.text,/Bàn 05/);assert.ok(!content.html.includes('<img'));assert.match(content.html,/&lt;img/);assert.match(content.html,/A &amp; B/);
});
test('arrival notices cross midnight, exclude serving, paid and takeaway and deduplicate',async()=>{
 const DB=db(),calls=[];DB.bookings=[b({date:'2026-11-07',start:'00:30',end:'02:00'})];
 const now=at('2026-11-06T22:30:00');assert.equal((await mod.processBookingEmails(env(DB),now,sender(calls))).sent,1);
 assert.match(calls[0].payload.subject,/07\/11\/2026/);assert.match(calls[0].payload.text,/TRƯỚC GIỜ ĐẾN 2 TIẾNG/);
 await mod.processBookingEmails(env(DB),now+60000,sender(calls));assert.equal(calls.length,1);
 for(const patch of [{status:'arrived'},{paidAt:'paid'},{serviceType:'takeaway'}])assert.equal(mod.dueEmailJobs([b(patch)],at('2026-11-06T16:00:00')).filter(x=>x.kind==='arrival').length,0);
});
test('journal retries preserve exact payload, provider idempotency key and do not resend after success',async()=>{
 const DB=db(),calls=[];let fail=true;
 const send=async(url,options)=>{calls.push(options);return fail?new Response('',{status:503}):Response.json({id:'accepted'});};
 await mod.processBookingEmails(env(DB),at('2026-11-06T06:00:00'),send);assert.equal(calls.length,1);
 await mod.processBookingEmails(env(DB),at('2026-11-06T06:01:00'),send);assert.equal(calls.length,1);
 fail=false;DB.bookings=[b({note:'edited'})];await mod.processBookingEmails(env(DB),at('2026-11-06T06:03:00'),send);
 assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);
 await mod.processBookingEmails(env(DB),at('2026-11-06T06:04:00'),send);assert.equal(calls.length,2);
});
test('concurrent ticks claim only one report and a new slot sends a new report',async()=>{
 const DB=db(),calls=[],send=sender(calls),now=at('2026-11-06T06:00:00');
 await Promise.all([mod.processBookingEmails(env(DB),now,send),mod.processBookingEmails(env(DB),now,send)]);assert.equal(calls.length,1);
 await mod.processBookingEmails(env(DB),at('2026-11-06T10:00:00'),send);assert.equal(calls.length,2);
});
test('payment trigger queues only new payments, full receipt email is independent from Telegram and can send at night',async()=>{
 const DB=db(),calls=[];assert.equal(DB.sql.prepare('SELECT COUNT(*) n FROM booking_email_payment_events').get().n,0);payment(DB);
 await mod.processEmailPayments(env(DB),at('2026-11-06T23:00:00'),sender(calls));assert.equal(calls.length,1);
 for(const text of ['THANH TOÁN THÀNH CÔNG','Xôi','1,000,000','200,000','800,000','Tiền mặt','Trả lại khách: 200,000'])assert.ok(calls[0].payload.text.includes(text),text);
 assert.deepEqual(calls[0].payload.to,['owner@example.com']);assert.equal(DB.sql.prepare('SELECT state FROM booking_email_payment_events').get().state,'sent');
 await mod.processEmailPayments(env(DB),at('2026-11-06T23:01:00'),sender(calls));assert.equal(calls.length,1);
 payment(DB,3,'2026-11-06T16:02:00Z');await mod.processEmailPayments(env(DB),at('2026-11-06T23:02:00'),sender(calls));assert.equal(calls.length,2);
 DB.sql.exec(fs.readFileSync('0026_email_payment_events.sql','utf8'));assert.equal(DB.sql.prepare('SELECT COUNT(*) n FROM booking_email_payment_events').get().n,2);
});
test('payment retry survives an interval change and repeated cron retains payment payload',async()=>{
 const DB=db(),calls=[];payment(DB);let fail=true;const send=async(url,options)=>{calls.push(options);return fail?new Response('',{status:429}):Response.json({id:'okay'});};
 await mod.processEmailPayments(env(DB),at('2026-11-06T21:59:00'),send);fail=false;
 await mod.processBookingEmails(env(DB),at('2026-11-06T22:03:00'),send);assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);
});
test('schedule toggle persists with optimistic concurrency and status hides credentials',async()=>{
 const DB=db(),e=env(DB);let response=await mod.saveEmailSchedule(request({enabled:false,dailyTime:'06:00',version:0}),e);assert.equal(response.status,200);let status=await response.json();assert.equal(status.enabled,false);assert.equal(status.nextSendAt,null);assert.equal(status.beforeMinutes,120);assert.deepEqual(status.reportTimes,['06:00','10:00','14:00','18:00','22:00']);assert.equal(status.recipient,'ow***@example.com');assert.ok(!JSON.stringify(status).includes(e.RESEND_API_KEY));
 assert.equal((await mod.saveEmailSchedule(request({enabled:true,dailyTime:'06:00',version:0}),e)).status,409);
 payment(DB);const calls=[];await mod.processBookingEmails(e,at('2026-11-06T10:00:00'),sender(calls));await mod.processEmailPayments(e,at('2026-11-06T10:00:00'),sender(calls));assert.equal(calls.length,0);
 assert.equal((await mod.saveEmailSchedule(request({enabled:true,dailyTime:'06:00',version:1}),e)).status,200);
 for(const body of [{enabled:true,dailyTime:'24:00',version:2},{enabled:true,dailyTime:'07:30',version:2},{enabled:true,dailyTime:'06:00'},{enabled:true,dailyTime:'06:00',version:2,to:'other@example.com'}])assert.equal((await mod.saveEmailSchedule(request(body),e)).status,400);
 assert.equal(mod.reminderConfig({...e,BOOKING_EMAIL_TO:'bad\r\naddress'}).ready,false);
});
test('next report time respects the Vietnam day boundary',()=>{
 assert.equal(mod.nextReportSend(at('2026-11-06T05:59:00')),new Date(at('2026-11-06T06:00:00')).toISOString());
 assert.equal(mod.nextReportSend(at('2026-11-06T06:01:00')),new Date(at('2026-11-06T10:00:00')).toISOString());
 assert.equal(mod.nextReportSend(at('2026-11-06T22:01:00')),new Date(at('2026-11-07T06:00:00')).toISOString());
});
test('manual report is separate, respects recipient and rate limits and works outside report hours',async()=>{
 const DB=db(),e=env(DB),calls=[],send=sender(calls),req=()=>request({}),now=at('2026-11-06T05:00:00');
 assert.equal((await mod.sendTestBookingEmail(req(),e,now,send)).status,200);assert.match(calls[0].payload.subject,/GỬI THỬ/);assert.deepEqual(calls[0].payload.to,['owner@example.com']);
 assert.equal((await mod.sendTestBookingEmail(req(),e,now+20000,send)).status,429);assert.equal((await mod.sendTestBookingEmail(request({to:'other@example.com'}),e,now+60000,send)).status,400);
 assert.equal((await(await mod.emailReminderStatus(e)).json()).lastSentAt,null);
 await mod.processBookingEmails(e,at('2026-11-06T06:00:00'),send);assert.equal(calls.length,2);
});

test('failed periodic reports wait until the allowed report window and do not spill into the next day',async()=>{
 const DB=db(),e=env(DB),calls=[];DB.bookings=[];const fail=async()=>{calls.push('failed');return new Response('',{status:503});};await mod.processBookingEmails(e,at('2026-11-06T22:00:00'),fail);assert.equal(calls.length,1);
 await mod.processBookingEmails(e,at('2026-11-06T22:03:00'),sender(calls));assert.equal(calls.length,1);
 await mod.processBookingEmails(e,at('2026-11-07T06:00:00'),sender(calls));assert.equal(calls.length,2);assert.match(calls[1].payload.subject,/07\/11\/2026/);
});
