import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useRequestGuard } from '../../hooks/useRequestGuard';
import { checkoutService } from '../../services/checkoutService';
import { validatePosition } from '../../utils/delivery';
import RequestError from '../ui/RequestError';

export default function VendorDeliveryOrigin({ vendorId, admin = false, onChanged }) {
  const { user } = useAuth();
  const state = useAsync(() => checkoutService.origin(vendorId), [vendorId, user?.id], null);
  const guard = useRequestGuard(`${user?.id}:${vendorId}`);
  const lock = useRef(false);
  const [draft, setDraft] = useState({ address: '', latitude: '', longitude: '' });
  const [reason, setReason] = useState(''), [radius, setRadius] = useState('');
  const [busy, setBusy] = useState(false), [failure, setFailure] = useState(null), [message, setMessage] = useState('');
  const current = state.data?.current;
  useEffect(() => {
    setDraft({ address: current?.address || '', latitude: current?.latitude ?? '', longitude: current?.longitude ?? '' });
    setRadius(current?.service_radius_km ?? ''); setReason(''); setFailure(null); setMessage('');
  }, [current]);
  useEffect(() => { setBusy(false); lock.current = false; }, [vendorId, user?.id]);
  async function act(action) {
    if (busy || lock.current) return;
    lock.current = true; const valid = guard.begin(); setBusy(true); setFailure(null); setMessage('');
    try {
      if (admin) await checkoutService.decideOrigin(vendorId, current.revision, action, reason, radius);
      else await checkoutService.requestOrigin(vendorId, draft);
      if (!valid()) return;
      await state.refetch({ throwOnError: true });
      if (valid()) { setMessage('Delivery origin updated. Review the current mode below.'); onChanged?.(); }
    } catch (error) { if (valid()) setFailure(error); }
    finally { if (valid()) { setBusy(false); lock.current = false; } }
  }
  function locate() {
    if (!navigator.geolocation) { setFailure(new Error('Location is unavailable. Enter a verified map pin.')); return; }
    const valid = guard.begin(); setBusy(true);
    navigator.geolocation.getCurrentPosition(position => {
      if (!valid()) return;
      try { const p = validatePosition(position); setDraft(d => ({ ...d, latitude: p.latitude, longitude: p.longitude })); setFailure(null); }
      catch (error) { setFailure(error); } finally { setBusy(false); }
    }, () => { if (valid()) { setBusy(false); setFailure(new Error('Location permission or GPS failed. Retry or enter a verified map pin.')); } }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  return <section className="card p-4 flex flex-col gap-3">
    <h2 className="section-title">Delivery origin</h2>
    <RequestError error={failure || state.error} onRetry={state.refetch} />
    {state.loading ? <p>Loading delivery origin…</p> : current && <>
      <p>Current mode: <strong>{current.mode}</strong> · Location status: <strong>{current.status}</strong></p>
      <p>CENTRAL uses the OfficeBites hub without requiring your business GPS. A location request stays CENTRAL until an administrator approves it and selects VENDOR mode. Changing profile coordinates or address invalidates approval.</p>
      {current.address && <p>Proposed address: {current.address} · {current.latitude}, {current.longitude}</p>}
      {current.latitude != null && <a href={`https://www.google.com/maps?q=${encodeURIComponent(`${current.latitude},${current.longitude}`)}`} target="_blank" rel="noreferrer">View proposed map pin</a>}
      {!admin ? <form className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); void act('request'); }}>
        <label>Proposed physical address<input className="input" required maxLength={1000} value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} /></label>
        <label>Proposed latitude<input className="input" type="number" step="any" min={-90} max={90} required value={draft.latitude} onChange={e => setDraft({ ...draft, latitude: e.target.value })} /></label>
        <label>Proposed longitude<input className="input" type="number" step="any" min={-180} max={180} required value={draft.longitude} onChange={e => setDraft({ ...draft, longitude: e.target.value })} /></label>
        <button type="button" className="btn-outline" disabled={busy} onClick={locate}>Capture proposed GPS</button>
        <button className="btn-primary" disabled={busy}>Request location approval</button>
      </form> : <form className="flex flex-col gap-3" onSubmit={event => event.preventDefault()}>
        <label>Decision reason<textarea className="input" required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <label>Approved maximum radius (km, blank uses hub policy)<input className="input" type="number" step="any" min="0.001" max="1000" value={radius} onChange={e => setRadius(e.target.value)} disabled={current.status !== 'pending'} /></label>
        <div className="flex flex-wrap gap-2">{[
          ['approve', 'Approve location', current.status === 'pending'], ['reject', 'Reject location', current.status === 'pending'],
          ['vendor', 'Use VENDOR origin', current.status === 'approved' && current.mode !== 'VENDOR'],
          ['central', 'Use CENTRAL hub', current.status === 'approved' && current.mode !== 'CENTRAL'],
          ['revoke', 'Revoke origin permission', current.status === 'approved'],
        ].filter(([, , available]) => available).map(([action, label]) => <button type="button" className="btn-outline" key={action} disabled={busy || !reason.trim()} onClick={() => void act(action)}>{label}</button>)}</div>
      </form>}
      {message && <p role="status">{message}</p>}
      <details><summary>Approval history ({state.data.history.length})</summary>{state.data.history.map(entry => <p key={entry.id}>{new Date(entry.created_at).toLocaleString()} · {entry.action} · {entry.reason} · Administrator/actor {entry.actor_id || 'system'} · Version {entry.revision}</p>)}</details>
    </>}
  </section>;
}

export function DeliveryOriginQueue() {
  const { user } = useAuth();
  const queue = useAsync(checkoutService.originQueue, [user?.id], []);
  const [selected, setSelected] = useState(null);
  useEffect(() => setSelected(null), [user?.id]);
  return <section className="card p-4 flex flex-col gap-3"><h2 className="section-title">Vendor-origin approval queue</h2>
    <RequestError error={queue.error} onRetry={queue.refetch} />
    {queue.loading ? <p>Loading requests…</p> : !queue.data?.length ? <p>No vendor-origin requests. Vendors use CENTRAL by default.</p> : queue.data.map(row => <button className="btn-outline" key={row.vendor_id} onClick={() => setSelected(row.vendor_id)}>{row.vendor_name} · {row.status} · {row.mode}</button>)}
    {selected && <VendorDeliveryOrigin key={selected} vendorId={selected} admin onChanged={queue.refetch} />}
  </section>;
}
