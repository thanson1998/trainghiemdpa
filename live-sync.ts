const signalKey='dpa-data-change-v1',signalEvent='dpa-data-changed';
export function notifyLiveSync(){try{localStorage.setItem(signalKey,crypto.randomUUID());}catch{}window.dispatchEvent(new Event(signalEvent));}
export function watchLiveSync(refresh:()=>unknown,options:{intervalMs?:number;idleIntervalMs?:number;idleAfterMs?:number}={}){
 let pending:ReturnType<typeof setTimeout>|undefined,poll:ReturnType<typeof setTimeout>|undefined;
 let active=false,disposed=false,queued=false,lastActivity=Date.now();
 const interval=options.intervalMs??5000,idleInterval=options.idleIntervalMs??Math.max(30000,interval);
 const arm=()=>{clearTimeout(poll);if(disposed||document.hidden)return;poll=setTimeout(()=>schedule(),Date.now()-lastActivity>(options.idleAfterMs??60000)?idleInterval:interval);};
 const schedule=()=>{
  if(document.hidden||disposed)return;
  if(active){queued=true;return;}if(pending!==undefined)return;
  clearTimeout(poll);pending=setTimeout(async()=>{pending=undefined;if(document.hidden||disposed)return;active=true;try{await refresh();}catch{}finally{active=false;if(queued){queued=false;schedule();}else arm();}},80);
 };
 const activity=()=>{lastActivity=Date.now();};
 const wake=()=>{activity();schedule();};
 const visibility=()=>{if(document.hidden){clearTimeout(poll);clearTimeout(pending);pending=undefined;}else wake();};
 const stored=(event:StorageEvent)=>{if(event.key===signalKey)schedule();};
 window.addEventListener(signalEvent,schedule);window.addEventListener('storage',stored);window.addEventListener('focus',wake);window.addEventListener('online',wake);
 window.addEventListener('pointerdown',activity,{passive:true});window.addEventListener('keydown',activity);document.addEventListener('visibilitychange',visibility);arm();
 return()=>{disposed=true;clearTimeout(poll);clearTimeout(pending);window.removeEventListener(signalEvent,schedule);window.removeEventListener('storage',stored);window.removeEventListener('focus',wake);window.removeEventListener('online',wake);window.removeEventListener('pointerdown',activity);window.removeEventListener('keydown',activity);document.removeEventListener('visibilitychange',visibility);};
}
