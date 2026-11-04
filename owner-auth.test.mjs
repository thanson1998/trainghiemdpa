import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const require=createRequire(import.meta.url),memo=new Map();
function resolve(spec){
 if(!spec.startsWith('./'))return pathToFileURL(require.resolve(spec)).href;
 if(memo.has(spec))return memo.get(spec);
 const file=[spec,spec+'.ts'].find(f=>fs.existsSync(f));
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]([^'"]+)['"]/g,(_,s)=>'from '+JSON.stringify(resolve(s)));
 const result='data:text/javascript;base64,'+Buffer.from(code).toString('base64');memo.set(spec,result);return result;
}
const auth=await import(resolve('./owner-auth')),worker=(await import(resolve('./worker'))).default;
const setupKey='TEST_ONLY_SETUP_KEY_NOT_A_REAL_SECRET_2026';
const password='TEST ONLY long owner password 2026!';
function database(){
 const sqlite=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync('.').filter(f=>/^\d{4}_.*\.sql$/.test(f)).sort())sqlite.exec(fs.readFileSync(file,'utf8'));
 const statement=(sql,values=[])=>({bind(...args){return statement(sql,args);},async first(){return sqlite.prepare(sql).get(...values)??null;},async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}});
 const DB={prepare:sql=>statement(sql),async batch(statements){sqlite.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.all());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 return {sqlite,env:{DB,DPA_OWNER_SETUP_KEY:setupKey,ASSETS:{fetch:()=>new Response('public application shell')}}};
}
function req(path,body,token,extra={}){return new Request('https://worker.example'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});}
const call=(env,path,body,token,headers)=>worker.fetch(req(path,body,token,headers),env);
async function setup(env){assert.equal((await call(env,'/api/auth/setup',{username:'owner',password,setupKey})).status,200);}
async function login(env,pwd=password){const r=await call(env,'/api/auth/login',{username:'owner',password:pwd});assert.equal(r.status,200);return r.json();}

