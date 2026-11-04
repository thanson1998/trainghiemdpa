import {readPosTickets,posDirty,posFingerprint,type PosTicket,type PosDraftMeta} from './pos-logic';
export type PosDraftState={tickets:PosTicket[];selected:string};
export type RecoveryCandidate={key:string;ticket:PosTicket;editedAt:number|null;revision:number};
export type RecoveryGroup={bookingId:string;currentFingerprint?:string;candidates:RecoveryCandidate[]};
const sessionKey='dpa-pos-tab-draft-v2',legacyKey='dpa-pos-tickets-v1',prefix='dpa-pos-draft-owner-v2:',discardKey='dpa-pos-discarded-v3';
const owner=crypto.randomUUID();
export function readCurrentPosDraft(){return readPosTickets(sessionStorage.getItem(sessionKey))??readPosTickets(localStorage.getItem(legacyKey));}
function metadata(ticket:PosTicket):PosDraftMeta|undefined{
 const m=ticket.draftMeta;return m&&m.fingerprint===posFingerprint(ticket.booking)&&(m.editedAt===null||Number.isFinite(m.editedAt))&&Number.isInteger(m.revision)&&m.revision>=0&&typeof m.origin==='string'?m:undefined;
}
function discarded(ticket:PosTicket){try{const rows=JSON.parse(localStorage.getItem(discardKey)||'[]'),m=metadata(ticket);return rows.some((r:any)=>r.id===ticket.booking.id&&r.fingerprint===posFingerprint(ticket.booking)&&(m?.editedAt==null||m.editedAt<=r.at));}catch{return false;}}
export function discardPosDraft(ticket:PosTicket){let rows:any[]=[];try{rows=JSON.parse(localStorage.getItem(discardKey)||'[]');if(!Array.isArray(rows))rows=[];}catch{}localStorage.setItem(discardKey,JSON.stringify([{id:ticket.booking.id,fingerprint:posFingerprint(ticket.booking),at:Date.now()},...rows].slice(0,200)));}
function enriched(state:PosDraftState){
 const previous=readCurrentPosDraft(),now=Date.now();
 return {...state,tickets:state.tickets.map(ticket=>{
  const fingerprint=posFingerprint(ticket.booking),old=previous?.tickets.find(t=>t.booking.id===ticket.booking.id),prior=old&&metadata(old),provided=metadata(ticket);
  const draftMeta=old&&posFingerprint(old.booking)===fingerprint?(prior??provided??{editedAt:null,revision:0,fingerprint,origin:'legacy'}):provided??{editedAt:now,revision:(prior?.revision??0)+1,fingerprint,origin:owner};
  return {...ticket,draftMeta};
 })};
}
export function writeCurrentPosDraft(state:PosDraftState){
 const next=enriched(state),archives:{key:string;updatedAt:number}[]=[];
 for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(prefix)||key===prefix+owner)continue;try{const entry=JSON.parse(localStorage.getItem(key)||'null');if(entry&&(entry.active===false||Date.now()-entry.updatedAt>120000))archives.push({key,updatedAt:entry.updatedAt});}catch{}}
 archives.sort((a,b)=>b.updatedAt-a.updatedAt);for(const old of archives.slice(10))localStorage.removeItem(old.key);
 const value=JSON.stringify({format:'DPA_POS_V1',...next});sessionStorage.setItem(sessionKey,value);localStorage.setItem(prefix+owner,JSON.stringify({active:true,updatedAt:Date.now(),state:JSON.parse(value)}));localStorage.removeItem(legacyKey);
}
export function allPosDraftTickets(activeOnly=false){
 const result:PosTicket[]=[];
 for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;try{const entry=JSON.parse(localStorage.getItem(key)||'null');if(!entry||activeOnly&&(entry.active===false||Date.now()-entry.updatedAt>120000))continue;const state=readPosTickets(JSON.stringify(entry.state));if(state)result.push(...state.tickets.filter(t=>!discarded(t)));}catch{}}
 const legacy=readPosTickets(localStorage.getItem(legacyKey));if(legacy)result.push(...legacy.tickets.filter(t=>!discarded(t)));return result;
}
export function hasUnsavedPosDraft(id:string){return [...(readCurrentPosDraft()?.tickets??[]),...allPosDraftTickets(true)].some(t=>t.booking.id===id&&!discarded(t)&&posDirty(t));}
export function listPosDraftRecovery(state:PosDraftState):RecoveryGroup[]{
 const groups=new Map<string,Map<string,PosTicket>>();
 for(const ticket of [...allPosDraftTickets(),...state.tickets]){if(!posDirty(ticket)||!ticket.booking.menu||discarded(ticket))continue;const fp=posFingerprint(ticket.booking),group=groups.get(ticket.booking.id)??new Map<string,PosTicket>(),existing=group.get(fp);if(!existing||(metadata(ticket)?.editedAt??-1)>(metadata(existing)?.editedAt??-1))group.set(fp,ticket);groups.set(ticket.booking.id,group);}
 return [...groups].map(([bookingId,versions])=>{
  const tickets=[...versions.values()].sort((a,b)=>(metadata(b)?.editedAt??-1)-(metadata(a)?.editedAt??-1)||posFingerprint(a.booking).localeCompare(posFingerprint(b.booking)));
  return {bookingId,currentFingerprint:state.tickets.find(t=>t.booking.id===bookingId)?posFingerprint(state.tickets.find(t=>t.booking.id===bookingId)!.booking):undefined,candidates:tickets.map((ticket,i)=>({key:bookingId+':'+i,ticket,editedAt:metadata(ticket)?.editedAt??null,revision:metadata(ticket)?.revision??0}))};
 }).filter(group=>group.candidates.some(c=>posFingerprint(c.ticket.booking)!==group.currentFingerprint));
}
export function preservePosDraft(ticket:PosTicket){
 const saved=readCurrentPosDraft()?.tickets.find(t=>t.booking.id===ticket.booking.id&&posFingerprint(t.booking)===posFingerprint(ticket.booking)),copy={...ticket,draftMeta:metadata(ticket)??(saved&&metadata(saved))};
 localStorage.setItem(prefix+'replaced:'+crypto.randomUUID(),JSON.stringify({active:false,updatedAt:Date.now(),state:{format:'DPA_POS_V1',tickets:[copy],selected:copy.booking.id}}));
}
export function applyRecoveredDraft(state:PosDraftState,candidate:RecoveryCandidate,expectedCurrent?:string){
 const old=state.tickets.find(t=>t.booking.id===candidate.ticket.booking.id);if((old?posFingerprint(old.booking):undefined)!==expectedCurrent)throw Error('Phiếu đang mở vừa thay đổi. Đóng và mở lại phần khôi phục để kiểm tra.');
 return {...state,tickets:old?state.tickets.map(t=>t.booking.id===old.booking.id?candidate.ticket:t):[...state.tickets,candidate.ticket],selected:candidate.ticket.booking.id};
}
// Compatibility helper restores only unambiguous missing orders; conflicts require a choice.
export function recoverOtherPosDrafts(state:PosDraftState){const added=listPosDraftRecovery(state).filter(g=>g.currentFingerprint===undefined&&g.candidates.length===1).map(g=>g.candidates[0].ticket);return {...state,tickets:[...state.tickets,...added]};}
if(typeof window!=='undefined')window.addEventListener('pagehide',()=>{try{const key=prefix+owner,entry=JSON.parse(localStorage.getItem(key)||'null');if(entry)localStorage.setItem(key,JSON.stringify({...entry,active:false}));}catch{}});
