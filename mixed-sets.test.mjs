import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {renderToStaticMarkup} from 'react-dom/server';
import React from 'react';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),cache=new Map();
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
function resolve(spec){
 if(!spec.startsWith('.'))return spec.startsWith('node:')?spec:pathToFileURL(require.resolve(spec)).href;
 if(spec.endsWith('.css'))return url('');
 if(cache.has(spec))return cache.get(spec);
 const file=[spec,spec+'.ts',spec+'.tsx'].find(f=>fs.existsSync(f));
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from ['"]([^'"]+)['"]/g,(_,s)=>'from '+JSON.stringify(resolve(s))).replace(/import ['"]([^'"]+)['"]/g,(_,s)=>'import '+JSON.stringify(resolve(s)));
 const result=url(code);cache.set(spec,result);return result;
}
const menu=await import(resolve('./menu')),{appendPosTemplate:append}=await import(resolve('./pos-append-template'));
const {kitchenDelta}=await import(resolve('./kitchen-delta')),{updateBookingDraft}=await import(resolve('./booking-logic'));
const {CheckoutBill}=await import(resolve('./checkout-bill')),{PaymentMenuLines}=await import(resolve('./payment-menu-lines'));
const xoi={name:'Mẹt xôi gà',menu:menu.writeMenu([{name:'Gà',price:null,included:true,quantity:1},{name:'Xôi',price:null,included:true,quantity:1}],{name:'Mẹt xôi gà',pricePerTable:1000000,quantity:1,people:8})};
const lau={name:'Lẩu thập cẩm',menu:menu.writeMenu([{name:'Gà',price:null,included:true,quantity:1},{name:'Tôm',price:null,included:true,quantity:2}],{name:'Lẩu thập cẩm',pricePerTable:1500000,quantity:1,people:8})};
const base={id:'test',date:'2026-11-04',start:'18:00',end:'21:00',name:'Khách kiểm tra',phone:'',tables:[],people:1,totalPeople:1,platters:1,price:0,priceMode:'auto',deposit:0,menu:'',note:'',status:'arrived',version:0};
test('two different sets append with independent quantities, extras and table-independent totals',()=>{
 const beer=menu.writeMenu([{name:'Bia',price:20000,quantity:3}]);
 const first=append(beer,xoi,1,4),mixed=append(first,lau,2,4);
 assert.equal(menu.menuSum(first,4),1060000);assert.equal(menu.menuSum(mixed,4),4060000);
 assert.equal(menu.validMenu(mixed),true);assert.equal(menu.readMenuSet(mixed).parts.length,2);
 assert.deepEqual(menu.readMenuSet(mixed).parts.map(p=>p.quantity),[1,2]);
 assert.equal(menu.readMenu(mixed).find(p=>p.name==='Xôi').quantity,1);
 assert.equal(menu.readMenu(mixed).find(p=>p.name==='Tôm').quantity,4);
 assert.equal(menu.readMenu(mixed).filter(p=>p.name==='Gà').reduce((n,p)=>n+menu.itemQuantity(p),0),3);
 assert.equal(menu.menuSum(append(mixed,lau,1,4),4),5560000);
 const restored=JSON.parse(JSON.stringify({menu:mixed}));assert.equal(menu.menuSum(restored.menu,9),4060000);
 assert.equal(updateBookingDraft({...base,menu:mixed},'serviceType','takeaway').menu,mixed);
});
test('adding a second set does not cancel or resend dishes already sent to the kitchen',()=>{
 const first=append('',xoi,1),mixed=append(first,lau,1);
 const delta=kitchenDelta({...base,menu:first},{...base,menu:mixed});
 assert.deepEqual(delta.removed,[]);assert.equal(delta.added.reduce((n,p)=>n+p.quantity,0),3);
 assert.ok(delta.added.every(p=>p.note.includes('Lẩu thập cẩm')));
});
test('bill and receipt show each set and its actual quantity and subtotal',()=>{
 const b={...base,menu:append(append('',xoi,1),lau,2)};
 for(const Component of [CheckoutBill,PaymentMenuLines]){
  const html=renderToStaticMarkup(React.createElement(Component,{booking:b}));
  assert.ok(html.includes('Mẹt xôi gà'));assert.ok(html.includes('Lẩu thập cẩm'));
  assert.ok(html.includes('1,000,000'));assert.ok(html.includes('3,000,000'));
 }
});
test('legacy implicit quantities survive append and invalid totals are rejected',()=>{
 const legacy=menu.writeMenu([{name:'Xôi',price:null,included:true}],{name:'Mẹt xôi gà',pricePerTable:1000000});
 const mixed=append(legacy,lau,1,3);assert.equal(menu.menuSum(mixed,3),4500000);
 assert.equal(menu.readMenu(mixed).find(p=>p.name==='Xôi').quantity,3);
 assert.throws(()=>append('',xoi,0));assert.throws(()=>append(append('',xoi,50),lau,50));
 const data=JSON.parse(mixed.slice('DPA_MENU_V2:'.length));data.set.pricePerTable=1;
 assert.equal(menu.validMenu('DPA_MENU_V2:'+JSON.stringify(data)),false);
});
