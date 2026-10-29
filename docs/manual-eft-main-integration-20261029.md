# Manual EFT restoration on current main — 2026-10-29

## Objective
Restore the vendor-direct manual EFT checkout journey while preserving the current `main` legal/admin work and all production records. This branch is based on current `main` commit `f1255479520c19c58493f52fd6124e0250d11457`, not on the older EFT branch.

## Evidence
- The EFT-capable branch `fix/single-admin-eft-checkout-oct28` was deployed to production at 10:21 SAST (commit `b22bf16dc97582be20f3a44b11520cd7ed7a08ac`).
- Later production deployments from `main` at 12:39 and 13:29 replaced it. Current `main` contains the older checkout UI that calls `create_order_from_cart`, while production's RPC intentionally rejects that legacy flow with “Refresh checkout to select an approved vendor-direct payment method”.
- Production configuration was read-only inspected: `manual_eft` is enabled/ready; PayFast is disabled and in maintenance; Ozow is disabled/not ready. Do not enable PayFast or Ozow as a workaround.
- The EFT branch has a separate `create_manual_order` path, vendor-approved method/profile checks, protected bank instructions, payment reporting and admin verification. These rely on database contracts/migrations that must be reconciled against production before any deployment.

## Integration guardrails
1. Preserve current `main` legal-document publishing, legal/admin navigation, current production protections and unrelated customer/vendor behavior.
2. Port the smallest coherent EFT UI/service/test set; do not merge the entire older EFT branch.
3. Do not apply the EFT branch's migration set wholesale. Production and staging migration histories differ; database changes require a separately reviewed, production-compatible migration package.
4. Do not modify production database rows, settings, RPCs, Edge Functions, payment/webhook configuration or deploy from this branch during integration.
5. Keep PayFast disabled. No fallback to a disabled gateway.
6. Keep the legacy `submit_payment_proof` rejection intact; it is not the new EFT workflow.

## Required verification before release
- Build/lint and focused browser/database contract tests on the integration branch.
- Guest and authenticated checkout.
- One-vendor and multi-vendor carts; only approved vendor profiles may expose instructions.
- Correct server-side order creation, payment deadline, request idempotency and guest access token.
- Protected instructions, payment reporting, admin verification, expiry/refresh behavior and no disabled-gateway fallback.
- Compare the candidate migration package to the live production schema and migration ledger; obtain explicit approval before applying any production migration.
- Preview/UAT evidence must be distinguished from genuine production payment evidence.

## Current status
This is a safe integration branch and audit checkpoint only. No production changes have been made. Do not merge or deploy until the code port, test results, and database compatibility review are complete.
