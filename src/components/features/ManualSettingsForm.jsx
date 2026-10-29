import { useEffect, useRef, useState } from 'react';
import { manualPaymentService } from '../../services/manualPaymentService';
import { manualSettingsError } from '../../utils/manualSettingsError';

const values = s => ({ eft: !!s.eft_enabled, payshap: !!s.payshap_enabled, minutes: String(s.deadline_minutes), threshold: String(s.review_threshold), revision: s.settings_revision });
const equal = (a, b) => a.eft === b.eft && a.payshap === b.payshap && Number(a.minutes) === Number(b.minutes) && Number(a.threshold) === Number(b.threshold);
const sameVersion = (a, b) => equal(a,b) && a.revision === b.revision;

export default function ManualSettingsForm({ settings, loading, loadError, reload, onBusyChange }) {
  const [state, setState] = useState(() => ({ confirmed: values(settings), draft: values(settings), conflict: false }));
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  const lock = useRef(false);
  const savedAwaitingReload = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update); window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  useEffect(() => {
    if (loading || loadError || lock.current) return;
    const next = values(settings);
    setState(old => sameVersion(next, old.confirmed) ? old : {
      confirmed: next,
      draft: equal(old.draft, old.confirmed) ? next : old.draft,
      conflict: !equal(old.draft, old.confirmed),
    });
  }, [settings, loading, loadError]);
  const dirty = !equal(state.draft, state.confirmed);
  const blocked = pending || loading;
  const edit = (key, value) => setState(old => ({ ...old, draft: { ...old.draft, [key]: value } }));
  async function execute(save) {
    if (lock.current || loading || (save && (!navigator.onLine || !state.confirmed.revision || !dirty || uncertain || state.conflict || loadError || reason.trim().length < 10))) return;
    lock.current = true; setPending(true); onBusyChange(true); setMessage('');
    let committed = false;
    try {
      if (save) {
        await manualPaymentService.settings(state.draft.eft, state.draft.payshap, state.draft.minutes, state.draft.threshold, reason, state.confirmed.revision);
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
        conflict: old.conflict || (!sameVersion(next, old.confirmed) && !equal(old.draft, old.confirmed)),
      });
      savedAwaitingReload.current = false;
      setUncertain(false);
      setMessage(save ? 'Save and reload succeeded.' : 'Settings reloaded. No save was sent.');
    } catch (failure) {
      if (mounted.current) {
        // A transport error cannot prove that a mutation was rolled back.
        if (save) setUncertain(true);
        setMessage(committed ? 'Save succeeded but settings reload failed. Reload settings before making another change.' : save ? `Save failed or its outcome could not be confirmed. ${manualSettingsError(failure)}` : 'Settings reload failed. Your draft and last confirmed state are retained.');
      }
    } finally {
      lock.current = false;
      if (mounted.current) { setPending(false); onBusyChange(false); }
    }
  }
  return <form aria-label="Manual checkout controls" className="flex flex-col gap-3" onSubmit={event => { event.preventDefault(); void execute(true); }}>
    <h3 className="font-semibold">Manual checkout controls</h3>
    {!online && <p role="alert">Offline. Reconnect and reload settings before saving.</p>}
    {!state.confirmed.revision && <p role="alert">The reviewed settings update is not installed. Settings remain read-only until the backend release is reviewed and installed.</p>}
    {message && <p role="status">{message}</p>}
    <p>Last confirmed: EFT {state.confirmed.eft ? 'enabled' : 'disabled'}, PayShap {state.confirmed.payshap ? 'enabled' : 'disabled'}, {state.confirmed.minutes} minutes, R{state.confirmed.threshold} review threshold.</p>
    <p>Enabling a method does not approve a vendor or create banking details. Checkout also requires an approved vendor and an independently verified payment profile.</p>
    {state.conflict && <p role="alert">Server settings changed while you were editing. Your draft was retained. Review the latest settings before saving.</p>}
    <fieldset disabled={blocked || uncertain} className="flex flex-col gap-3">
      <label><input type="checkbox" name="eft" checked={state.draft.eft} onChange={e => edit('eft', e.target.checked)} /> EFT available for approved profiles</label>
      <label><input type="checkbox" name="payshap" checked={state.draft.payshap} onChange={e => edit('payshap', e.target.checked)} /> PayShap available for approved profiles</label>
      <label>Payment deadline (minutes)<input className="input" type="number" min="5" max="60" required value={state.draft.minutes} onChange={e => edit('minutes', e.target.value)} /></label>
      <label>Admin review threshold (ZAR)<input className="input" type="number" min="1" step="0.01" required value={state.draft.threshold} onChange={e => edit('threshold', e.target.value)} /></label>
      <label>Change reason<input className="input" required minLength={10} maxLength={500} placeholder="e.g. Enable EFT for verified vendor profiles" value={reason} onChange={e => setReason(e.target.value)} /></label>
      <p className="text-sm" role="status">
        {reason.trim().length < 10
          ? `Enter a reason of at least 10 characters (${reason.trim().length}/10).`
          : !state.confirmed.revision
            ? 'Reload settings: the server revision is missing.'
            : !dirty
              ? 'Change a setting before saving.'
              : uncertain
                ? 'Reload settings to confirm the outcome of the previous save.'
                : state.conflict
                  ? 'Settings changed on the server. Review the latest settings before saving.'
                  : loadError
                    ? 'Settings could not be confirmed. Reload before saving.'
                    : !online
                      ? 'Reconnect to the internet before saving.'
                      : 'Ready to save. The change will be recorded in the audit history.'}
      </p>
      <button className="btn-outline" type="submit" disabled={!online || !state.confirmed.revision || !dirty || uncertain || state.conflict || !!loadError || reason.trim().length < 10}>Save manual settings</button>
      {state.conflict && <button className="btn-outline" type="button" onClick={() => { setState(old => ({ ...old, draft: old.confirmed, conflict: false })); setReason(''); }}>Discard draft and use latest settings</button>}
    </fieldset>
    <button className="btn-outline" type="button" disabled={blocked} onClick={() => void execute(false)}>Reload settings (no save)</button>
    {!dirty && <p>No settings changes to save.</p>}
  </form>;
}
