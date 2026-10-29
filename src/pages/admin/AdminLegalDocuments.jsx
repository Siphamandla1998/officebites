import { useMemo, useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { commercialService } from '../../services/commercialService';
import { useAuth } from '../../context/AuthContext';

const KINDS = [
  ['terms', 'Customer Terms and Conditions'],
  ['privacy', 'Privacy Notice (POPIA)'],
  ['refund-policy', 'Refund and Cancellation Policy'],
  ['vendor-agreement', 'Vendor Marketplace Agreement'],
  ['vendor-fees', 'Vendor Fees Schedule'],
];
const VERSION = '1.1-2026-10-29';
const EFFECTIVE_AT = '2026-10-29T00:00:00+02:00';
const ADDRESS = 'Eduvos Building, 1 Lunar Row, Umhlanga, KwaZulu-Natal, 4319, South Africa';

function correctedContent(kind, raw) {
  let text = raw
    .replaceAll(' — DRAFT', '')
    .replace('Version 1.0-draft-2026-10-29. Not approved for publication.', `Version ${VERSION}. Effective 29 October 2026.`)
    .replaceAll('Officebites PTY LTD', 'OFFICEBITES (PTY) LTD')
    .replaceAll('K2026677349', '2026 / 677349 / 07')
    .replaceAll('0733716062', '073 731 6062')
    .replaceAll('[COMPLETE BEFORE APPROVAL]', ADDRESS)
    .replaceAll('[CONFIRM BEFORE APPROVAL]', 'Siphamandla Khumalo — officebites4@gmail.com; 073 731 6062');

  const replacements = {
    privacy: [
      ['Before approval, OfficeBites must verify the live provider list, countries and safeguards for cross-border transfers under POPIA.',
       'Technical providers include Vercel (application hosting and deployment), Supabase (database, authentication and storage), and payment providers selected at checkout such as PayFast and Ozow when enabled. Email and communications providers may also process contact and support messages. These providers may process or store information outside South Africa; OfficeBites will apply appropriate contractual and technical safeguards for cross-border transfers as required by POPIA, including section 72 where applicable.'],
      ['The live analytics/cookie inventory and retention schedule must be confirmed before publication. This notice must be updated when practices materially change.',
       'OfficeBites uses essential browser storage for authentication, security, preferences and core application functionality. Any non-essential analytics or advertising technology introduced in future will be disclosed and handled in accordance with applicable law. This notice will be updated when processing practices materially change.'],
    ],
    terms: [
      ['Before approval, complete the registered business address and confirm the live support, delivery, cancellation and payment processes.',
       'The checkout quote and order confirmation record the applicable delivery or collection details, charges and payment method for each order. These terms are effective from 29 October 2026 and may be updated in a new version when practices materially change.'],
    ],
    'refund-policy': [
      ['Before approval, align this policy with actual cancellation controls, vendor contracts, support operations and applicable consumer-law requirements.',
       'This policy must be read consistently with the applicable vendor obligations and South African consumer law. It does not guarantee a refund outcome or processing time where the facts, payment method or bank processing prevent that guarantee.'],
    ],
    'vendor-agreement': [
      ['Complete party addresses and confirm the operational fee, refund, food-safety and dispute processes before approval and publication.',
       'The Vendor must provide and maintain accurate business, contact, receiving-account and any legally required registration or licence details during onboarding. This Agreement is effective from 29 October 2026 and is subject to mandatory South African law.'],
    ],
    'vendor-fees': [
      ['Confirm the exact net-subtotal definition, weekly window, discount/refund treatment, invoice process and tax status before approval.',
       'The qualifying week runs Monday 00:00 through Sunday 23:59:59 in Africa/Johannesburg time. Positions are counted per active agreement and vendor: positions 1–49 at 5%, 50–99 at 7.5%, and position 100 onward at 10%. Eligible net product subtotal excludes delivery; discounts reduce the eligible subtotal. Refund credits and disputes are handled through recorded ledger adjustments. Acquisition fees remain disabled unless the separate agreement is accepted, the feature is enabled and all eligibility checks pass.'],
    ],
  };
  for (const [before, after] of (replacements[kind] || [])) text = text.replace(before, after);
  return text;
}

function latestByKind(documents = []) {
  const map = {};
  for (const doc of documents) {
    if (!map[doc.kind] || new Date(doc.created_at) > new Date(map[doc.kind].created_at)) map[doc.kind] = doc;
  }
  return map;
}

export default function AdminLegalDocuments() {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useAsync(() => commercialService.workspace(), [user?.id], null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [reference, setReference] = useState('Director publication approval recorded 2026-10-29; independent external legal review is not represented.');
  const latest = useMemo(() => latestByKind(data?.documents || []), [data?.documents]);
  const prepared = KINDS.filter(([kind]) => latest[kind]?.version === VERSION);
  const allPrepared = prepared.length === KINDS.length;
  const allPublished = allPrepared && KINDS.every(([kind]) => Boolean(latest[kind]?.approved_at));

  async function prepare() {
    setBusy(true); setNotice('');
    try {
      let created = 0;
      for (const [kind, label] of KINDS) {
        if (latest[kind]?.version === VERSION) continue;
        const source = latest[kind];
        if (!source?.content) throw new Error(`Cannot find source content for ${kind}; no document was changed after this point.`);
        const title = label === 'Customer Terms and Conditions' ? 'OfficeBites Customer Terms and Conditions'
          : label === 'Privacy Notice (POPIA)' ? 'OfficeBites Privacy Notice (POPIA)'
          : label === 'Refund and Cancellation Policy' ? 'OfficeBites Refund and Cancellation Policy'
          : label === 'Vendor Marketplace Agreement' ? 'OfficeBites Vendor Marketplace Agreement'
          : 'OfficeBites Vendor Fees Schedule';
        await commercialService.action('document', {
          kind, version: VERSION, title,
          content: correctedContent(kind, source.content),
          effective_at: EFFECTIVE_AT,
        });
        created += 1;
      }
      setNotice(`Prepared ${created} new immutable version(s). Review the full text below before publishing.`);
      await refetch();
    } catch (e) {
      setNotice(`Preparation stopped: ${e.message}. Check the version list before retrying; earlier successful appends remain preserved.`);
      await refetch();
    } finally { setBusy(false); }
  }

  async function publish() {
    if (reference.trim().length < 10) { setNotice('Enter a publication approval reference of at least 10 characters.'); return; }
    setBusy(true); setNotice('');
    try {
      let count = 0;
      const docs = latestByKind(data?.documents || []);
      for (const [kind] of KINDS) {
        const doc = docs[kind];
        if (!doc || doc.version !== VERSION) throw new Error(`The corrected ${kind} version is missing. Prepare all five first.`);
        if (doc.approved_at) continue;
        await commercialService.action('approve_document', { id: doc.id, approvalReference: reference.trim() });
        count += 1;
      }
      setNotice(`Published ${count} document(s). Checking the public legal portal…`);
      await refetch();
      const portal = await commercialService.portal();
      const missing = KINDS.filter(([kind]) => !portal?.documents?.[kind]).map(([,label]) => label);
      setNotice(missing.length ? `Publication returned, but the public portal is missing: ${missing.join(', ')}. Do not treat this as complete.` : 'All five approved documents are now returned by the public legal portal.');
    } catch (e) {
      setNotice(`Publishing stopped: ${e.message}. Check which documents are already approved before retrying.`);
      await refetch();
    } finally { setBusy(false); }
  }

  if (loading) return <p role="status">Loading legal workspace…</p>;
  if (error) return <div role="alert">{error.message} <button onClick={() => refetch()}>Retry</button></div>;
  if (!data?.admin) return <p role="alert">Administrator access is required.</p>;

  return <div className="ob-container py-6 space-y-5">
    <h1 className="text-2xl font-bold">Legal documents — publication</h1>
    <p className="card p-4">This workflow appends immutable versions and uses the existing administrator action/audit path. It does not activate vendor-consent enforcement, payment changes, or acquisition charging. The reference below records director publication approval; it does not claim that an external lawyer reviewed the documents.</p>
    {notice && <p role="status" className="card p-3">{notice}</p>}
    <section className="card p-4 space-y-3">
      <h2 className="font-semibold">1. Prepare corrected versions</h2>
      <p>Creates version {VERSION} from the current drafts, correcting the registered identity, address, Information Officer and contact details, and removing draft-only text. Existing versions remain unchanged.</p>
      <button className="btn-primary" disabled={busy || allPrepared} onClick={prepare}>{allPrepared ? 'Corrected versions prepared' : 'Prepare all five corrected versions'}</button>
    </section>
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Document review</h2>
      {KINDS.map(([kind, label]) => {
        const doc = latest[kind];
        return <details className="card p-4" key={kind}>
          <summary className="cursor-pointer font-semibold">{label} · {doc?.version || 'Missing'} · {doc?.approved_at ? 'Published' : 'Unpublished'}</summary>
          {doc && <><p className="text-sm break-all">ID {doc.id} · SHA-256 {doc.content_hash}</p><pre className="whitespace-pre-wrap break-words text-sm">{doc.content}</pre></>}
        </details>;
      })}
    </section>
    <section className="card p-4 space-y-3">
      <h2 className="font-semibold">2. Publish the corrected versions</h2>
      <label className="block text-sm">Publication approval reference
        <input className="input w-full block border rounded p-2" value={reference} onChange={e => setReference(e.target.value)} />
      </label>
      <p className="text-sm">This records the director's approval instruction and explicitly does not represent independent legal-counsel review. Publishing is append-only; it does not delete or rewrite prior versions.</p>
      <button className="btn-primary" disabled={busy || !allPrepared || allPublished} onClick={publish}>{allPublished ? 'All five documents published' : 'Publish all five corrected documents'}</button>
    </section>
    <p className="text-sm"><a className="underline" href="/terms">Customer terms</a> · <a className="underline" href="/privacy">Privacy notice</a> · <a className="underline" href="/refund-policy">Refund policy</a> · <a className="underline" href="/vendor-agreement">Vendor agreement</a> · <a className="underline" href="/vendor-fees">Vendor fees</a></p>
  </div>;
}
