import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),memo=new Map();
function resolve(spec){
 if(!spec.startsWith('./'))return pathToFileURL(require.resolve(spec)).href;
 if(memo.has(spec))return memo.get(spec);
 const file=[spec,spec+'.ts',spec+'.tsx'].find(p=>fs.existsSync(p));
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]([^'"]+)['"]/g,(_,s)=>'from '+JSON.stringify(resolve(s)));
 const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');memo.set(spec,url);return url;
}
const logic=await import(resolve('./pos-logic')),menu=await import(resolve('./menu'));
const {acknowledgePosSave,savePosInBackground}=await import(resolve('./pos-background-save'));
const booking=()=>({...logic.newPosBooking('2026-11-06'),tables:['S1-01'],start:'18:00',end:'21:00',version:1,menu:menu.writeMenu([{name:'Gà',price:200000,quantity:1}])});
// Execute the production scheduling effect with a controlled clock and save boundary.
const source=fs.readFileSync('pos-panel.tsx','utf8');
const effect=source.slice(source.indexOf(' useEffect(()=>{\n  if(busy||backgroundSaving||loading||!online'),source.indexOf(' useEffect(()=>{const key='));
function harness(tickets){
 let cleanup;const timers=new Map(),calls=[];
 const context={...logic,state:{tickets,selected:tickets[0].booking.id},latest:{current:{tickets}},busy:false,backgroundSaving:false,loading:false,online:true,checkout:null,move:null,reversal:null,pendingCancel:null,pendingClose:'',reloadConfirm:false,recoveryOpen:false,inflight:{current:false},autoAttempts:{current:new Map()},saveRef:{current:(...args)=>calls.push(args)},setTimeout:(fn,ms)=>{assert.equal(ms,900);timers.set(fn,fn);return fn;},clearTimeout:id=>timers.delete(id),useEffect:fn=>{cleanup?.();cleanup=fn();}};
 return {context,calls,render:()=>vm.runInNewContext(effect,context),flush:()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn();}},pending:()=>timers.size};
}
test('rapid dish additions coalesce into one save of the latest quantities',()=>{
 const original=booking(),ticket={booking:original,saved:logic.posFingerprint(original)},h=harness([ticket]);h.render();assert.equal(h.pending(),0);
 const update=()=>{ticket.booking=logic.posAppend(ticket.booking,[{name:'Tôm',price:30000,quantity:1}]);h.render();};
 update();update();update();assert.equal(h.pending(),1);h.flush();assert.equal(h.calls.length,1);
 assert.equal(menu.readMenu(h.calls[0][1].menu).find(i=>i.name==='Tôm').quantity,3);assert.equal(h.calls[0][2],true);
});
test('removing the last dish from an existing order saves an empty menu, while new empty tickets stay drafts',()=>{
 const b=booking(),t={booking:{...b,menu:menu.writeMenu([])},saved:logic.posFingerprint(b)},h=harness([t]);
 assert.equal(logic.posIssue(t.booking),'');assert.notEqual(logic.posIssue({...t.booking,version:0}),'');assert.notEqual(logic.posIssue(t.booking,'pay'),'');h.render();h.flush();assert.equal(h.calls.length,1);assert.equal(menu.readMenu(h.calls[0][1].menu).length,0);
});
test('offline edits stay pending, retry on reconnect, and repeated failures do not loop',()=>{
 const b=booking(),h=harness([{booking:b,saved:''}]);h.context.online=false;h.render();h.flush();assert.equal(h.calls.length,0);
 h.context.online=true;h.render();h.flush();assert.equal(h.calls.length,1);h.render();h.flush();assert.equal(h.calls.length,1);
 h.context.autoAttempts.current.clear();h.render();h.flush();assert.equal(h.calls.length,2);
});
test('other tickets save after switching and stale timers cannot save removed or superseded drafts',()=>{
 const b=booking(),h=harness([{booking:b,saved:''}]);h.context.state.selected='another-ticket';h.render();h.flush();assert.equal(h.calls[0][1].id,b.id);
 h.context.autoAttempts.current.clear();h.render();h.context.latest.current.tickets=[];h.flush();assert.equal(h.calls.length,1);
});
test('invalid, paid, cancelled orders and payment or confirmation dialogs never auto save',()=>{
 for(const patch of [{tables:[]},{paidAt:new Date().toISOString()},{status:'cancelled'}]){const h=harness([{booking:{...booking(),...patch},saved:''}]);h.render();h.flush();assert.equal(h.calls.length,0);}
 for(const key of ['busy','backgroundSaving','loading','checkout','move','reversal','pendingCancel','pendingClose','reloadConfirm','recoveryOpen']){const h=harness([{booking:booking(),saved:''}]);h.context[key]=true;h.render();h.flush();assert.equal(h.calls.length,0,key);}
});

