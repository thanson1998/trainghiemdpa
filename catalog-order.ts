// New entries lead the shared list; edits keep existing entries in their current order.
export function newCatalogEntriesFirst<T extends {id:string}>(next:T[],previous:{id:string}[]){
 const known=new Set(previous.map(row=>row.id));
 return [...next.filter(row=>!known.has(row.id)),...next.filter(row=>known.has(row.id))];
}
