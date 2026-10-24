import {useState} from 'react';
import type {CatalogDish} from './catalog-model';
import {dishArtCell,isIllustratedDish} from './dish-image-model';
import {dishImageUrl} from './sync';
import sprite from './dish-illustrations.webp?inline';
import './dish-images.css';
export function DishThumbnail({dish}:{dish:CatalogDish}){
 const [failed,setFailed]=useState('');
 if(!isIllustratedDish(dish.name))return null;
 const url=dish.image?.url?dishImageUrl(dish.image.url):'',cell=dishArtCell(dish.name,dish.category);
 const specific=!!url&&failed!==url;
 return <span className="dish-thumbnail" title={specific?'Ảnh minh họa AI · '+dish.name:dish.image?.message||'Ảnh minh họa nhóm món · ảnh riêng sẽ tự cập nhật'}>
  {specific?<img src={url} alt={'Ảnh minh họa '+dish.name} loading="lazy" decoding="async" width="64" height="64" onError={()=>setFailed(url)}/>:<span className="dish-art-sprite" aria-hidden="true" style={{backgroundImage:`url(${sprite})`,backgroundPosition:`${(cell%4)*100/3}% ${Math.floor(cell/4)*100/3}%`}}/>}
 </span>;
}
