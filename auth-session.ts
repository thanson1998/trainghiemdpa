type Session={token:string;expiresAt:number;origin:string};
const key='dpa-owner-session-v1';
let current:Session|null=null;
try{const value=JSON.parse(sessionStorage.getItem(key)||'null');if(value&&/^[a-f0-9]{64}$/.test(value.token)&&Number.isFinite(value.expiresAt)&&value.expiresAt>Date.now()&&typeof value.origin==='string')current=value;}catch{}
// The server enforces expiry. Send the current token so a 401 can end the matching UI session.
export function ownerToken(origin:string){return current?.origin===origin?current.token:'';}
export function saveOwnerSession(session:Session){current=session;try{sessionStorage.setItem(key,JSON.stringify(session));}catch{ /* Keep this login in memory if tab storage is unavailable. */ }}
export function clearOwnerSession(expectedToken?:string){
 if(expectedToken&&current?.token!==expectedToken)return;
 current=null;try{sessionStorage.removeItem(key);}catch{}
 if(typeof window!=='undefined')window.dispatchEvent(new Event('dpa-owner-session-ended'));
}
