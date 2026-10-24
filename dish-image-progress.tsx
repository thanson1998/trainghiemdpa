import {memo} from 'react';
import type {CatalogDish} from './catalog-model';
import {isIllustratedDish} from './dish-image-model';
export const DishImageProgress=memo(function DishImageProgress({dishes}:{dishes:CatalogDish[]}){
 const eligible=dishes.filter(d=>isIllustratedDish(d.name));
 if(!eligible.length)return null;
 const ready=eligible.filter(d=>d.image?.url).length,failed=eligible.filter(d=>!d.image?.url&&d.image?.status==='error').length;
 return <p className="dish-image-progress" role="status">Ảnh riêng: <b>{ready}/{eligible.length} món</b>{ready<eligible.length&&<> · {eligible.length-ready-failed} đang chờ{failed>0&&<> · {failed} cần thử lại</>}</>}{ready===eligible.length&&' · Đã hoàn tất'}</p>;
});
