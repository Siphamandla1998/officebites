import { useState } from 'react';
import { supabase } from '../../services/api/supabaseClient';
import Modal from '../ui/Modal';
import RequestError from '../ui/RequestError';

export default function AccountRemoval({ kind, id, onRemoved }) {
  const [open, setOpen] = useState(false), [preview, setPreview] = useState(null);
  const [confirmation, setConfirmation] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(null);
  const invoke = async action => {
    setBusy(true); setError(null);
    try {
      const result = await supabase.functions.invoke('admin-account-removal', { body: { action, kind, id, fingerprint: preview?.fingerprint, confirmation } });
      if (result.error) { let message = result.error.message; try { message = (await result.error.context?.json())?.error || message; } catch { /* Retain original failure. */ } throw new Error(message); }
      if (result.data?.error) throw new Error(result.data.error);
      if (action === 'preview') setPreview(result.data);
      else { setOpen(false); setPreview(null); setConfirmation(''); onRemoved?.(); }
    } catch (failure) { setError(failure); } finally { setBusy(false); }
  };
  return <>
    <button className="btn-outline !px-3 !py-1.5 text-xs" onClick={() => { setOpen(true); invoke('preview'); }}>{kind === 'vendor' ? 'Remove vendor' : 'Delete account'}</button>
    <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title="Review account removal">
      <RequestError error={error} onRetry={() => invoke('preview')} />
      {busy && <p>Working…</p>}
      {preview && <div className="space-y-3 text-sm">
        {preview.blockers?.length > 0 && <div role="alert"><p>Removal is blocked:</p><ul>{preview.blockers.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}
        <p>{preview.name}</p><p>{preview.financialHistory}</p>
        <p>{preview.orders} orders, {preview.suborders} suborders, {preview.meals} meals, {preview.conversations} conversations, {preview.notifications} notifications and {preview.storage.length} stored files.</p>
        <p>The account will lose access. Stored files and its Auth identity are removed; financial records remain. Free-text support/chat content follows the separately reviewed retention policy.</p>
        <label className="block">Type <strong>{preview.confirmation}</strong><input className="input w-full" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        <button className="btn-primary" disabled={busy || preview.blockers?.length > 0 || confirmation !== preview.confirmation} onClick={() => invoke('remove')}>Confirm reviewed removal</button>
      </div>}
    </Modal>
  </>;
}
