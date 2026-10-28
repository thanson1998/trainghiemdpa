const pending=new Map<string,Promise<Response>>();
// Share only simultaneous reads. Every consumer gets its own response body.
export async function coalescedRead(key:string,request:()=>Promise<Response>):Promise<Response>{
 let result=pending.get(key);
 if(!result){result=request();pending.set(key,result);const active=result;void result.finally(()=>{if(pending.get(key)===active)pending.delete(key);}).catch(()=>{});}
 return (await result).clone();
}
export function invalidatePendingReads(){pending.clear();}
