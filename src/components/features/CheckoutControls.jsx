import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { checkoutService } from '../../services/checkoutService';
import RequestError from '../ui/RequestError';
import { DeliveryOriginQueue } from './VendorDeliveryOrigin';

export default function CheckoutControls() {
  const gateways = useAsync(checkoutService.gateways, [], []);
  const delivery = useAsync(checkoutService.deliverySettings, [], null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const [draft, setDraft] = useState(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  async function save(action, message = 'Delivery policy saved and reloaded.') {
    if (busy) return;
    setBusy(true); setError(null); setConfirmation('');
    try { await action(); await gateways.refetch({ throwOnError: true }); await delivery.refetch({ throwOnError: true }); setDraft(null); setConfirmation(message); }
    catch (failure) { setError(failure); } finally { setBusy(false); }
  }
  return <section className="card p-4 flex flex-col gap-4">
    <h2 className="section-title">Checkout controls</h2>
    {confirmation && <p role="status">{confirmation}</p>}
    <RequestError error={error || gateways.error || delivery.error} onRetry={() => { setError(null); gateways.refetch(); delivery.refetch(); }} />
    <p>Disabling new payments does not disable webhooks or change confirmed payments. Ozow cannot be enabled until server readiness is verified; secrets are never entered here.</p>
    <p>Manual EFT is unavailable; manual proof uploads cannot confirm payment.</p>
    {gateways.data?.map(g => <form aria-label={`${g.provider === 'payfast' ? 'PayFast' : 'Ozow'} gateway settings`} className="border-t pt-3 flex flex-col gap-2" key={`${g.provider}:${g.updated_at}`} onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      void save(() => checkoutService.saveGateway(g.provider, form.has('enabled'), form.has('maintenance'), String(form.get('notice') || '')), 'Gateway settings saved and reloaded.');
    }}>
      <strong>{g.provider === 'payfast' ? 'PayFast' : 'Ozow'}</strong>
      <p>Configuration gate: {g.ready ? 'Available' : 'Not verified'} · Updated: {g.updated_at ? new Date(g.updated_at).toLocaleString() : 'Backend installation pending'}</p>
      <label><input type="checkbox" name="enabled" defaultChecked={g.enabled} disabled={!g.ready || busy} /> Enabled for new payments</label>
      <label><input type="checkbox" name="maintenance" defaultChecked={g.maintenance} disabled={busy} /> Maintenance</label>
      <label>Public notice <input className="input" name="notice" maxLength={500} defaultValue={g.notice} /></label>
      <button className="btn-outline" disabled={busy}>Save gateway settings</button>
    </form>)}
    <details className="border-t pt-3">
    <summary className="font-semibold cursor-pointer">Delivery policy and vendor origins</summary>
    {delivery.data && <form className="pt-3 flex flex-col gap-3" onSubmit={event => { event.preventDefault(); void save(() => checkoutService.saveHub(draft || delivery.data, reason)); }}>
      <h3 className="font-semibold">Delivery policy</h3>
      <p>CENTRAL is the default for every vendor. Delivery costs the standard fee once per checkout if any vendor requires a paid-zone delivery. The operational hub pin still requires verification.</p>
      <a href={`https://www.google.com/maps?q=${encodeURIComponent(`${(draft || delivery.data).latitude},${(draft || delivery.data).longitude}`)}`} target="_blank" rel="noreferrer">Review central hub map pin</a>
      {['hub_name', 'hub_address'].map(key => <label key={key}>{key === 'hub_name' ? 'Central hub name' : 'Central hub address'}<input className="input" required maxLength={key === 'hub_name' ? 200 : 1000} value={(draft || delivery.data)[key] || ''} onChange={event => setDraft({ ...(draft || delivery.data), [key]: event.target.value })} /></label>)}
      {['latitude','longitude','free_radius_km','max_radius_km','paid_fee'].map(key => <label key={key}>{({latitude:'Origin latitude',longitude:'Origin longitude',free_radius_km:'Free radius (km)',max_radius_km:'Maximum distance (km)',paid_fee:'Paid-zone fee (ZAR)'})[key]}
        <input className="input" type="number" step="any" required value={(draft || delivery.data)[key] ?? ''} onChange={event => setDraft({ ...(draft || delivery.data), [key]: event.target.value })} /></label>)}
      <label><input type="checkbox" checked={Boolean((draft || delivery.data).hub_pin_verified)} onChange={event => setDraft({ ...(draft || delivery.data), hub_pin_verified: event.target.checked })} /> I verified the exact operational hub map pin</label>
      <label><input type="checkbox" checked={Boolean((draft || delivery.data).fee_structure_confirmed)} onChange={event => setDraft({ ...(draft || delivery.data), fee_structure_confirmed: event.target.checked })} /> Owner approved the once-per-checkout fee structure</label>
      <p>Authenticated and guest staging checkout verification: {delivery.data.activation_ready ? 'Recorded' : 'Pending — enforcement stays disabled'}</p>
      <label><input type="checkbox" disabled={!delivery.data.activation_ready || busy} checked={Boolean((draft || delivery.data).enabled)} onChange={event => setDraft({ ...(draft || delivery.data), enabled: event.target.checked })} /> Enforce delivery quotes</label>
      <label>Configuration reason<textarea className="input" required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <button className="btn-outline" disabled={busy}>Save confirmed delivery policy</button>
    </form>}
    <DeliveryOriginQueue />
    </details>
  </section>;
}
