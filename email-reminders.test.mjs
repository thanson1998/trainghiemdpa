import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
const loaded=new Map();
const asUrl=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
function compile(source){return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]([^'"]+)['"]/g,(_,spec)=>'from '+JSON.stringify(resolve(spec)));}
function resolve(spec){if(loaded.has(spec))return loaded.get(spec);let source=fs.readFileSync(spec+'.ts','utf8');if(spec==='./api')source='export async function GET(req,db){return Response.json({bookings:db.bookings});}';const url=asUrl(compile(source));loaded.set(spec,url);return url;}
const mod=await import(resolve('./email-reminders'));
const menu=await import(resolve('./menu'));
const at=s=>Date.parse(s+'+07:00');
const config={dailyTime:'08:00',beforeMinutes:120};
const b=(patch={})=>({id:'booking-1',date:'2026-11-06',start:'18:00',end:'21:00',name:'Khách DPA',phone:'',tables:['S1-05'],people:10,platters:1,price:1000000,menu:menu.writeMenu([{name:'Xôi',price:null,included:true}],{name:'Mẹt xôi gà',pricePerTable:1000000}),note:'',status:'reserved',version:1,...patch});
function db(){const sql=new DatabaseSync(':memory:');return {bookings:[b()],prepare(q){let args=[];return {bind(...a){args=a;return this},async run(){return sql.prepare(q).run(...args)},async first(){return sql.prepare(q).get(...args)||null}}},sql};}
const env=DB=>({DB,RESEND_API_KEY:'test-only-key',BOOKING_EMAIL_TO:'owner@example.com',BOOKING_EMAIL_FROM:'DPA <sender@example.com>',BOOKING_EMAIL_ENABLED:'true'});
test('daily-only at 06:00 Vietnam time, including empty days, without any arrival reminders',()=>{
 assert.deepEqual(mod.vietnamClock(Date.parse('2026-11-05T17:30:00Z')),{date:'2026-11-06',time:'00:30'});
 const six={dailyTime:'06:00',beforeMinutes:0};
 assert.equal(mod.dueEmailJobs([b()],at('2026-11-06T05:59:00'),six).length,0);
 for(const time of ['06:00','08:00','16:00','18:00'])assert.deepEqual(mod.dueEmailJobs([b()],at('2026-11-06T'+time+':00'),six).map(j=>j.kind),['daily']);
 const excluded=[b({status:'cancelled'}),b({paidAt:'paid'}),b({status:'arrived'}),b({serviceType:'takeaway'}),b({date:'2026-11-07'})];
 assert.equal(mod.dueEmailJobs(excluded,at('2026-11-06T06:00:00'),six)[0].bookings.length,0);
 assert.match(mod.reminderContent(mod.dueEmailJobs([],at('2026-11-06T06:00:00'),six)[0]).text,/Hôm nay chưa có bàn đặt/);
 const c=mod.reminderConfig({...env(db()),BOOKING_EMAIL_DAILY_TIME:'08:00',BOOKING_EMAIL_BEFORE_MINUTES:'120'});assert.equal(c.dailyTime,'06:00');assert.equal(c.beforeMinutes,0);
});
test('mail includes the named set, table, quantities and escapes user HTML',()=>{
 const content=mod.reminderContent({kind:'daily',date:'2026-11-06',key:'daily/test',bookings:[b({name:'<img onerror=alert(1)>',note:'A & B'})]});
 assert.match(content.text,/Mẹt xôi gà/);assert.match(content.text,/S1-05/);assert.match(content.text,/10 người/);assert.ok(!content.html.includes('<img'));assert.match(content.html,/&lt;img/);assert.match(content.html,/A &amp; B/);
});
test('configuration is opt-in, validates recipients and does not expose a secret',async()=>{
 const DB=db();let calls=0;await mod.processBookingEmails({...env(DB),BOOKING_EMAIL_ENABLED:'false'},at('2026-11-06T08:00:00'),async()=>{calls++});assert.equal(calls,0);
 assert.equal(mod.reminderConfig({...env(DB),BOOKING_EMAIL_TO:'bad\r\naddress'}).ready,false);
 const status=await(await mod.emailReminderStatus(env(DB))).json();assert.equal(status.recipient,'ow***@example.com');assert.ok(!JSON.stringify(status).includes('test-only-key'));
});
test('persistent journal prevents duplicate mail, preserves payload for retries and retries failures',async()=>{
 const DB=db(),requests=[];let fail=true;const send=async(url,options)=>{requests.push(options);return fail?new Response('',{status:503}):Response.json({id:'provider-1'});};
 await mod.processBookingEmails(env(DB),at('2026-11-06T08:00:00'),send);assert.equal(requests.length,1);
 await mod.processBookingEmails(env(DB),at('2026-11-06T08:01:00'),send);assert.equal(requests.length,1);
 fail=false;DB.bookings=[b({note:'Edited after retry'})];await mod.processBookingEmails(env(DB),at('2026-11-06T08:03:00'),send);assert.equal(requests.length,2);assert.equal(requests[0].body,requests[1].body);assert.equal(requests[0].headers['Idempotency-Key'],requests[1].headers['Idempotency-Key']);
 await mod.processBookingEmails(env(DB),at('2026-11-06T08:04:00'),send);assert.equal(requests.length,2);assert.equal(DB.sql.prepare('SELECT state FROM booking_email_jobs').get().state,'sent');
});
test('concurrent cron ticks claim only one daily delivery; later arrival times do not trigger mail',async()=>{
 const DB=db();let calls=0;const send=async()=>{calls++;return Response.json({id:'provider-'+calls})};
 await Promise.all([mod.processBookingEmails(env(DB),at('2026-11-06T06:00:00'),send),mod.processBookingEmails(env(DB),at('2026-11-06T06:00:00'),send)]);assert.equal(calls,1);
 DB.bookings=Array.from({length:5},(_,i)=>b({id:'row-'+i}));await mod.processBookingEmails(env(DB),at('2026-11-06T16:00:00'),send);assert.equal(calls,1);
});
const request=body=>new Request('https://dpa.internal/api/email-reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('shared schedule persists time and enable state with optimistic concurrency',async()=>{
 const DB=db(),e=env(DB);assert.equal((await mod.loadEmailSchedule(e)).dailyTime,'06:00');
 let r=await mod.saveEmailSchedule(request({enabled:true,dailyTime:'07:30',version:0}),e);assert.equal(r.status,200);let state=await r.json();assert.equal(state.dailyTime,'07:30');assert.equal(state.version,1);assert.equal(state.beforeMinutes,0);
 r=await mod.saveEmailSchedule(request({enabled:false,dailyTime:'09:00',version:0}),e);assert.equal(r.status,409);
 r=await mod.saveEmailSchedule(request({enabled:false,dailyTime:'07:30',version:1}),e);assert.equal(r.status,200);state=await r.json();assert.equal(state.enabled,false);assert.equal(state.nextSendAt,null);
 let calls=0;await mod.processBookingEmails(e,at('2026-11-06T10:00:00'),async()=>{calls++;return Response.json({id:'x'})});assert.equal(calls,0);
 assert.equal((await mod.loadEmailSchedule({...e,BOOKING_EMAIL_ENABLED:'true',BOOKING_EMAIL_DAILY_TIME:'08:00'})).enabled,false);
 r=await mod.saveEmailSchedule(request({enabled:true,dailyTime:'06:00',version:2}),e);assert.equal(r.status,200);
 await mod.processBookingEmails(e,at('2026-11-06T05:59:00'),async()=>{calls++;return Response.json({id:'x'})});assert.equal(calls,0);
 await mod.processBookingEmails(e,at('2026-11-06T06:00:00'),async()=>{calls++;return Response.json({id:'x'})});assert.equal(calls,1);
});
test('settings reject malformed hours, unsupported credential fields, missing versions and conflicting writes',async()=>{
 const DB=db(),e=env(DB);
 for(const body of [{enabled:true,dailyTime:'24:00',version:0},{enabled:true,dailyTime:'6:00',version:0},{enabled:'true',dailyTime:'06:00',version:0},{enabled:true,dailyTime:'06:00'},{enabled:true,dailyTime:'06:00',version:0,to:'other@example.com'}])assert.equal((await mod.saveEmailSchedule(request(body),e)).status,400);
 const results=await Promise.all([mod.saveEmailSchedule(request({enabled:true,dailyTime:'06:00',version:0}),e),mod.saveEmailSchedule(request({enabled:false,dailyTime:'10:00',version:0}),e)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
});
test('next run uses Vietnam time and persisted settings survive repeat migration',async()=>{
 assert.equal(mod.nextDailySend('06:00',at('2026-11-06T05:59:00')),new Date(at('2026-11-06T06:00:00')).toISOString());
 assert.equal(mod.nextDailySend('06:00',at('2026-11-06T06:01:00')),new Date(at('2026-11-07T06:00:00')).toISOString());
 assert.equal(mod.nextDailySend('10:00',at('2026-11-06T08:00:00'),new Date(at('2026-11-06T06:00:00')).toISOString()),new Date(at('2026-11-07T10:00:00')).toISOString());
 const DB=db(),e=env(DB);const sql=fs.readFileSync('0019_email_schedule.sql','utf8');DB.sql.exec(sql);assert.equal((await mod.loadEmailSchedule(e)).dailyTime,'06:00');
 await mod.saveEmailSchedule(request({enabled:false,dailyTime:'05:30',version:1}),e);DB.sql.exec(sql);assert.equal((await mod.loadEmailSchedule(e)).dailyTime,'05:30');assert.equal((await mod.loadEmailSchedule(e)).enabled,false);
});
