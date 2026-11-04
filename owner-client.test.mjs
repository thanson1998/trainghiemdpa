import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('auth-session.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');
test('browser sessions are scoped to the API origin and stale failures cannot log out a newer session',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage'),store=new Map();
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)}});
 try{
  const session=await import(url+'#scoping');session.saveOwnerSession({token:'a'.repeat(64),expiresAt:Date.now()+60000,origin:'https://api.example'});
  assert.equal(session.ownerToken('https://api.example'),'a'.repeat(64));assert.equal(session.ownerToken('https://another.example'),'');
  session.saveOwnerSession({token:'b'.repeat(64),expiresAt:Date.now()+60000,origin:'https://api.example'});
  session.clearOwnerSession('a'.repeat(64));assert.equal(session.ownerToken('https://api.example'),'b'.repeat(64));
  session.clearOwnerSession('b'.repeat(64));assert.equal(session.ownerToken('https://api.example'),'');assert.equal(store.size,0);
 }finally{if(original)Object.defineProperty(globalThis,'sessionStorage',original);else delete globalThis.sessionStorage;}
});
test('expired or malformed saved sessions are ignored and storage failures still permit an in-memory login',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 try{
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>JSON.stringify({token:'a'.repeat(64),expiresAt:Date.now()-1000,origin:'https://api.example'})}});
  const expired=await import(url+'#expired');assert.equal(expired.ownerToken('https://api.example'),'');
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}}});
  const blocked=await import(url+'#blocked');blocked.saveOwnerSession({token:'c'.repeat(64),expiresAt:Date.now()+60000,origin:'https://api.example'});assert.equal(blocked.ownerToken('https://api.example'),'c'.repeat(64));blocked.clearOwnerSession();assert.equal(blocked.ownerToken('https://api.example'),'');
 }finally{if(original)Object.defineProperty(globalThis,'sessionStorage',original);else delete globalThis.sessionStorage;}
});
