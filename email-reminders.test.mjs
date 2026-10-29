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
test('Vietnam clock, daily schedule, before-arrival and midnight boundaries',()=>{
 assert.deepEqual(mod.vietnamClock(Date.parse('2026-11-05T17:30:00Z')),{date:'2026-11-06',time:'00:30'});
 assert.equal(mod.dueEmailJobs([b()],at('2026-11-06T07:59:00'),config).length,0);
 assert.deepEqual(mod.dueEmailJobs([b()],at('2026-11-06T08:00:00'),config).map(j=>j.kind),['daily']);
 assert.deepEqual(mod.dueEmailJobs([b()],at('2026-11-06T16:00:00'),config).map(j=>j.kind),['daily','before']);
 assert.equal(mod.dueEmailJobs([b()],at('2026-11-06T18:00:00'),config).length,0);
 assert.deepEqual(mod.dueEmailJobs([b({date:'2026-11-07',start:'00:30'})],at('2026-11-06T23:00:00'),config).map(j=>j.kind),['before']);
 assert.equal(mod.dueEmailJobs([b({status:'cancelled'}),b({paidAt:'paid'}),b({status:'arrived'}),b({serviceType:'takeaway'})],at('2026-11-06T16:00:00'),config).length,0);
 assert.deepEqual(mod.dueEmailJobs([b()],at('2026-11-06T16:00:00'),{...config,beforeMinutes:0}).map(j=>j.kind),['daily']);
});
test('mail includes the named set, table, quantities and escapes user HTML',()=>{
 const content=mod.reminderContent({kind:'daily',key:'daily/test',bookings:[b({name:'<img onerror=alert(1)>',note:'A & B'})]});
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
test('concurrent ticks claim a single delivery, with bounded sending and no starvation',async()=>{
 const DB=db();let calls=0;const send=async()=>{calls++;return Response.json({id:'provider-'+calls})};
 await Promise.all([mod.processBookingEmails(env(DB),at('2026-11-06T08:00:00'),send),mod.processBookingEmails(env(DB),at('2026-11-06T08:00:00'),send)]);assert.equal(calls,1);
 DB.bookings=Array.from({length:5},(_,i)=>b({id:'row-'+i}));await mod.processBookingEmails(env(DB),at('2026-11-06T16:00:00'),send);assert.equal(calls,3);await mod.processBookingEmails(env(DB),at('2026-11-06T16:01:00'),send);assert.equal(calls,5);await mod.processBookingEmails(env(DB),at('2026-11-06T16:02:00'),send);assert.equal(calls,6);
});
