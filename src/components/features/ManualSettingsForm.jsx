import { useEffect, useRef, useState } from 'react';
import { manualPaymentService } from '../../services/manualPaymentService';

const values = s => ({ eft: !!s.eft_enabled, payshap: !!s.payshap_enabled, minutes: String(s.deadline_minutes), threshold: String(s.review_threshold) });
const equal = (a, b) => a.eft === b.eft && a.payshap === b.payshap && Number(a.minutes) === Number(b.minutes) && Number(a.threshold) === Number(b.threshold);

export default function ManualSettingsForm({ settings, loading, loadError, reload, onBusyChange }) {
  const [state, setState] = useState(() => ({ confirmed: values(settings), draft: values(settings), conflict: false }));
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const savedAwaitingReload = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (loading || loadError || lock.current) return;
    const next = values(settings);
    setState(old => equal(next, old.confirmed) ? old : {
      confirmed: next,
      draft: equal(old.draft, old.confirmed) ? next : old.draft,
      conflict: !equal(old.draft, old.confirmed),
    });
  }, [settings, loading, loadError]);
  const dirty = !equal(state.draft, state.confirmed);
  const blocked = pending || loading;
  const edit = (key, value) => setState(old => ({ ...old, draft: { ...old.draft, [key]: value } }));
  async function execute(save) {
    if (lock.current || loading || (save && (!dirty || uncertain || state.conflict || loadError || reason.trim().length < 10))) return;
    lock.current = true; setPending(true); onBusyChange(true); setMessage('');
    let committed = false;
    try {
      if (save) {
        await manualPaymentService.settings(state.draft.eft, state.draft.payshap, state.draft.minutes, state.draft.threshold, reason);
        committed = true;
        if (!mounted.current) return;
        savedAwaitingReload.current = true;
        setReason(''); setUncertain(true);
      }
      const response = await reload({ throwOnError: true });
      if (!mounted.current) return;
      if (!response?.settings) throw new Error('No current settings returned.');
      const next = values(response.settings);
      const adopt = savedAwaitingReload.current;
      setState(old => adopt ? { confirmed: next, draft: next, conflict: false } : {
        confirmed: next, draft: equal(old.draft, old.confirmed) ? next : old.draft,
        conflict: old.conflict || (!equal(next, old.confirmed) && !equal(old.draft, old.confirmed)),
      });
      savedAwaitingReload.current = false;
      setUncertain(false);
      setMessage(save ? 'Save and reload succeeded.' : 'Settings reloaded. No save was sent.');
    } catch {
      if (mounted.current) {
        // A transport error cannot prove that a mutation was rolled back.
        if (save) setUncertain(true);
        setMessage(committed ? 'Save succeeded but settings reload failed. Reload settings before making another change.' : save ? 'Save failed or its outcome could not be confirmed. Reload settings before trying another save.' : 'Settings reload failed. Your draft and last confirmed state are retained.');
      }
    } finally {
      lock.current = false;
      if (mounted.current) { setPending(false); onBusyChange(false); }
    }
  }
  return <form aria-label="Manual checkout controls" className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); void execute(true); }}>
    <h3 className="font-semibold">Manual checkout controls</h3>
    {message && <p role="status">{message}</p>}
    <p>Last confirmed: EFT {state.confirmed.eft ? 'enabled' : 'disabled'}, PayShap {state.confirmed.payshap ? 'enabled' : 'disabled'}, {state.confirmed.minutes} minutes, R{state.confirmed.threshold} review threshold.</p>
    {state.conflict && <p role="alert">Server settings changed while you were editing. Your draft was retained. Review the latest settings before saving.</p>}
    <fieldset disabled={blocked || uncertain} className="flex flex-col gap-3">
      <label><input type="checkbox" name="eft" checked={state.draft.eft} onChange={e => edit('eft', e.target.checked)} /> EFT available for approved profiles</label>
      <label><input type="checkbox" name="payshap" checked={state.draft.payshap} onChange={e => edit('payshap', e.target.checked)} /> PayShap available for approved profiles</label>
      <label>Payment deadline (minutes)<input className="input" type="number" min="5" max="60" required value={state.draft.minutes} onChange={e => edit('minutes', e.target.value)} /></label>
      <label>Admin review threshold (ZAR)<input className="input" type="number" min="1" step="0.01" required value={state.draft.threshold} onChange={e => edit('threshold', e.target.value)} /></label>
      <label>Change reason<input className="input" required minLength={10} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
      <button className="btn-outline" type="submit" disabled={!dirty || uncertain || state.conflict || !!loadError || reason.trim().length < 10}>Save manual settings</button>
      {state.conflict && <button className="btn-outline" type="button" onClick={() => { setState(old => ({ ...old, draft: old.confirmed, conflict: false })); setReason(''); }}>Discard draft and use latest settings</button>}
    </fieldset>
    <button className="btn-outline" type="button" disabled={blocked} onClick={() => void execute(false)}>Reload settings (no save)</button>
    {!dirty && <p>No settings changes to save.</p>}
  </form>;
}
