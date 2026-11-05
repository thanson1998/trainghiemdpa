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
const booking=()=>({...logic.newPosBooking('2026-11-06'),tables:['S1-01'],start:'18:00',end:'21:00',version:1,menu:menu.writeMenu([{name:'Gà',price:200000,quantity:1}])});
// Execute the production scheduling effect with a controlled clock and save boundary.
const source=fs.readFileSync('pos-panel.tsx','utf8');
const effect=source.slice(source.indexOf(' useEffect(()=>{\n  if(busy||loading||!online'),source.indexOf(' useEffect(()=>{const key='));
function harness(tickets){
 let cleanup;const timers=new Map(),calls=[];
 const context={...logic,state:{tickets,selected:tickets[0].booking.id},latest:{current:{tickets}},busy:false,loading:false,online:true,checkout:null,move:null,reversal:null,pendingCancel:null,pendingClose:'',reloadConfirm:false,recoveryOpen:false,inflight:{current:false},autoAttempts:{current:new Map()},saveRef:{current:(...args)=>calls.push(args)},setTimeout:(fn,ms)=>{assert.equal(ms,900);timers.set(fn,fn);return fn;},clearTimeout:id=>timers.delete(id),useEffect:fn=>{cleanup?.();cleanup=fn();}};
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
 for(const key of ['busy','loading','checkout','move','reversal','pendingCancel','pendingClose','reloadConfirm','recoveryOpen']){const h=harness([{booking:booking(),saved:''}]);h.context[key]=true;h.render();h.flush();assert.equal(h.calls.length,0,key);}
});
