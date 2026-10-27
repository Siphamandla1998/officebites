import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { commercialService } from '../../services/commercialService';
import LegalPublicationReview from '../../components/features/LegalPublicationReview';
import RequestError from '../../components/ui/RequestError';

export default function CommercialWorkspace() {
  const { user } = useAuth();
  const result = useAsync(commercialService.workspace, [user?.id], null);
  if (result.loading) return <p role="status">Loading legal records…</p>;
  if (result.error) return <RequestError error={result.error} onRetry={result.refetch} />;
  const data = result.data;
  if (!data) return <p role="status">Legal records are unavailable.</p>;
  return <div className="space-y-5">
    <h1 className="text-2xl font-bold">Legal documents</h1>
    <p className="card p-4">Publication and acceptance rollout require a separate release review. This view does not publish documents or change enforcement. Working drafts are not approved terms.</p>
    <p>Base fees: 15% platform fee plus 2% transaction-related fee, excluding applicable VAT. VAT registration and invoice treatment require verification. Optional marketing charges remain disabled.</p>
    <p><Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/refund-policy">Refunds</Link></p>
    {data.admin && <LegalPublicationReview data={{ ...data, publicationEnabled: false }} busy={false} save={() => { throw new Error('Publication is release-disabled'); }} />}
    <section className="card p-4 space-y-3"><h2 className="font-semibold">Version history</h2>
      {(data.documents || []).map(document => <details key={document.id}>
        <summary className="cursor-pointer py-3">{document.title} · {document.version} · {document.approved_at ? 'Approved record' : 'Unpublished draft'}</summary>
        <p className="whitespace-pre-wrap break-words">{document.content}</p>
        <p className="text-xs break-all">SHA-256: {document.content_hash}</p>
      </details>)}
    </section>
    <section className="card p-4 space-y-3"><h2 className="font-semibold">Retained acceptance evidence</h2>
      {(data.acceptances || []).map(receipt => <details key={receipt.id}>
        <summary className="cursor-pointer py-3">{receipt.accepted_at} · {receipt.fee_version}</summary>
        {Object.values(receipt.documents || {}).map(document => <div key={document.id}><h3>{document.title} · {document.version}</h3><p className="whitespace-pre-wrap break-words">{document.content}</p><p className="text-xs break-all">SHA-256: {document.content_hash}</p></div>)}
      </details>)}
    </section>
  </div>;
}
