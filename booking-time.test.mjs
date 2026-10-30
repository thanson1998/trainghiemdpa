import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const code=ts.transpileModule(fs.readFileSync('time-input-value.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {automaticBookingEnd,normalizeTimeInput}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('start time calculates a three-hour end while retaining minutes',()=>{
 for(const [start,end] of [['00:00','03:00'],['09:15','12:15'],['11:00','14:00'],['18:45','21:45'],['20:59','23:59']])assert.equal(automaticBookingEnd(start),end);
 assert.equal(automaticBookingEnd(normalizeTimeInput('1130')),'14:30');
 assert.equal(automaticBookingEnd(normalizeTimeInput('9',true)),'12:00');
});
test('incomplete or invalid input leaves the existing end untouched',()=>{
 for(const start of ['','1','18:','18:0','2400','24:00','12:60','hello'])assert.equal(automaticBookingEnd(start),undefined);
});
test('late starts respect the existing same-day reservation boundary',()=>{
 for(const start of ['21:00','22:30','23:59'])assert.equal(automaticBookingEnd(start),'23:59');
});
test('published-client bridge updates the end and retains a manual end until the start is edited',async()=>{
 const handlers={};
 class Input{
  constructor(value){this.current=value;this.isConnected=true;}
  get value(){return this.current;}
  set value(value){this.current=value;}
  closest(selector){return selector==='label'?this.label:null;}
  dispatchEvent(event){handlers[event.type]?.({target:this});}
 }
 class Select{}
 const start=new Input('11:30'),end=new Input('13:00');
 const scope={querySelectorAll:()=>labels};
 const label=(text,input)=>{const node={nodeType:3,textContent:text};const result={parentElement:scope,childNodes:[node],get textContent(){return node.textContent;},querySelector:()=>input};input.label=result;return result;};
 const labels=[label('Bắt đầu (24h)',start),label('Kết thúc (24h)',end)];
 vm.runInNewContext(fs.readFileSync('booking-time-defaults.js','utf8'),{
  document:{documentElement:{},querySelectorAll:()=>labels,addEventListener:(name,fn)=>handlers[name]=fn},
  HTMLInputElement:Input,HTMLSelectElement:Select,MutationObserver:class{observe(){}},queueMicrotask,Event
 });
 assert.equal(labels[0].textContent,'Bắt đầu');assert.equal(labels[1].textContent,'Kết thúc');
 handlers.input({target:start});await new Promise(resolve=>queueMicrotask(resolve));assert.equal(end.value,'14:30');
 handlers.focusout({target:start});await new Promise(resolve=>queueMicrotask(resolve));
 end.value='16:00';handlers.focusout({target:start});await new Promise(resolve=>queueMicrotask(resolve));assert.equal(end.value,'16:00');
 start.value='1800';handlers.input({target:start});await new Promise(resolve=>queueMicrotask(resolve));assert.equal(end.value,'21:00');
 start.value='18:';handlers.input({target:start});await new Promise(resolve=>queueMicrotask(resolve));assert.equal(end.value,'21:00');
});
