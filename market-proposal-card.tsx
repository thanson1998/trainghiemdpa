import {useRef,useState} from 'react';
import {Copy,FilePenLine,ExternalLink} from 'lucide-react';
import type {MarketProposal} from './market-proposal';
export default function MarketProposalCard({proposal}:{proposal:MarketProposal}){
 const storageKey='dpa-market-post-'+proposal.key;const editor=useRef<HTMLTextAreaElement>(null);
 const [text,setText]=useState(()=>{try{return localStorage.getItem(storageKey)||proposal.text;}catch{return proposal.text;}}),[status,setStatus]=useState('');
 function change(value:string){setText(value);setStatus('');try{localStorage.setItem(storageKey,value);}catch{setStatus('Bản sửa đang ở màn hình này. Anh có thể sao chép để giữ lại.');}}
 async function copy(){try{await navigator.clipboard.writeText(text);setStatus('Đã sao chép bài viết.');}catch{editor.current?.focus();editor.current?.select();setStatus('Đã chọn nội dung. Nhấn Ctrl+C hoặc chạm giữ để sao chép.');}}
 return <section className="market-proposal" aria-label="Bài viết quảng cáo đề xuất cho DPA"><header><div><span><FilePenLine size={17}/>ĐỀ XUẤT CHO TRẢI NGHIỆM DPA</span><h2>Một bài viết từ các mẫu vừa thu thập</h2><p>Hướng đề xuất: <b>{proposal.angle}</b></p></div><button className="primary-btn" onClick={()=>void copy()} disabled={!text.trim()}><Copy size={16}/>Sao chép bài viết</button></header>
  <label>Bài viết có thể chỉnh sửa<textarea ref={editor} value={text} maxLength={7000} onChange={e=>change(e.target.value)} rows={14}/></label>
  <div className="market-proposal-meta"><small>Bản chỉnh sửa lưu trên thiết bị này · Không tự đăng lên Facebook.</small><button className="text-btn" onClick={()=>{change(proposal.text);setStatus('Đã trở về bài đề xuất ban đầu.');}}>Dùng bài đề xuất ban đầu</button></div>{status&&<p className="market-proposal-status" role="status">{status}</p>}
  <details><summary>Vì sao đề xuất bài này? · {proposal.sources.length} mẫu tham khảo</summary><p>Nhận xét từ nội dung mẫu đã lấy ngày {new Date(proposal.fetchedAt).toLocaleString('vi-VN')}; không phải đánh giá hiệu quả hay ngân sách quảng cáo.</p>{proposal.signals.length?<ul>{proposal.signals.map(s=><li key={s.label}><b>{s.label}</b><span>{s.pages.join(' · ')}</span></li>)}</ul>:<p>Các mẫu chưa có đủ dấu hiệu chung; bài đề xuất ưu tiên thông tin đã biết của DPA.</p>}<p>Bài viết dùng cách tiếp cận tham khảo và thông tin của DPA; không chuyển giá, quà tặng hoặc khuyến mãi của quán khác sang DPA.</p><div className="market-proposal-sources">{proposal.sources.map(s=><a href={s.url} key={s.id} target="_blank" rel="noopener noreferrer">{s.name}<ExternalLink size={13}/></a>)}</div></details>
  <div className="market-proposal-visual"><b>Ảnh đi kèm</b><p>{proposal.visual}</p></div>
 </section>;
}
