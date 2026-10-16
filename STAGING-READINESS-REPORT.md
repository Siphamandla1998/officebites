# Staging readiness — 16 October 2026

Repository origin is Siphamandla1998/officebites. Starting local main was f5db4af; fetched origin/main is `4c4835db62b7db4c7a725c92d7a6294ca523fa57`. The working tree started clean. Feature branch `feat/checkout-ozow-distance-admin-controls` starts at verified origin/main. Production-recovery points to that same commit; audit-cleanup is an older unmerged branch. No branch newer than current main was found. No reset, main push, merge or production deployment is authorized for this work.

## Actual staging inspection

Project `eyhmarmekioovcjibcbr`, officebites-staging, is ACTIVE_HEALTHY, PostgreSQL 17.6.1.166. No customer rows were copied from live.

History now includes October 10 catalog/identity prerequisites, order/chat alignment, scoped names, atomic support/feedback, financial ledger, account security and production-audit cleanup. This differs from the October 8 staging failure. Actual columns, enums, function bodies/arguments/ACLs, public/Storage policies, triggers, indexes and table grants were captured read-only in session memory, rather than trusting names alone. Staging includes 22 public tables, financial/private helpers, payment preparation, audit cleanup and receipt-reporting RPCs. Messages and notifications are published to Realtime. Retention is disabled. Authenticated users cannot update order or suborder status directly; anonymous users cannot insert orders directly.

Existing Edge Functions: payfast-initiate v18 (uses prepare_payfast_order), payfast-notify v18, admin-account-removal v1. The main repository's older initiation code directly updated orders; the feature reconciles this with the staged RPC preparation behavior rather than overwriting backend functions with the old main implementation. PayFast signature encoding and notify verification remain preserved.

The actual staging financial/cleanup function definitions still need to be reconciled into repository history before any blanket CLI push. Old migration filenames have known differing installed timestamps and staging-specific prerequisites. Only the reviewed new feature migration may be applied; do not replay historical migrations.

## Environment isolation

An ignored `.env.staging.local` contains ONLY staging's project URL and enabled public publishable key. Existing `.env.local` was preserved; it targets live, so do not use default dev mode for hosted staging checks. Use `npm run dev -- --mode staging` / `npm run build -- --mode staging`. No service credential belongs in frontend configuration. Vercel's preview URL variable was inspected read-only and points to staging, not live. Production environment/settings were not changed. Hosted preview build/auth/browser flows still require separate evidence.

## Baseline and blockers

Locked dependency installation passed (442 packages). Existing local regression suite passed on current main. Initial lint/build attempts overlapped the still-running npm install and could not find tools; after installation, lint/build passed. Deno's default local npm resolution conflicted with the unpinned JSR SDK; isolated `--node-modules-dir=none --no-lock` checking avoids modifying application dependencies. See TEST-RESULTS.md for final results.

Remaining blockers: Ozow merchant One API staging access/client/site/scope/signing secret and webhook registration; complete owner delivery policy (coordinate supplied, “10 KM” alone does not define both radii/fee); hosted disposable Auth/Storage tests; native concurrent confirmation/cancellation testing; PWA upgrade/mobile permission testing. Delivery enforcement and Ozow remain disabled by default. No staging or production readiness is claimed from mocked or PGlite results.