test('anonymous requests cannot read or mutate any business route, even before owner setup',async()=>{
 const {sqlite,env}=database();try{
  const paths=['/api/bookings?date=2026-11-04','/api/catalog','/api/catalog/import','/api/backups','/api/backups/restore','/api/backup','/api/history','/api/history/restore','/api/order-history','/api/payments','/api/payments/reverse','/api/pos/bank','/api/pos/shift','/api/table-layout','/api/bookings/move','/api/bookings/prints','/api/email-reminders','/api/email-reminders/test','/api/telegram-reminders','/api/import-text','/api/ai-status','/api/ai-check','/api/dish-images','/api/market-connection','/api/market-feed','/api/market-research'];
  for(const path of paths)for(const body of [undefined,{}]){const r=await call(env,path,body);assert.equal(r.status,401,path);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.deepEqual(Object.keys(await r.json()),['error']);}
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM reservations').get().n,0);
  assert.equal((await call(env,'/api/bookings?date=2026-11-04&token='+'a'.repeat(64))).status,401);
  assert.equal((await call(env,'/api/backup',undefined,undefined,{Authorization:'Basic fake'})).status,401);
 }finally{sqlite.close();}
});
test('setup is disabled without a private runtime key, requires a valid key, and can run only once',async()=>{
 const {sqlite,env}=database();try{
  let r=await call({...env,DPA_OWNER_SETUP_KEY:undefined},'/api/auth/setup',{username:'owner',password,setupKey});assert.equal(r.status,403);
  assert.equal((await call(env,'/api/auth/setup',{username:'owner',password,setupKey:'wrong'})).status,403);
  assert.equal((await call(env,'/api/auth/setup',{username:'owner',password:'short',setupKey})).status,400);
  await setup(env);
  assert.equal((await call(env,'/api/auth/setup',{username:'attacker',password,setupKey})).status,409);
  const account=sqlite.prepare('SELECT * FROM owner_account').get();assert.equal(account.username,'owner');assert.match(account.password_hash,/^pbkdf2-sha256\$100000\$/);assert(!account.password_hash.includes(password));
  const status=await(await call(env,'/api/auth/status')).json();assert.deepEqual(status,{configured:true,setupAvailable:true,googleClientId:null});
 }finally{sqlite.close();}
});
test('two first-time setup requests cannot overwrite each other',async()=>{
 const {sqlite,env}=database();try{
  const results=await Promise.all(['one','two'].map(username=>call(env,'/api/auth/setup',{username,password,setupKey})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM owner_account').get().n,1);
 }finally{sqlite.close();}
});
test('owner login grants the only role, stores only token hashes, and authorizes protected endpoints',async()=>{
 const {sqlite,env}=database();try{
  await setup(env);
  for(const body of [{username:'owner',password:'wrong'},{username:'unknown',password}])assert.equal((await call(env,'/api/auth/login',body)).status,401);
  const session=await login(env);assert.deepEqual(session.user,{username:'owner',role:'owner',passwordEnabled:true});assert.match(session.token,/^[a-f0-9]{64}$/);assert(session.expiresAt>Date.now());
  const row=sqlite.prepare('SELECT * FROM owner_sessions').get();assert.notEqual(row.token_hash,session.token);assert.equal(row.token_hash,createHash('sha256').update(session.token).digest('hex'));
  assert.equal((await call(env,'/api/auth/me',undefined,session.token)).status,200);
  for(const path of ['/api/bookings?date=2026-11-04','/api/catalog','/api/pos/bank','/api/backups','/api/backup'])assert.equal((await call(env,path,undefined,session.token)).status,200,path);
  const backup=await(await call(env,'/api/backup',undefined,session.token)).text();assert(!backup.includes('password_hash'));assert(!backup.includes(session.token));assert(!backup.includes(row.token_hash));assert(!backup.includes(setupKey));
  assert.equal((await call(env,'/api/auth/me',undefined,'f'.repeat(64))).status,401);
 }finally{sqlite.close();}
});
test('logout revokes that device; expiration and password change revoke access server-side',async()=>{
 const {sqlite,env}=database();try{
  await setup(env);const one=await login(env),two=await login(env);
  assert.equal((await call(env,'/api/auth/logout',{},one.token)).status,200);assert.equal((await call(env,'/api/catalog',undefined,one.token)).status,401);assert.equal((await call(env,'/api/catalog',undefined,two.token)).status,200);
  assert.equal((await call(env,'/api/auth/password',{currentPassword:'wrong',password:password+'new'},two.token)).status,400);
  assert.equal((await call(env,'/api/auth/password',{currentPassword:password,password:password+'new'},two.token)).status,200);
  assert.equal((await call(env,'/api/backup',undefined,two.token)).status,401);
  assert.equal((await call(env,'/api/auth/login',{username:'owner',password})).status,401);
  const updated=await login(env,password+'new');sqlite.exec('UPDATE owner_sessions SET expires_at=0');assert.equal((await call(env,'/api/catalog',undefined,updated.token)).status,401);
 }finally{sqlite.close();}
});
test('private-key recovery works without a session and invalidates every existing session',async()=>{
 const {sqlite,env}=database();try{
  await setup(env);const session=await login(env);
  assert.equal((await call(env,'/api/auth/recover',{username:'newowner',password,setupKey:'wrong'})).status,403);
  assert.equal((await call(env,'/api/catalog',undefined,session.token)).status,200);
  assert.equal((await call(env,'/api/auth/recover',{username:'newowner',password:password+'new',setupKey})).status,200);
  assert.equal((await call(env,'/api/catalog',undefined,session.token)).status,401);
  assert.equal((await call(env,'/api/auth/login',{username:'newowner',password:password+'new'})).status,200);
 }finally{sqlite.close();}
});
test('password salts differ; guesses are limited persistently across requests',async()=>{
 const {sqlite,env}=database();try{
  const one=await auth.hashOwnerPassword(password),two=await auth.hashOwnerPassword(password);assert.notEqual(one,two);assert(await auth.verifyOwnerPassword(password,one));assert(!await auth.verifyOwnerPassword('incorrect',one));
  await setup(env);for(let i=0;i<10;i++)assert.equal((await call(env,'/api/auth/login',{username:'owner',password:'wrong'})).status,401);
  assert.equal((await call(env,'/api/auth/login',{username:'owner',password})).status,429);
  assert.equal((await call(env,'/api/auth/login',{username:'owner',password},undefined,{'CF-Connecting-IP':'192.0.2.2'})).status,200);
  assert(sqlite.prepare('SELECT COUNT(*) n FROM owner_auth_limits').get().n>0);
 }finally{sqlite.close();}
});
test('CORS allows Authorization for Pages, rejects foreign origins, and never uses cookies or query credentials',async()=>{
 const {sqlite,env}=database();try{
  const origin='https://thanson1998.github.io';
  const preflight=await worker.fetch(new Request('https://worker.example/api/auth/login',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Headers':'authorization,content-type'}}),env);
  assert.equal(preflight.status,204);assert(preflight.headers.get('Access-Control-Allow-Headers').includes('Authorization'));assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
  assert.equal((await call(env,'/api/auth/status',undefined,undefined,{Origin:'https://evil.invalid'})).status,403);
  await setup(env);const session=await login(env);
  assert.equal((await call(env,'/api/catalog',undefined,undefined,{Cookie:'session='+session.token})).status,401);
  assert.equal((await call(env,'/api/catalog?token='+session.token)).status,401);
 }finally{sqlite.close();}
});
test('auth rejects wrong methods, invalid JSON and excessive payloads; unavailable storage fails closed',async()=>{
 const {sqlite,env}=database();try{
  assert.equal((await call(env,'/api/auth/login')).status,405);
  assert.equal((await worker.fetch(new Request('https://worker.example/api/auth/login',{method:'POST',body:'{}'}),env)).status,415);
  assert.equal((await worker.fetch(new Request('https://worker.example/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'}),env)).status,400);
  assert.equal((await call(env,'/api/auth/login',{username:'x'.repeat(9000),password})).status,413);
  const broken={...env,DB:{prepare(){throw Error('database unavailable')}}};
  assert.equal((await call(broken,'/api/auth/status')).status,503);assert.equal((await call(broken,'/api/catalog',undefined,'f'.repeat(64))).status,503);
 }finally{sqlite.close();}
});

const google=await import(resolve('./google-owner'));
const googleClientId='test-only-owner.apps.googleusercontent.com',googleEmail='test.owner.only@gmail.com';
const rsa=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const googleJwk={...await crypto.subtle.exportKey('jwk',rsa.publicKey),kid:'test-only-key',alg:'RS256',use:'sig'};
const base64url=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
async function googleToken(nonce,patch={}){
 const now=Math.floor(Date.now()/1000),header=base64url({alg:'RS256',typ:'JWT',kid:googleJwk.kid}),payload=base64url({iss:'https://accounts.google.com',aud:googleClientId,sub:'test-google-owner-sub',email:googleEmail,email_verified:true,iat:now,exp:now+3600,nonce,...patch});
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',rsa.privateKey,new TextEncoder().encode(header+'.'+payload));
 return header+'.'+payload+'.'+Buffer.from(signature).toString('base64url');
}
async function googleKeys(url){assert.equal(url,'https://www.googleapis.com/oauth2/v3/certs');return Response.json({keys:[googleJwk]},{headers:{'Cache-Control':'public,max-age=300'}});}
const googleEnv=env=>({...env,DPA_GOOGLE_CLIENT_ID:googleClientId,DPA_OWNER_EMAIL:googleEmail});
async function challenge(env){const r=await call(env,'/api/auth/google/challenge',{});assert.equal(r.status,200);return r.json();}

test('Google verification rejects wrong audience, issuer, unverified/disallowed email, nonce, expiry and forged signatures',async()=>{
 const nonce='a'.repeat(64),nonceHash=createHash('sha256').update(nonce).digest('hex'),config={clientId:googleClientId,email:googleEmail};
 const good=await googleToken(nonce);assert.deepEqual(await google.verifyGoogleOwnerToken(good,config,nonceHash,googleKeys),{sub:'test-google-owner-sub',email:googleEmail});
 const now=Math.floor(Date.now()/1000);
 for(const patch of [{aud:'other-client.apps.googleusercontent.com'},{iss:'https://evil.invalid'},{email:'someone.else@gmail.com'},{email_verified:false},{email_verified:'true'},{nonce:'wrong'},{iat:now-4000,exp:now-1},{iat:now+600},{azp:'different-app'}]){
  assert.equal(await google.verifyGoogleOwnerToken(await googleToken(nonce,patch),config,nonceHash,googleKeys),null,JSON.stringify(patch));
 }
 const parts=good.split('.');parts[1]=base64url({...JSON.parse(Buffer.from(parts[1],'base64url')),sub:'forged-owner'});
 assert.equal(await google.verifyGoogleOwnerToken(parts.join('.'),config,nonceHash,googleKeys),null);
 assert.equal(await google.verifyGoogleOwnerToken(base64url({alg:'none'})+'.'+parts[1]+'.unsigned',config,nonceHash,googleKeys),null);
 assert.equal(google.googleOwnerConfig({DPA_GOOGLE_CLIENT_ID:googleClientId}),null);
 assert.equal(google.googleOwnerConfig({DPA_GOOGLE_CLIENT_ID:googleClientId,DPA_OWNER_EMAIL:'untrusted@example.com'}),null);
});
test('only the configured Gmail can initialize the sole owner via Google; challenge replay is rejected',async()=>{
 const {sqlite,env:base}=database(),env=googleEnv({...base,DPA_OWNER_SETUP_KEY:undefined}),originalFetch=globalThis.fetch;globalThis.fetch=googleKeys;
 try{
  const status=await(await call(env,'/api/auth/status')).json();assert.equal(status.googleClientId,googleClientId);assert(!JSON.stringify(status).includes(googleEmail));
  const first=await challenge(env),token=await googleToken(first.nonce,{email:'intruder@gmail.com'});
  assert.equal((await call(env,'/api/auth/google',{challenge:first.challenge,credential:token,email:googleEmail,role:'owner'})).status,403);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM owner_account').get().n,0);
  const good=await googleToken(first.nonce),r=await call(env,'/api/auth/google',{challenge:first.challenge,credential:good});assert.equal(r.status,200);
  const session=await r.json();assert.deepEqual(session.user,{username:'owner',role:'owner',passwordEnabled:false});assert.equal((await call(env,'/api/backup',undefined,session.token)).status,200);
  assert.equal((await call(env,'/api/auth/google',{challenge:first.challenge,credential:good})).status,401);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM owner_account').get().n,1);assert.equal(sqlite.prepare('SELECT google_subject FROM owner_account').get().google_subject,'test-google-owner-sub');
  const second=await challenge(env);assert.equal((await call(env,'/api/auth/google',{challenge:second.challenge,credential:await googleToken(second.nonce,{sub:'different-sub-same-email'})})).status,403);
 }finally{globalThis.fetch=originalFetch;sqlite.close();}
});
test('Google challenges expire, are bound to their nonce, and require private server allowlist configuration',async()=>{
 const {sqlite,env:base}=database(),env=googleEnv(base),originalFetch=globalThis.fetch;globalThis.fetch=googleKeys;
 try{
  assert.equal((await call(base,'/api/auth/google/challenge',{})).status,503);
  const one=await challenge(env),two=await challenge(env);
  assert.equal((await call(env,'/api/auth/google',{challenge:one.challenge,credential:await googleToken(two.nonce)})).status,403);
  sqlite.exec('UPDATE owner_google_challenges SET expires_at=0');
  assert.equal((await call(env,'/api/auth/google',{challenge:one.challenge,credential:await googleToken(one.nonce)})).status,401);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM owner_sessions').get().n,0);
 }finally{globalThis.fetch=originalFetch;sqlite.close();}
});
test('Google can link to the existing sole owner without changing password, sales data or privileges',async()=>{
 const {sqlite,env:base}=database(),env=googleEnv(base),originalFetch=globalThis.fetch;globalThis.fetch=googleKeys;
 try{
  await setup(env);const local=await login(env),c=await challenge(env);
  const r=await call(env,'/api/auth/google',{challenge:c.challenge,credential:await googleToken(c.nonce)});assert.equal(r.status,200);assert.equal((await r.json()).user.passwordEnabled,true);
  await login(env);assert.equal((await call(env,'/api/catalog',undefined,local.token)).status,200);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM owner_account').get().n,1);
 }finally{globalThis.fetch=originalFetch;sqlite.close();}
});

test('Google failure diagnostics disclose a chosen email only after verifying its signature and never grant access',async()=>{
 const {sqlite,env:base}=database(),env=googleEnv(base),originalFetch=globalThis.fetch;globalThis.fetch=googleKeys;
 try{
  const c=await challenge(env),token=await googleToken(c.nonce,{email:'different.owner.test@gmail.com'});
  const denied=await call(env,'/api/auth/google',{challenge:c.challenge,credential:token});assert.equal(denied.status,403);
  const body=await denied.json();assert.equal(body.code,'GOOGLE_EMAIL_MISMATCH');assert(body.error.includes('different.owner.test@gmail.com'));assert(!body.error.includes(googleEmail));
  const parts=token.split('.');parts[1]=base64url({...JSON.parse(Buffer.from(parts[1],'base64url')),email:'forged-claim@gmail.com'});
  const forged=await(await call(env,'/api/auth/google',{challenge:c.challenge,credential:parts.join('.')})).json();assert.equal(forged.code,'GOOGLE_SIGNATURE_INVALID');assert(!forged.error.includes('forged-claim@gmail.com'));
  const expired=await(await call(env,'/api/auth/google',{challenge:c.challenge,credential:await googleToken(c.nonce,{iat:Math.floor(Date.now()/1000)-7200,exp:Math.floor(Date.now()/1000)-1})})).json();assert.equal(expired.code,'GOOGLE_TOKEN_EXPIRED');
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM owner_sessions').get().n,0);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM owner_account').get().n,0);
 }finally{globalThis.fetch=originalFetch;sqlite.close();}
});
test('Google certificates outage is distinguished from wrong Gmail without accepting a token',async()=>{
 const nonce='c'.repeat(64),nonceHash=createHash('sha256').update(nonce).digest('hex'),token=await googleToken(nonce),parts=token.split('.');
 parts[0]=base64url({alg:'RS256',kid:'unknown-test-rotation-key'});
 const result=await google.checkGoogleOwnerToken(parts.join('.'),{clientId:googleClientId,email:googleEmail},nonceHash,async()=>{throw Error('network offline');});
 assert.deepEqual(result,{ok:false,code:'GOOGLE_CERTS_UNAVAILABLE'});
});
test('Google runtime health checks only public-key readiness and do not expose owner email or create sessions',async()=>{
 const {sqlite,env:base}=database(),env=googleEnv(base),originalFetch=globalThis.fetch;globalThis.fetch=googleKeys;
 try{
  const r=await call(env,'/api/auth/google/health');assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM owner_sessions').get().n,0);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM owner_account').get().n,0);
  assert.equal((await call(base,'/api/auth/google/health')).status,503);
 }finally{globalThis.fetch=originalFetch;sqlite.close();}
});
