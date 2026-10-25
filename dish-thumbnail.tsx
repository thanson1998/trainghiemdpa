import {supplementalCell,supplementalPosition} from './dish-supplemental';
import {memo,useState} from 'react';
import type {CatalogDish} from './catalog-model';
import {dishArtCell,isIllustratedDish} from './dish-image-model';
import {dishImageUrl} from './sync';
import './dish-images.css';
export const DishThumbnail=memo(function DishThumbnail({dish}:{dish:CatalogDish}){
 const [failed,setFailed]=useState('');
 if(!isIllustratedDish(dish.name))return null;
 const url=dish.image?.url?dishImageUrl(dish.image.url):'',cell=dishArtCell(dish.name,dish.category);
 const specific=!!url&&failed!==url,extra=supplementalCell(dish.name);
 return <span className="dish-thumbnail" title={specific||extra!==null?'Ảnh minh họa AI · '+dish.name:dish.image?.message||'Ảnh minh họa nhóm món · ảnh riêng sẽ tự cập nhật'}>
  {specific?<img src={url} alt={'Ảnh minh họa '+dish.name} loading="lazy" decoding="async" width="64" height="64" onError={()=>setFailed(url)}/>:<span className={extra!==null?`dish-art-sprite ${extra>=96?'dish-art-batch7':extra>=80?'dish-art-batch6':extra>=64?'dish-art-batch5':extra>=48?'dish-art-batch4':extra>=32?'dish-art-batch3':extra>=16?'dish-art-batch2':'dish-art-extra'}`:"dish-art-sprite"} aria-hidden="true" style={{backgroundPosition:extra!==null?supplementalPosition(extra):`${(cell%4)*100/3}% ${Math.floor(cell/4)*100/3}%`}}/>}
 </span>;
},(a,b)=>a.dish.name===b.dish.name&&a.dish.category===b.dish.category&&a.dish.image?.url===b.dish.image?.url&&a.dish.image?.status===b.dish.image?.status&&a.dish.image?.message===b.dish.image?.message);
