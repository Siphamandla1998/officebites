import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRequestGuard } from '../../hooks/useRequestGuard';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { vendorAgreementService } from '../../services/vendorAgreementService';
import { AgreementDocuments, AgreementHistory } from '../../components/features/AgreementDocuments';

import { agreementKinds } from '../../utils/vendorAgreement';

function AgreementReview({ actorId, vendorId }) {
  const guard = useRequestGuard(`${actorId}:${vendorId}`);
  const online = useOnlineStatus();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  const load = useCallback(async () => {
    if (busy.current) return;
    const current = guard.begin();
    setLoading(true); setAcknowledged(false); setError('');
    try {
      const state = await vendorAgreementService.state();
      if (!current()) return;
      if (state?.vendorId !== vendorId) throw new Error('Your vendor account changed. Reload this page.');
      setData(state);
    } catch (failure) {
      if (current()) { setData(null); setError(failure.message); }
    } finally { if (current()) setLoading(false); }
  }, [guard, vendorId]);
  useEffect(() => {
    if (online) void load();
    const refresh = () => { if (navigator.onLine) void load(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [load, online]);
  const assignment = data?.assignment;
  const complete = agreementKinds.every(kind => assignment?.documents?.[kind]?.content);
  const available = online && !loading && data?.enabled && data?.businessReady && data?.requiresAcceptance && complete;
  async function accept(event) {
    event.preventDefault();
    if (!available || !acknowledged || busy.current) return;
    const current = guard.capture();
    busy.current = true; setSaving(true); setError(''); setNotice('');
    try {
      const receipt = await vendorAgreementService.accept(assignment.id);
      if (!current()) return;
      // A receipt is success; do not infer success from a timeout or local state.
      if (!receipt?.id || receipt.vendor_id !== vendorId || receipt.actor_id !== actorId) throw new Error('Acceptance could not be confirmed. Reload to check your records.');
      setAcknowledged(false);
      setData(previous => ({ ...previous, accepted: true, requiresAcceptance: false,
        history: [receipt, ...(previous.history || []).filter(r => r.id !== receipt.id)] }));
      setNotice('Your agreement acceptance is saved. Compliance checks and administrator approval are still separate requirements.');
    } catch (failure) {
      if (current()) { setError(failure.message); setAcknowledged(false); setData(null); }
    } finally { busy.current = false; if (current()) setSaving(false); }
  }
  return <div className="max-w-3xl mx-auto space-y-5 min-w-0">
    <header className="space-y-2"><p className="text-xs font-medium text-ink-muted">Vendor onboarding</p>
      <h1 className="text-2xl font-semibold text-ink">Vendor Agreement</h1>
      <p className="text-sm text-ink-soft">Review your agreement, commercial schedule and operating standards here. Acceptance does not activate your store, verify your compliance documents or change payment settlement.</p>
    </header>
    {!online && <p role="status" className="card p-4">You are offline. Reconnect and reload the latest agreement to accept. Acceptance is never queued offline.</p>}
    {loading && online && <p role="status">Loading your agreement and saved records…</p>}
    {error && <p role="alert" className="card p-4 text-sm">{error}</p>}
    {notice && <div className="card p-4 space-y-3 text-sm"><p role="status">{notice}</p><Link className="btn-primary min-h-11 print:hidden" to="/vendor/compliance">Continue to compliance review</Link></div>}
    <button type="button" className="btn-secondary min-h-11 print:hidden" disabled={!online || loading || saving} onClick={() => void load()}>Reload agreement and records</button>
    {!loading && data && <>
      {!assignment && <p role="status" className="card p-4">Your approved vendor-specific agreement is not available yet. OfficeBites must complete and approve your documents first. No acceptance is requested.</p>}
      {!data.enabled && <p role="status" className="card p-4">Agreement acceptance is not yet open. You can review available approved documents and your saved records.</p>}
      {!data.businessReady && <p role="status" className="card p-4">Company disclosures are awaiting approval. Acceptance remains unavailable.</p>}
      {data.upcoming && <p role="status" className="card p-4 text-sm">An approved update is scheduled for {new Date(data.upcoming.effectiveAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST. Your existing acceptance remains on record.</p>}
      {assignment && <section className="card p-4 sm:p-6 space-y-5" aria-labelledby="current-agreement">
        <h2 id="current-agreement" className="text-lg font-semibold">Your agreement documents</h2>
        <p className="text-sm text-ink-muted">Effective {new Date(assignment.effectiveAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST</p>
        <AgreementDocuments documents={assignment.documents} />
        {!complete && <p role="alert">All approved documents must be available before acceptance.</p>}
        {!data.requiresAcceptance && <p role="status">{data.accepted ? 'Your acceptance of these versions is recorded.' : 'This update does not require another acceptance. Your earlier agreement remains on record.'}</p>}
        {data.requiresAcceptance && <form onSubmit={accept} className="border-t border-line pt-5 space-y-4 print:hidden">
          <label className="flex items-start gap-3 py-2 text-sm leading-relaxed">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-nude-700" checked={acknowledged}
              onChange={event => setAcknowledged(event.target.checked)} disabled={!available || saving} aria-describedby="agreement-acceptance-note" />
            <span>I have read, understand and agree to the Vendor Agreement, Commercial Fee Schedule and Vendor Operating Standards. I have reviewed Privacy and Refunds. I am authorised to accept on behalf of this vendor.</span>
          </label>
          <p id="agreement-acceptance-note" className="text-xs text-ink-muted">Your signed-in account, vendor, document versions and acceptance time will be recorded securely.</p>
          <button type="submit" className="btn-primary min-h-11 w-full sm:w-auto" disabled={!available || !acknowledged || saving}>{saving ? 'Saving acceptance…' : 'Accept & Continue'}</button>
        </form>}
      </section>}
      <AgreementHistory history={data.history} />
    </>}
    <p className="flex flex-wrap gap-4 text-sm print:hidden"><Link className="underline py-2" to="/vendor/compliance">Continue to compliance review</Link><Link className="underline py-2" to="/help/contact">Help with this agreement</Link></p>
  </div>;
}
export default function VendorAgreement() {
  const { user } = useAuth();
  return user?.vendorId ? <AgreementReview key={`${user.id}:${user.vendorId}`} actorId={user.id} vendorId={user.vendorId} />
    : <p role="status">Your vendor application is still being prepared. Sign in again or contact Support if it remains unavailable.</p>;
}
