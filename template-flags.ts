import type {CatalogTemplate} from './catalog-model';
export type TemplateFlags={pinned:boolean;soldOut:boolean};
// Keep availability in the existing versioned menu payload so deployed catalog APIs retain it.
function payload(menu:string):{prefix:string;data:any}|undefined{const prefix=menu.startsWith('DPA_MENU_V2:')?'DPA_MENU_V2:':menu.startsWith('DPA_MENU_V1:')?'DPA_MENU_V1:':'';if(!prefix)return;try{return {prefix,data:JSON.parse(menu.slice(prefix.length))};}catch{return;}}
function flagsData(menu:string):any{const parsed=payload(menu);return parsed?(Array.isArray(parsed.data)?parsed.data[0]?.templateFlags:parsed.data.templateFlags):undefined;}
export function templateFlags(menu:string):TemplateFlags{const flags=flagsData(menu);return {pinned:flags?.pinned===true,soldOut:flags?.soldOut===true};}
export function withTemplateFlags(menu:string,patch:Partial<TemplateFlags>):string{const parsed=payload(menu);if(!parsed)throw Error('Thực đơn mẫu không hợp lệ.');const flags={...templateFlags(menu),...patch};if(Array.isArray(parsed.data)){if(!parsed.data.length)throw Error('Thực đơn mẫu chưa có món.');parsed.data[0]={...parsed.data[0],templateFlags:flags};}else parsed.data.templateFlags=flags;return parsed.prefix+JSON.stringify(parsed.data);}
export function preserveTemplateFlags(next:CatalogTemplate,previous?:CatalogTemplate):CatalogTemplate{return previous&&flagsData(previous.menu)&&!flagsData(next.menu)?{...next,menu:withTemplateFlags(next.menu,templateFlags(previous.menu))}:next;}
export function sortTemplates(templates:CatalogTemplate[]):CatalogTemplate[]{return [...templates].sort((a,b)=>Number(templateFlags(b.menu).pinned)-Number(templateFlags(a.menu).pinned));}
