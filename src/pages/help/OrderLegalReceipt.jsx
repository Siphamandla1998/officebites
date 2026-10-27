import { Link, useParams } from 'react-router-dom';
import Navbar from '../../components/layout/Navbar';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { commercialService } from '../../services/commercialService';
import { getPaymentToken } from '../../services/manualPaymentService';
import { CustomerLegalDocuments } from '../../components/features/CustomerLegalReview';
export default function OrderLegalReceipt() {
 const {orderId}=useParams();const {user}=useAuth();
 const {data,loading,error,refetch}=useAsync(()=>commercialService.orderReceipt(orderId,getPaymentToken(orderId)),[orderId,user?.id],null);
 return <article className="pb-8"><Navbar showBack title="Order terms record" showCart={false}/><div className="ob-container py-6 space-y-4 min-w-0">
  <h1 className="text-2xl font-semibold">Order terms record</h1>
  {loading&&<p role="status">Loading saved evidence…</p>}{error&&<div role="alert"><p>Saved evidence is unavailable. Sign in as the order owner or recover private order access through Support.</p><button className="btn-secondary min-h-11" onClick={()=>refetch()}>Retry</button></div>}
  {!loading&&!error&&!data&&<p role="status">No versioned acceptance was recorded for this order. Earlier orders are not retrospectively marked as accepted.</p>}
  {data&&<><p>{data.acknowledgement}</p><p>Accepted {new Date(data.accepted_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})} SAST · {data.is_guest?'Guest order; no authenticated account identity claimed':'Authenticated order owner'}</p><CustomerLegalDocuments documents={data.documents} prefix="receipt"/><button className="btn-secondary min-h-11 print:hidden" onClick={event=>{const nodes=[...event.currentTarget.parentElement.querySelectorAll('details')];const opened=nodes.map(n=>n.open);nodes.forEach(n=>n.open=true);try{window.print();}finally{nodes.forEach((n,i)=>n.open=opened[i]);}}}>Print / save order terms</button></>}
  <Link className="underline py-2 inline-block" to="/help/contact">Contact Support</Link>
 </div></article>;
}