test('slow background saves preserve dish edits and the next request includes those edits at the new version',async()=>{
 const submitted=booking();let ticket={booking:submitted,saved:''},release;
 const waiting=new Promise(resolve=>{release=resolve;});const writes=[];
 const request=async(path,options)=>{
  if(options?.method==='POST'){writes.push(JSON.parse(options.body));await waiting;return Response.json({version:2});}
  return Response.json({bookings:[{...submitted,version:2,orderCode:'DPA-20261106-01'}]});
 };
 const pending=savePosInBackground(submitted,request,saved=>{ticket=acknowledgePosSave(ticket,submitted,saved);});
 ticket={...ticket,booking:logic.posAppend(ticket.booking,[{name:'Tôm',price:30000,quantity:2}])};
 release();await pending;
 assert.equal(ticket.booking.version,2);assert.equal(ticket.booking.orderCode,'DPA-20261106-01');
 assert.equal(menu.readMenu(ticket.booking.menu).find(i=>i.name==='Tôm').quantity,2);assert.equal(logic.posDirty(ticket),true);
 const next=ticket.booking;
 await savePosInBackground(next,async(path,options)=>{
  if(options?.method==='POST'){writes.push(JSON.parse(options.body));return Response.json({version:3});}
  return Response.json({bookings:[{...next,version:3}]});
 },saved=>{ticket=acknowledgePosSave(ticket,next,saved);});
 assert.equal(writes[0].version,1);assert.equal(writes[1].version,2);assert.equal(menu.readMenu(writes[1].menu).length,2);assert.equal(logic.posDirty(ticket),false);
});
test('deleting or editing while verification is pending never gets overwritten by the acknowledgement',async()=>{
 const submitted=booking();let ticket={booking:submitted,saved:''},release;
 const check=new Promise(resolve=>{release=resolve;});
 const pending=savePosInBackground(submitted,async(path,options)=>{
  if(options?.method==='POST')return Response.json({version:2});
  await check;return Response.json({bookings:[{...submitted,version:2}]});
 },saved=>{ticket=acknowledgePosSave(ticket,submitted,saved);});
 await new Promise(resolve=>setImmediate(resolve));
 ticket={...ticket,booking:{...ticket.booking,menu:menu.writeMenu([]),name:'Changed during save'}};
 release();await pending;assert.equal(menu.readMenu(ticket.booking.menu).length,0);assert.equal(ticket.booking.name,'Changed during save');assert.equal(logic.posDirty(ticket),true);
});
test('failed or conflicting saves keep the draft; an accepted write retains its version when verification fails',async()=>{
 const submitted=booking(),original={booking:submitted,saved:''};let ticket=original;
 await assert.rejects(savePosInBackground(submitted,async()=>Response.json({error:'Conflict'},{status:409}),saved=>{ticket=acknowledgePosSave(ticket,submitted,saved);}),/Conflict/);
 assert.equal(ticket,original);
 await assert.rejects(savePosInBackground(submitted,async(path,options)=>options?.method==='POST'?Response.json({version:2}):Response.json({error:'Offline'},{status:503}),saved=>{ticket=acknowledgePosSave(ticket,submitted,saved);}),/chưa kiểm tra/);
 assert.equal(ticket.booking.version,2);assert.equal(ticket.booking.menu,submitted.menu);
 const newer={booking:{...submitted,version:5,name:'Server changed'},saved:''};assert.equal(acknowledgePosSave(newer,submitted,{...submitted,version:2}),newer);
});
