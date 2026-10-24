import {useCallback,useEffect,useState} from 'react';
import {apiRequest} from './sync';
import {blankCatalog,type Catalog} from './catalog-model';
import {refreshedCatalog} from './catalog-refresh';
export function useCatalog(){
 const [catalog,setCatalog]=useState<Catalog>(blankCatalog),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const reload=useCallback(async()=>{try{const response=await apiRequest('/api/catalog',{cache:'no-store'});const data=await response.json() as Catalog&{error?:string};if(!response.ok)throw Error(data.error);setCatalog(current=>refreshedCatalog(current,data));setError('');}catch(e){setError(e instanceof Error?e.message:'Không tải được thư viện.')}finally{setLoading(false)}},[]);
 useEffect(()=>{void reload();const interval=setInterval(()=>{if(!document.hidden)void reload()},10000);window.addEventListener('focus',reload);return()=>{clearInterval(interval);window.removeEventListener('focus',reload)}},[reload]);
 const save=async(next:Catalog)=>{const response=await apiRequest('/api/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});const data=await response.json() as Catalog&{error?:string};if(!response.ok){if(response.status===409)await reload();throw Error(data.error)}setCatalog(data);setError('');};
 return {catalog,loading,error,reload,save};
}

