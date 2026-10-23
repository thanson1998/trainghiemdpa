export const defaultDishGroups=['Món ăn','Nước ép','Trà','Rượu','Bia','Cà phê','Sinh tố','Đồ uống khác','Ăn vặt'];
export const categoryAccents='àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
export const categoryPunctuation='-_/().,:;&+–—';
export const groupFold=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[-_/().,:;&+–—]/g,' ').replace(/\s+/g,' ').trim();
export const dishGroupRules:[string,string[]][]=[
 ['Ăn vặt',['bim bim','hướng dương','snack','khô gà','khô bò','khoai tây chiên','hạt điều','bắp rang','bỏng ngô']],
 ['Món ăn',['sốt vang','hấp bia','sốt rượu']],
 ['Nước ép',['nước ép','ép','nước trái cây','juice']],
 ['Sinh tố',['sinh tố','smoothie']],
 ['Cà phê',['cà phê','cafe','coffee','espresso','latte','cappuccino','bạc xỉu']],
 ['Trà',['trà','tea','matcha']],
 ['Rượu',['rượu','vang','vodka','whisky','whiskey','chivas','hennessy','soju','cognac']],
 ['Bia',['bia','beer','heineken','tiger','hanoi','budweiser','sài gòn','saigon','carlsberg']],
 ['Đồ uống khác',['nước lọc','nước suối','nước khoáng','nước ngọt','coca','pepsi','sprite','7up','lavie','aquafina','revive','redbull','red bull','sting','bò húc','sữa chua','sữa tươi','cacao','nước dừa','dừa xiêm','chanh muối','mận ngâm']]
];
export function inferDishGroup(name:string){const text=' '+groupFold(name)+' ';return dishGroupRules.find(([,words])=>words.some(word=>text.includes(' '+groupFold(word)+' ')))?.[0]??'Món ăn';}
export function dishGroup(dish:{name:string;category?:string}){return dish.category?.trim()||inferDishGroup(dish.name);}
export function allDishGroups(dishes:{name:string;category?:string}[]){return [...defaultDishGroups,...new Set(dishes.map(dishGroup).filter(g=>!defaultDishGroups.includes(g)))];}
