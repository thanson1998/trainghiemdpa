import {readPosTickets,posDirty,type PosTicket} from './pos-logic';
type State={tickets:PosTicket[];selected:string};
const sessionKey='dpa-pos-tab-draft-v2',legacyKey='dpa-pos-tickets-v1',prefix='dpa-pos-draft-owner-v2:';
const owner=crypto.randomUUID();
export function readCurrentPosDraft(){return readPosTickets(sessionStorage.getItem(sessionKey))??readPosTickets(localStorage.getItem(legacyKey));}
export function writeCurrentPosDraft(state:State){
 const archives:{key:string;updatedAt:number}[]=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(prefix)||key===prefix+owner)continue;try{const entry=JSON.parse(localStorage.getItem(key)||'null');if(entry&&(entry.active===false||Date.now()-entry.updatedAt>120000))archives.push({key,updatedAt:entry.updatedAt});}catch{}}archives.sort((a,b)=>b.updatedAt-a.updatedAt);for(const old of archives.slice(10))localStorage.removeItem(old.key);
 const value=JSON.stringify({format:'DPA_POS_V1',...state});sessionStorage.setItem(sessionKey,value);
 localStorage.setItem(prefix+owner,JSON.stringify({active:true,updatedAt:Date.now(),state:JSON.parse(value)}));
 localStorage.removeItem(legacyKey);
}
export function allPosDraftTickets(activeOnly=false){
 const result:PosTicket[]=[];
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;
  try{const entry=JSON.parse(localStorage.getItem(key)||'null');if(!entry||activeOnly&&(entry.active===false||Date.now()-entry.updatedAt>120000))continue;const state=readPosTickets(JSON.stringify(entry.state));if(state)result.push(...state.tickets);}catch{}
 }
 const legacy=readPosTickets(localStorage.getItem(legacyKey));if(legacy)result.push(...legacy.tickets);
 return result;
}
export function hasUnsavedPosDraft(id:string){return [...(readCurrentPosDraft()?.tickets??[]),...allPosDraftTickets(true)].some(t=>t.booking.id===id&&posDirty(t));}
export function recoverOtherPosDrafts(state:State){
 const ids=new Set(state.tickets.map(t=>t.booking.id)),added:PosTicket[]=[];
 for(const ticket of allPosDraftTickets().reverse())if(!ids.has(ticket.booking.id)&&posDirty(ticket)&&ticket.booking.menu){ids.add(ticket.booking.id);added.push(ticket);}
 return {...state,tickets:[...state.tickets,...added]};
}

if(typeof window!=='undefined')window.addEventListener('pagehide',()=>{try{const key=prefix+owner,entry=JSON.parse(localStorage.getItem(key)||'null');if(entry)localStorage.setItem(key,JSON.stringify({...entry,active:false}));}catch{}});
