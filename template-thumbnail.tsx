import type {CatalogDish,CatalogTemplate} from './catalog-model';
import {readMenu,readMenuSet} from './menu';
import {imageNameKey,isIllustratedDish,dishArtCell} from './dish-image-model';
import {DishThumbnail} from './dish-thumbnail';

export function TemplateThumbnail({template,dishes=[]}:{template:CatalogTemplate;dishes?:CatalogDish[]}){
 const items=readMenu(template.menu).filter(item=>item.name.trim()&&isIllustratedDish(item.name));
 const set=readMenuSet(template.menu);
 const hotpot=dishArtCell(template.name)===6||!!set&&dishArtCell(set.name)===6;
 const names=hotpot?[template.name]:[...new Set(items.map(item=>item.name.trim()))].slice(0,4);
 if(!names.length)names.push(template.name);
 const covers=names.map((name,index)=>dishes.find(d=>imageNameKey(d.name)===imageNameKey(name))||{id:template.id+'-'+index,name,unit:'đĩa',price:null});
 return <span className={'template-thumbnail'+(covers.length>1?' template-thumbnail-mosaic':'')} role="img" aria-label={'Ảnh minh họa set '+template.name} title={'Ảnh minh họa set · '+(hotpot?template.name:items.slice(0,4).map(item=>item.name).join(', ')||template.name)}>
  {covers.map((dish,index)=><span className="template-thumbnail-cell" key={index} aria-hidden="true"><DishThumbnail dish={dish}/></span>)}
 </span>;
}
