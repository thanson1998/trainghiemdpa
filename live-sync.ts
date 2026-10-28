const signalKey='dpa-data-change-v1';
const signalEvent='dpa-data-changed';

// Only a refresh signal is shared; order/customer data stays on the server.
export function notifyLiveSync(){
 try{localStorage.setItem(signalKey,crypto.randomUUID());}catch{}
 window.dispatchEvent(new Event(signalEvent));
}

export function watchLiveSync(refresh:()=>unknown,options:{intervalMs?:number}={}){
 let pending:ReturnType<typeof setTimeout>|undefined;
 let active=false,disposed=false;
 const schedule=()=>{
  if(document.hidden||pending!==undefined||active||disposed)return;
  pending=setTimeout(async()=>{pending=undefined;if(document.hidden||disposed)return;active=true;try{await refresh();}catch{}finally{active=false;}},80);
 };
 const stored=(event:StorageEvent)=>{if(event.key===signalKey)schedule();};
 const interval=setInterval(schedule,options.intervalMs??3000);
 window.addEventListener(signalEvent,schedule);
 window.addEventListener('storage',stored);
 window.addEventListener('focus',schedule);
 window.addEventListener('online',schedule);
 document.addEventListener('visibilitychange',schedule);
 return()=>{
  disposed=true;
  clearInterval(interval);clearTimeout(pending);
  window.removeEventListener(signalEvent,schedule);
  window.removeEventListener('storage',stored);
  window.removeEventListener('focus',schedule);
  window.removeEventListener('online',schedule);
  document.removeEventListener('visibilitychange',schedule);
 };
}
