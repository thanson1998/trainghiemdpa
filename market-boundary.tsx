import {Component,type ReactNode} from 'react';
export class MarketBoundary extends Component<{children:ReactNode;onClose:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){if(!this.state.failed)return this.props.children;return <section role="alert" style={{padding:24,background:'#fff',border:'1px solid #dce3eb',borderRadius:12}}><h1 style={{fontSize:22}}>Chưa mở được Ads Thái Nguyên</h1><p>Phần nghiên cứu chưa tải được đầy đủ. Hãy mở lại bằng nút bên dưới; các trang bán hàng vẫn sử dụng được.</p><div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button className="primary-btn" onClick={()=>{const url=new URL(location.href);url.searchParams.set('ui','market-20261025');url.hash='thi-truong';location.assign(url.href);}}>Mở lại trang nghiên cứu</button><button className="secondary-btn" onClick={this.props.onClose}>Quay lại POS</button></div></section>;}
}
