export type LiveAd={id:string;pageId:string;pageName:string;category?:string;pageUrl:string;body:string;title:string;imageUrl:string;videoUrl:string;startDate:string;active:boolean;url:string;format:'Ảnh'|'Video'|'Khác'};
export type LiveSearch={query:string;fetchedAt:string;total:number|null;ads:LiveAd[];hasMore:boolean;cached?:boolean};
export type AdsConnection={configured:boolean;provider:string;remainingCredits:number|null;dailyLimit:number;usedToday:number;error?:string};
