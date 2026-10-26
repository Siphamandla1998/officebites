import { useAsync } from '../../hooks/useAsync';
import { vendorService } from '../../services/vendorService';
import RequestError from '../ui/RequestError';

export default function AdminPaymentProfileForm({ userId, fields, busy, submit }) {
  const vendors = useAsync(() => vendorService.getVendors({ status: 'all' }), [userId], []);
  return <details>
    <summary className="font-semibold cursor-pointer">Submit banking on behalf of a vendor</summary>
    <p>Use verified details supplied by the vendor through the approved secure process. Submission creates a pending version, does not activate the vendor, and requires a different administrator to approve it.</p>
    <RequestError error={vendors.error} onRetry={vendors.refetch} />
    <form aria-label="Admin vendor banking submission" className="flex flex-col gap-3" onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      void submit(String(form.get('vendor')), Object.fromEntries(Object.keys(fields).map(k => [k, String(form.get(k) || '')])), form.has('eft'), form.has('payshap'));
    }}>
      <fieldset disabled={busy || vendors.loading || !!vendors.error} className="flex flex-col gap-3">
        <label>Vendor receiving these payments<select className="input" name="vendor" defaultValue="" required>
          <option value="">Choose vendor</option>
          {vendors.data.filter(v => !v.archivedAt && ['pending', 'approved'].includes(v.status)).map(v => <option key={v.id} value={v.id}>{v.name} ({v.status})</option>)}
        </select></label>
        {Object.entries(fields).map(([key, label]) => <label key={key}>{label}<input className="input" name={key} required={['accountHolder', 'bank'].includes(key)} maxLength={150} autoComplete="off" /></label>)}
        <label><input type="checkbox" name="eft" /> Account supports EFT</label>
        <label><input type="checkbox" name="payshap" /> Registered ShapID supports receiving PayShap</label>
        <button className="btn-outline" type="submit">Submit pending banking version</button>
      </fieldset>
    </form>
  </details>;
}
