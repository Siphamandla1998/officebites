import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { vendorService } from '../../services/vendorService';
import RequestError from '../ui/RequestError';

export default function AdminPaymentProfileForm({ userId, fields, busy, submit }) {
  const vendors = useAsync(() => vendorService.getVendors({ status: 'all' }), [userId], []);
  const [eft, setEft] = useState(true);
  const [payshap, setPayshap] = useState(false);
  return <details>
    <summary className="font-semibold cursor-pointer">Submit banking on behalf of a vendor</summary>
    <p>Use verified details supplied by the vendor through the approved secure process. Submission creates a pending version, does not activate the vendor, and requires a different administrator to approve it.</p>
    <RequestError error={vendors.error} onRetry={vendors.refetch} />
    <form aria-label="Admin vendor banking submission" className="flex flex-col gap-3" onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      if (!eft && !payshap) return;
      void submit(String(form.get('vendor')), Object.fromEntries(Object.keys(fields).map(k => [k, String(form.get(k) || '')])), eft, payshap);
    }}>
      <fieldset disabled={busy || vendors.loading || !!vendors.error} className="flex flex-col gap-3">
        <label>Vendor receiving these payments<select className="input" name="vendor" defaultValue="" required>
          <option value="">Choose vendor</option>
          {vendors.data.filter(v => !v.archivedAt && ['pending', 'approved'].includes(v.status)).map(v => <option key={v.id} value={v.id}>{v.name} ({v.status})</option>)}
        </select></label>
        {Object.entries(fields).map(([key, label]) => {
          const accountNumber = key === 'accountNumber';
          const branchCode = key === 'branchCode';
          const required = ['accountHolder', 'bank'].includes(key) || (eft && ['accountNumber', 'accountType', 'branchCode'].includes(key)) || (payshap && key === 'shapId');
          return <label key={key}>{label}<input className="input" name={key} required={required} minLength={accountNumber || branchCode ? 6 : key === 'accountType' ? 2 : undefined} maxLength={accountNumber ? 20 : branchCode ? 6 : 150} pattern={accountNumber ? '[0-9]{6,20}' : branchCode ? '[0-9]{6}' : undefined} inputMode={accountNumber || branchCode ? 'numeric' : undefined} autoComplete="off" /></label>;
        })}
        <label><input type="checkbox" checked={eft} onChange={event => setEft(event.target.checked)} /> Account supports EFT</label>
        <label><input type="checkbox" checked={payshap} onChange={event => setPayshap(event.target.checked)} /> Registered ShapID supports receiving PayShap</label>
        <button className="btn-outline" type="submit">Submit pending banking version</button>
      </fieldset>
    </form>
  </details>;
}
