import { Link, useLocation } from 'react-router-dom';
import { commercialService } from '../../services/commercialService';
import { useAsync } from '../../hooks/useAsync';
import Navbar from '../../components/layout/Navbar';
const titles = { terms: 'Terms', privacy: 'Privacy', 'refund-policy': 'Refunds', delivery: 'Delivery', cookies: 'Cookies', 'company-information': 'Company information', 'vendor-agreement': 'Vendor Partnership Agreement', 'vendor-fees': 'Vendor fee schedule' };
export default function LegalDocument({ kind: supplied }) {
  const { pathname } = useLocation();
  const kind = supplied || pathname.slice(1);
  const { data, loading, error, refetch } = useAsync(() => commercialService.portal(), [], null);
  const document = data?.documents?.[kind];
  return <article className="pb-8">
    <div className="print:hidden"><Navbar showBack title={titles[kind]} showCart={false} /></div>
    <div className="ob-container py-6 space-y-5">
      <h2 className="text-2xl font-bold">{titles[kind]}</h2>
      {loading && <p role="status">Loading document…</p>}
      {error && <div role="alert"><p>Document unavailable: {error.message}</p><button className="btn-secondary" onClick={() => refetch()}>Retry</button></div>}
      {!loading && !error && !document && <p role="status">An approved version of this document has not been published. Contact OfficeBites for assistance. This page is not an agreement to unpublished terms.</p>}
      {document && <>
        <dl className="text-sm"><dt>Version</dt><dd>{document.version}</dd><dt>Effective</dt><dd>{new Date(document.effective_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}</dd><dt>Last updated</dt><dd>{new Date(document.created_at).toLocaleString('en-ZA')}</dd></dl>
        <h2 className="text-lg font-semibold">{document.title}</h2>
        <div className="whitespace-pre-wrap break-words leading-relaxed">{document.content}</div>
        <p className="text-xs break-all">Content SHA-256: {document.content_hash}</p>
        <button className="btn-secondary print:hidden" onClick={() => window.print()}>Print / save PDF</button>
      </>}
      {data?.business && <section className="card p-4 text-sm space-y-2"><h2 className="font-semibold">Business information</h2>
        {['legalName','tradingName','registrationNumber','businessAddress','legalNoticeAddress','vatTreatment','informationOfficer','informationOfficerContact'].map(key => <p key={key}><strong>{key.replace(/([A-Z])/g, ' $1')}: </strong>{data.business[key] || 'Awaiting administrator confirmation'}</p>)}
        <p><a href={`mailto:${data.business.email}`}>{data.business.email}</a></p><p>{data.business.telephone}</p>
        {!data.businessReady && <p>Business disclosures are incomplete; final compliance sign-off is pending.</p>}
      </section>}
      <Link className="underline print:hidden" to="/">Back to marketplace</Link>
    </div>
  </article>;
}
