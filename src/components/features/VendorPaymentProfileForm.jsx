import { useState } from 'react';
import { manualPaymentService } from '../../services/manualPaymentService';

const fields = {
  accountHolder: 'Account holder',
  bank: 'Bank',
  accountNumber: 'Account number',
  accountType: 'Account type',
  branchCode: 'Branch code',
  shapId: 'Registered ShapID',
};
const emptyDestination = () => ({
  accountHolder: '',
  bank: '',
  accountNumber: '',
  accountType: '',
  branchCode: '',
  shapId: '',
});

export default function VendorPaymentProfileForm({ vendorId, onSaved }) {
  const [destination, setDestination] = useState(emptyDestination);
  const [eft, setEft] = useState(true);
  const [payshap, setPayshap] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [submittedUnconfirmed, setSubmittedUnconfirmed] = useState(false);

  const update = key => event => setDestination(current => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (busy || submittedUnconfirmed || !vendorId) return;
    if (!eft && !payshap) {
      setError(new Error('Select at least one receiving method.'));
      return;
    }

    setBusy(true);
    setError(null);
    setMessage('');
    try {
      await manualPaymentService.submit(vendorId, destination, eft, payshap);
      try {
        await onSaved?.();
      } catch {
        // The RPC may have committed even if the follow-up workspace read failed.
        // Keep the entered values visible and prevent a duplicate version submission.
        setSubmittedUnconfirmed(true);
        setMessage('The server accepted the submission, but OfficeBites could not reload the profile list to verify it. Do not submit these details again yet. Refresh the page or ask an administrator to check the pending profile.');
        return;
      }
      setDestination(emptyDestination());
      setEft(true);
      setPayshap(false);
      setMessage('Banking details saved and reloaded as a pending version. An independent administrator must verify them before EFT instructions can be used.');
    } catch (failure) {
      if (failure?.code === 'PGRST202' || /could not find the function|schema cache/i.test(failure?.message || '')) {
        setError(new Error('Secure banking-profile saving is not installed in this environment yet. Your details were not saved; contact the OfficeBites administrator to finish the database setup.'));
      } else {
        setError(failure instanceof Error ? failure : new Error('Banking details could not be saved. Please review the fields and try again.'));
      }
    } finally {
      setBusy(false);
    }
  }

  return <section className="card p-4 flex flex-col gap-3" aria-label="Vendor banking details">
    <div>
      <h3 className="font-semibold">Banking details</h3>
      <p className="text-sm text-ink-muted mt-1">Save the receiving account for this vendor's direct payments. Every submission creates a new version and stays pending until an independent administrator verifies account ownership and receiving capability. Existing orders keep their original recipient.</p>
    </div>
    {error && <p role="alert" className="text-sm">{error.message}</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <fieldset disabled={busy || submittedUnconfirmed || !vendorId} className="flex flex-col gap-3">
        {Object.entries(fields).map(([key, label]) => {
          const isEftField = ['accountNumber', 'accountType', 'branchCode'].includes(key);
          const required = ['accountHolder', 'bank'].includes(key) || (eft && isEftField) || (payshap && key === 'shapId');
          const numberField = key === 'accountNumber';
          const branchField = key === 'branchCode';
          return <label key={key}>{label}
            <input
              className="input"
              name={key}
              type="text"
              inputMode={numberField || branchField ? 'numeric' : undefined}
              autoComplete="off"
              maxLength={key === 'accountNumber' ? 20 : key === 'branchCode' ? 6 : 150}
              minLength={numberField ? 6 : branchField ? 6 : undefined}
              pattern={numberField ? '[0-9]{6,20}' : branchField ? '[0-9]{6}' : undefined}
              value={destination[key]}
              onChange={update(key)}
              required={required}
            />
          </label>;
        })}
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={eft} onChange={event => setEft(event.target.checked)} />
          This account supports EFT
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={payshap} onChange={event => setPayshap(event.target.checked)} />
          Registered ShapID supports receiving PayShap
        </label>
        <button type="submit" className="btn-outline" disabled={busy || submittedUnconfirmed || !vendorId || (!eft && !payshap)}>
          {busy ? 'Saving banking details…' : submittedUnconfirmed ? 'Submission awaiting verification' : 'Save banking details for review'}
        </button>
      </fieldset>
    </form>
    <p className="text-xs text-ink-muted">Saving details does not turn on any payment method or approve this vendor to receive new orders. OfficeBites only uses the profile for new orders after separate administrator approval.</p>
  </section>;
}
