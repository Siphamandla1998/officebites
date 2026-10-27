import fs from 'node:fs';
export const tables=['public.orders','public.order_suborders','public.order_items','public.vendors','private.vendor_legal_acceptances','private.vendor_legal_assignments','private.order_legal_acceptances','private.vendor_compliance_events','private.vendor_payment_profiles','private.manual_order_payments','private.manual_payment_events','private.manual_receivables','private.manual_receivable_entries'];
export async function digests(q){const rows=[];for(const table of tables)rows.push({table,...(await q(`SELECT count(*)::integer count,md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text,'[]')) digest FROM ${table} t`)).rows[0]});return rows;}
export async function containment({q,eq,reject,rootRole,as,guest,create,payload}){
 await as(null);const pending=await create(payload());
 await rootRole();const before=await digests(q);
 // A failed transaction cannot leave a half-installed/partly open release.
 await q('BEGIN');await q("UPDATE private.gateway_settings SET enabled=false WHERE provider='manual_eft'");
 await reject("SELECT 1/0",[],/division by zero/);await q('ROLLBACK');eq(await digests(q),before);
 const procedure=fs.readFileSync('checks/staging-forward-containment.sql','utf8').replace('REPLACE_WITH_APPROVED_INCIDENT_REFERENCE','SYNTHETIC approved containment drill');
 await q(procedure);
 const after=await digests(q);
 for(const prior of before)if(!['private.manual_payment_events'].includes(prior.table))eq(after.find(r=>r.table===prior.table),prior);
 eq((await q('SELECT bool_and(NOT enabled) closed FROM private.gateway_settings')).rows[0].closed,true);
 eq((await q('SELECT customer_legal_enabled preserved FROM private.commercial_settings')).rows[0].preserved,true);
 await as(null);await reject('SELECT public.create_order_with_legal($1,$2)',[JSON.stringify(payload()),'{}'],/unavailable|required|approved|acknowledgement/);
 eq((await q('SELECT public.get_order_legal_receipt($1,$2) r',[guest.id,guest.payment_token])).rows[0].r,guest.legalReceipt);
 eq((await q('SELECT public.get_manual_payment($1,$2) r',[pending.id,pending.payment_token])).rows[0].r.reference,pending.ticket_number);
 await q('SELECT public.report_manual_payment($1,$2)',[pending.id,pending.payment_token]);
 await as(1);eq((await q('SELECT public.verify_manual_payment($1,100,$2,false) r',[pending.id,'SYNTHETIC CONTAINMENT RECEIPT'])).rows[0].r,'paid');
 // Reopen ONLY this positively verified disposable fixture to finish unrelated
 // concurrency cases; this is not a hosted recovery instruction.
 await rootRole();await q("UPDATE private.commercial_settings SET legal_publication_enabled=true,vendor_clickwrap_enabled=true;UPDATE private.gateway_settings SET enabled=true WHERE provider IN('manual_eft','manual_payshap')");
 await as(1);
}
export async function snapshot({q,database,eq}){
 const rows=await digests(q);eq(rows.find(t=>t.table==='private.order_legal_acceptances').count>0,true);
 fs.writeFileSync('docs/release/staging-cold-restore-preimage.json',JSON.stringify({observedUtc:new Date().toISOString(),database,sourceDataDirectory:'.officebites-local/pg-release-owner-data',restoreDataDirectory:'.officebites-local/pg-staging-recovery-copy-20261027',restorePort:55442,syntheticOnly:true,tables:rows},null,2));
}
