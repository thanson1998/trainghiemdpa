export type CatalogDish={id:string;name:string;unit:string;category?:string;price:number|null;pinned?:boolean;soldOut?:boolean;image?:{status:'queued'|'generating'|'ready'|'error';url?:string;message?:string}};
export type CatalogTemplate={id:string;name:string;menu:string};
export type Catalog={dishes:CatalogDish[];templates:CatalogTemplate[];version:number};
export const blankCatalog:Catalog={dishes:[],templates:[],version:0};

