import { useState } from 'react';
import { commercialService } from '../../services/commercialService';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import { downloadCsv } from '../../utils/csv';
import { Link } from 'react-router-dom';
import VendorConsent from '../../components/features/VendorConsent';
import CommercialStatement from '../../components/features/CommercialStatement';

const businessFields = ['legalName','registrationNumber','tradingName','businessAddress','legalNoticeAddress','vatTreatment','informationOfficer','informationOfficerContact','email','telephone','website'];
function Fields({ names, value, change }) {
  return names.map(name => <label className="block text-sm" key={name}>{name.replaceAll('_',' ').replace(/([A-Z])/g,' $1')}
    <input className="input w-full block border rounded p-2" value={value[name] ?? ''} onChange={e => change({ ...value, [name]: e.target.value })} />
  </label>);
}
function BusinessEditor({ initial, save, busy }) {
  const [value, change] = useState(initial);
  return <form className="card p-4 space-y-3" onSubmit={e => { e.preventDefault();save('business',value); }}><h2 className="font-semibold">Business disclosures</h2>
    <Fields names={businessFields} value={value} change={change} /><button className="btn-primary" disabled={busy}>Save disclosures</button>
  </form>;
}
export default function CommercialWorkspace() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useAsync(() => commercialService.workspace(), [user?.id], null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [account, setAccount] = useState({ name:'',internal_identifier:'',status:'draft' });
  const [document, setDocument] = useState({kind:'terms',version:'',title:'',content:'',effective_at:''});
  const [offer, setOffer] = useState({account_id:'',vendor_id:'',document_id:'',starts_at:'',ends_at:''});
  const [member, setMember] = useState({account_id:'',customer_id:'',evidence:''});
  const [approval, setApproval] = useState({id:'',approvalReference:''});
  const [consent, setConsent] = useState(null);
  async function act(action, value) {
    setBusy(true);setNotice('');
    try { await commercialService.action(action,value);setNotice('Saved.');await refetch(); }
    catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  async function respond(id, accept) {
    setBusy(true);setNotice('');
    try { await commercialService.respond(id,accept);setNotice(accept ? 'Accepted. Activation remains subject to administrator and readiness checks.' : 'Declined.');await refetch(); }
    catch(e) { setNotice(e.message); } finally { setBusy(false); }
  }
  const ledger = data?.ledger || [];
  const credits = (data?.adjustments || []).reduce((n,r)=>n+Number(r.acquisition_credit),0);
  const exportLedger = () => downloadCsv('corporate-acquisition.csv', ['Agreement','Corporate account','Vendor','Order','Week (SAST)','Position','Eligible subtotal','Rate','Acquisition fee','Eligible at','Calculation version'], ledger.map(r => [r.agreement_id,r.account_id,r.vendor_id,r.order_id,r.week_start,r.position,r.eligible_subtotal,r.rate,r.amount,r.eligible_at,r.calculation_version]));
  if (loading) return <p role="status">Loading commercial workspace…</p>;
  if (error) return <div role="alert">{error.message}<button onClick={() => refetch()}>Retry</button></div>;
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">{data?.admin ? 'Legal & corporate accounts' : 'Corporate opportunities'}</h1>
    <p className="card p-4">Acquisition charging and the new standard-fee ledger remain disabled pending approved terms, tax treatment and verified settlement/refund integration. Existing financial snapshots remain authoritative. No advertising or subscription billing is activated here.</p>
    {notice && <p role="status" className="card p-3">{notice}</p>}
    <p><Link className="underline" to="/vendor-agreement">Vendor agreement</Link> · <Link className="underline" to="/vendor-fees">Vendor fees</Link></p>
    <details open={!data?.admin} className="space-y-4"><summary className="font-semibold cursor-pointer">Commercial statements and fee reference</summary>
    <CommercialStatement userId={user?.id}/>
    <section className="card p-4 space-y-2"><h2 className="font-semibold">Acquisition statement</h2>
      <p>{ledger.length} ledger charges · acquisition fees R{ledger.reduce((n,r)=>n+Number(r.amount),0).toFixed(2)} · refund credits R{credits.toFixed(2)}</p>
      <p>Progressive weekly rates per agreement and vendor: positions 1–49: 5%; 50–99: 7.5%; 100+: 10%. Weeks start Monday in Africa/Johannesburg. This is additional to the standard 17% and applies only after separate acceptance and activation.</p>
      <p>Illustration only: R70 meal − R10.50 platform − R1.40 internal charge − R3.50 acquisition = R54.60 before provider expenses and applicable tax. Delivery excluded.</p>
      <button className="btn-secondary" onClick={exportLedger}>Download acquisition CSV</button>
      <button className="btn-secondary" onClick={() => downloadCsv('corporate-refund-credits.csv',['Entry','Provider','Provider event','Refunded subtotal','Acquisition credit','Confirmed at'],(data?.adjustments || []).map(r=>[r.entry_id,r.provider,r.provider_event_id,r.refunded_subtotal,r.acquisition_credit,r.confirmed_at]))}>Download refund credits CSV</button>
    </section>
    </details>
    <section className="space-y-3"><h2 className="text-lg font-semibold">Agreements</h2>
      {!data?.agreements?.length && <p>No corporate agreements.</p>}
      {data?.agreements?.map(a => <article className="card p-4 space-y-2" key={a.id}>
        <h3 className="font-semibold">{a.corporate_name} — {a.effective_status}</h3>
        <p className="text-sm break-all">Agreement {a.id} · vendor {a.vendor_id}</p><p>{a.starts_at} to {a.ends_at} (no automatic renewal)</p>
        <p>Accepted: {a.accepted_at || 'Not accepted'}</p>
        <details><summary>Retain / review agreement document and locked terms</summary><p>{a.document?.title} · {a.document?.version}</p><p className="whitespace-pre-wrap">{a.document?.content}</p><pre className="whitespace-pre-wrap break-words">{JSON.stringify(a.terms,null,2)}</pre></details>
        {!data.admin && a.status==='offered' && <div className="flex gap-3"><button className="btn-primary" disabled={busy} onClick={() => respond(a.id,true)}>Accept agreement</button><button className="btn-secondary" disabled={busy} onClick={() => respond(a.id,false)}>Decline agreement</button></div>}
        {data.admin && ['offered','accepted','active'].includes(a.status) && <button className="btn-secondary" disabled={busy} onClick={() => act('terminate',{id:a.id})}>Terminate agreement</button>}
      </article>)}
    </section>
    <section className="card p-4"><h2 className="font-semibold">Recorded standard acceptances</h2>
      {!data?.acceptances?.length && <p>No new-framework acceptance recorded.</p>}
      {data?.acceptances?.map(a => <details key={a.id}><summary>{a.accepted_at} · {a.fee_version}</summary>{Object.values(a.documents).map(d=><div key={d.id}><h3>{d.title} · {d.version}</h3><p className="whitespace-pre-wrap">{d.content}</p><p className="break-all">SHA-256 {d.content_hash}</p></div>)}</details>)}
    </section>
    {!data?.admin && <section className="space-y-3"><VendorConsent onChange={setConsent}/><button className="btn-secondary" disabled={busy || !consent?.acknowledgements?.every(Boolean)} onClick={async()=>{
      setBusy(true);setNotice('');try { await commercialService.acceptLegal(user.vendorId,consent);setNotice('Acceptance recorded; accepted versions are retained below.');await refetch(); }catch(e){setNotice(e.message);}finally{setBusy(false);}
    }}>Record acceptance of current documents</button></section>}
    {data?.admin && <>
      <details className="space-y-4"><summary className="font-semibold cursor-pointer">Legal documents and business disclosures</summary>
      <BusinessEditor initial={data.business} save={act} busy={busy} />
      <form className="card p-4 space-y-3" onSubmit={e=>{e.preventDefault();act('document',document);}}><h2 className="font-semibold">Add immutable document draft</h2>
        <label className="block">Document<select value={document.kind} onChange={e=>setDocument({...document,kind:e.target.value})}>{['terms','privacy','refund-policy','vendor-agreement','vendor-fees'].map(k=><option key={k}>{k}</option>)}</select></label>
        <Fields names={['version','title','effective_at']} value={document} change={setDocument} /><p>Effective date: ISO timestamp with timezone, e.g. 2026-11-01T00:00:00+02:00.</p>
        <label className="block">Approved-source draft text<textarea className="border rounded w-full min-h-48" value={document.content} onChange={e=>setDocument({...document,content:e.target.value})} /></label>
        <button className="btn-primary" disabled={busy}>Save draft (unpublished)</button>
      </form>
      <section className="card p-4"><h2 className="font-semibold">Document versions</h2>{data.documents.map(d=><p key={d.id} className="break-all">{d.kind} · {d.version} · {d.id} · {d.approved_at ? 'Approved' : 'Unpublished'}</p>)}</section>
      <section className="card p-4 space-y-3"><h2 className="font-semibold">Vendor application agreement enforcement</h2><p>Enable only after all current legal documents and disclosures have been reviewed. Enabling rejects new vendor applications that omit current document versions or any of the eight acknowledgements. Existing accepted terms are retained.</p>
        <button className="btn-secondary" disabled={busy} onClick={async()=>{
          setBusy(true);try { const portal=await commercialService.portal();await act('onboarding',{enabled:true,documents:Object.fromEntries(Object.entries(portal.documents).map(([k,v])=>[k,v.id]))}); }catch(e){setNotice(e.message);}finally{setBusy(false);}
        }}>Enable mandatory application consent</button>
        <button className="btn-secondary" disabled={busy} onClick={()=>act('onboarding',{enabled:false})}>Disable new agreement enforcement</button>
      </section>
      <form className="card p-4 space-y-3" onSubmit={e=>{e.preventDefault();act('approve_document',approval);}}><h2 className="font-semibold">Publish reviewed legal document</h2><p>Requires complete disclosures and a legal approval reference. Publication cannot replace legal review.</p><Fields names={['id','approvalReference']} value={approval} change={setApproval}/><button className="btn-secondary" disabled={busy}>Approve publication</button></form>
      </details>
      <details className="space-y-4"><summary className="font-semibold cursor-pointer">Corporate accounts and agreement administration</summary>
      <form className="card p-4 space-y-3" onSubmit={e=>{e.preventDefault();act('account',account);}}><h2 className="font-semibold">Corporate account</h2>
        <Fields names={['name','internal_identifier','contact_name','contact_email','contact_phone','location','estimated_employees','secured_at','notes']} value={account} change={setAccount}/>
        <select aria-label="Corporate status" value={account.status} onChange={e=>setAccount({...account,status:e.target.value})}>{['draft','active','suspended','closed'].map(s=><option key={s}>{s}</option>)}</select><button className="btn-primary" disabled={busy}>Save corporate account</button>
        {data.accounts.map(c=><button type="button" className="block underline" key={c.id} onClick={()=>setAccount(c)}>{c.name} · {c.id} · {c.status} · {(data.memberships || []).filter(m=>m.account_id===c.id && !m.revoked_at).length} verified registered members (not an order count)</button>)}
      </form>
      <form className="card p-4 space-y-3" onSubmit={e=>{e.preventDefault();act('membership',member);}}><h2 className="font-semibold">Verify workplace membership</h2><p>Use explicit verified evidence. Email domain or a campaign code alone is insufficient.</p><Fields names={['account_id','customer_id','evidence']} value={member} change={setMember}/><button className="btn-secondary" disabled={busy}>Record verified membership</button><button className="btn-secondary" type="button" disabled={busy} onClick={()=>act('revoke_membership',member)}>Revoke membership</button></form>
      <form className="card p-4 space-y-3" onSubmit={e=>{e.preventDefault();act('offer',offer);}}><h2 className="font-semibold">Offer separate corporate agreement</h2><Fields names={['account_id','vendor_id','document_id','starts_at','ends_at']} value={offer} change={setOffer}/><p>ISO timestamps required. Empty end date defaults to 12 weeks. Rates are locked to the progressive schedule. No automatic activation.</p><button className="btn-secondary" disabled={busy}>Offer for explicit vendor acceptance</button></form>
      </details>
    </>}
  </div>;
}
