import type {Catalog} from './catalog-model';
// Image progress may change without incrementing the editable catalog version.
export function refreshedCatalog(current:Catalog,incoming:Catalog):Catalog{
 if(incoming.version<current.version)return current;
 return JSON.stringify(current)===JSON.stringify(incoming)?current:incoming;
}
