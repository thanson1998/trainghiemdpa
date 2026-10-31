import {preserveTemplateFlags} from './template-flags';
import {watchLiveSync} from './live-sync';
import {cleanSetName} from './set-names';
import {readMenuSet} from './menu';
import {useCallback,useEffect,useRef,useState} from 'react';
import {apiRequest} from './sync';
import {blankCatalog,type Catalog} from './catalog-model';
import {refreshedCatalog} from './catalog-refresh';
const namedCatalog=(data:Catalog):Catalog=>({...data,templates:data.templates.map(t=>({...t,name:cleanSetName(t.name,readMenuSet(t.menu),t.id)}))});
export function useCatalog(){
 const [catalog,setCatalog]=useState<Catalog>(blankCatalog),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const revision=useRef(''),readSequence=useRef(0);
 const reload=useCallback(async()=>{const seq=++readSequence.current;try{const response=await apiRequest('/api/catalog?revision='+encodeURIComponent(revision.current),{cache:'no-store'});const data=await response.json() as Catalog&{error?:string;revision?:string;unchanged?:boolean};if(!response.ok)throw Error(data.error);if(seq!==readSequence.current)return;if(!data.unchanged){revision.current=data.revision||'';setCatalog(current=>refreshedCatalog(current,namedCatalog(data)));}setError('');}catch(e){setError(e instanceof Error?e.message:'Không tải được thư viện.')}finally{setLoading(false)}},[]);
 useEffect(()=>{void reload();return watchLiveSync(reload);},[reload]);
 const save=async(next:Catalog)=>{const response=await apiRequest('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...next,templates:next.templates.map(t=>preserveTemplateFlags(t,catalog.templates.find(p=>p.id===t.id)))})});const data=await response.json() as Catalog&{error?:string};if(!response.ok){if(response.status===409)await reload();throw Error(data.error)}readSequence.current++;revision.current='';setCatalog(namedCatalog(data));setError('');};
 return {catalog,loading,error,reload,save};
}

