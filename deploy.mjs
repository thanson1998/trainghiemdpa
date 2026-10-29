import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {existsSync} from 'node:fs';
export const mailKeys=['RESEND_API_KEY','BOOKING_EMAIL_TO','BOOKING_EMAIL_FROM','BOOKING_EMAIL_ENABLED','BOOKING_EMAIL_DAILY_TIME','BOOKING_EMAIL_BEFORE_MINUTES'];
export function buildMailSecrets(env){
 const configured=mailKeys.filter(key=>typeof env[key]==='string'&&env[key].trim());
 if(!configured.length)return null;
 const missing=mailKeys.slice(0,4).filter(key=>!configured.includes(key));
 if(missing.length)throw Error('Missing build configuration: '+missing.join(', '));
 if(!['true','false'].includes(env.BOOKING_EMAIL_ENABLED.trim()))throw Error('BOOKING_EMAIL_ENABLED must be true or false');
 if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(env.BOOKING_EMAIL_TO.trim()))throw Error('BOOKING_EMAIL_TO is invalid');
 return Object.fromEntries(configured.map(key=>[key,env[key].trim()]));
}
export function deployWithMail(env=process.env,run=spawnSync){
 const secrets=buildMailSecrets(env);
 const wrangler=fileURLToPath(new URL('./node_modules/wrangler/bin/wrangler.js',import.meta.url));
 const protectedValues=Object.entries(env).filter(([key,value])=>/KEY|TOKEN|SECRET|BOOKING_EMAIL_TO/i.test(key)&&typeof value==='string'&&value.length>3).map(([,value])=>value);
 const scrub=text=>protectedValues.reduce((s,value)=>s.split(value).join('[redacted]'),String(text||''));
 const command=(args,input)=>{
  const result=run(process.execPath,[wrangler,...args],{env,input,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']});
  if(result.error)throw Error('Could not start deployment command: '+scrub(result.error.message));
  if(result.status!==0)throw Error('Deployment command failed: '+args.slice(0,3).join(' ')+'\n'+scrub(result.stdout)+'\n'+scrub(result.stderr));
  console.log(scrub(result.stdout));
 };
 command(['d1','migrations','apply','DB','--remote']);
 // Build secrets never become runtime bindings automatically. Pass only the explicit mail allowlist via stdin.
 if(secrets)command(['secret','bulk'],JSON.stringify(secrets));
 command(['deploy','--keep-vars']);
 console.log(secrets?'Mail runtime bindings synchronized from Cloudflare build configuration.':'Existing runtime bindings preserved; no mail build configuration provided.');
}
if(process.argv[1]&&existsSync(process.argv[1])&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{deployWithMail();}catch(error){console.error(error.message);process.exitCode=1;}
}
