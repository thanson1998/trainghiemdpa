import type {LiveSearch} from './ads-live-model';
export type MarketProposal={key:string;text:string;angle:string;signals:{label:string;pages:string[]}[];sources:{id:string;name:string;url:string}[];fetchedAt:string;visual:string};
const fold=(v:string)=>v.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replaceAll('đ','d').toLowerCase();
export function buildDpaProposal(result:LiveSearch):MarketProposal|null{
 const seen=new Set<string>();const ads=result.ads.filter(ad=>/^\d+$/.test(ad.id)&&ad.active&&(ad.body.trim()||ad.title.trim())&&!seen.has(ad.id)&&!!seen.add(ad.id)).slice(0,12);if(!ads.length)return null;
 const themes=[
  {id:'occasion',label:'Mời đặt tiệc, sinh nhật hoặc gặp gỡ theo nhóm',pattern:/sinh nhat|lien hoan|dat tiec|to chuc tiec|sum hop|hoi hop|gap mat/},
  {id:'space',label:'Giới thiệu không gian và trải nghiệm dùng bữa',pattern:/khong gian|phong rieng|sang trong|am cung|check.in|san vuon/},
  {id:'food',label:'Dùng món ăn, thực đơn hoặc buffet để tạo sức hút',pattern:/buffet|thuc don|hai san|lau\b|mon an|nuong/},
  {id:'offer',label:'Nhấn vào giá hoặc chương trình ưu đãi',pattern:/uu dai|khuyen mai|giam gia|tang |mien phi|chi tu|\d[.,]?\d*\s*k\b|\d+\s*%/},
  {id:'booking',label:'Kêu gọi nhắn tin hoặc liên hệ đặt bàn',pattern:/dat ban|inbox|nhan tin|hotline|lien he/}
 ];
 const signals=themes.map(t=>({id:t.id,label:t.label,pages:[...new Set(ads.filter(ad=>t.pattern.test(fold(ad.body+' '+ad.title))).map(ad=>ad.pageName))]})).filter(s=>s.pages.length);
 const occasion=signals.some(s=>s.id==='occasion'),food=signals.some(s=>s.id==='food');
 const headline=occasion?'MỘT BỮA TIỆC VUI, CẢ NHÀ ĐỀU THẢNH THƠI 🌿':food?'HẸN NHAU MỘT BỮA NGON, ĐỔI GIÓ GIỮA KHÔNG GIAN XANH 🌿':'RỜI PHỐ MỘT CHÚT, GẦN NHAU THÊM MỘT CHÚT 🌿';
 const opening=occasion?'Sắp đến sinh nhật, buổi liên hoan hay một dịp cả gia đình gặp mặt? Một nơi thoáng đãng, món ăn hợp khẩu vị và sự chuẩn bị chu đáo sẽ giúp buổi tiệc nhẹ nhàng hơn cho người đứng ra tổ chức.':'Có những cuộc hẹn chỉ cần món ăn ngon, một chỗ ngồi dễ chịu và những người thân quen bên cạnh. Cuối tuần này, mình hẹn nhau tại Trải Nghiệm DPA nhé!';
 const text=`${headline}\n\n${opening}\n\nChỉ cách trung tâm TP. Thái Nguyên khoảng 8 km, Trải Nghiệm DPA đón bạn bằng không gian xanh, thoáng và những nếp nhà sàn, nhà gỗ, nhà tre gần gũi.\n\n🍲 Thực đơn phong phú, được tư vấn theo số khách và nhu cầu của từng nhóm.\n🌿 Không gian dành cho những bữa ăn gia đình, sinh nhật, liên hoan và gặp gỡ công ty.\n🧒 Có khu vui chơi cho các bé, thêm niềm vui cho buổi đi chơi của cả nhà.\n🤝 DPA hỗ trợ tư vấn thực đơn, sắp xếp bàn và phục vụ xuyên suốt để bạn an tâm đón khách.\n\nBạn dự định đi ngày nào và có bao nhiêu người? Nhắn DPA để được tư vấn thực đơn và không gian phù hợp nhé!\n\n📍 Trải Nghiệm DPA – Thái Nguyên\n📩 Nhắn tin fanpage để được tư vấn và đặt bàn.\n\n#TraiNghiemDPA #AmThucThaiNguyen #DatTiecThaiNguyen`;
 const sources=ads.slice(0,12).map(ad=>({id:ad.id,name:ad.pageName,url:'https://www.facebook.com/ads/library/?id='+ad.id}));let hash=2166136261;for(const c of ads.map(a=>a.id+'|'+a.body+'|'+a.title).join('\n'))hash=Math.imul(hash^c.charCodeAt(0),16777619);
 return {key:(hash>>>0).toString(16),text,angle:occasion?'Đặt tiệc nhẹ nhàng cho người tổ chức':food?'Bữa ăn ngon kết hợp không gian xanh cho gia đình':'Không gian xanh và sự đón tiếp chu đáo',signals:signals.map(({label,pages})=>({label,pages})),sources,fetchedAt:result.fetchedAt,visual:'Dùng ảnh thật mâm món ăn ở phía trước, không gian xanh hoặc nhà gỗ DPA phía sau; có thể thêm một ảnh gia đình dùng bữa. Tiêu đề ảnh: “Hẹn nhau tại Trải Nghiệm DPA”.'};
}
