# OB-UAT-20261020 execution handoff

Status: blocked at provisioning prerequisites. No hosted writes or checkout tests performed.

## Verified checkpoint

- Branch `feat/vendor-direct-launch-payments`.
- Supabase project `eyhmarmekioovcjibcbr`: officebites-staging, ACTIVE_HEALTHY; latest migration `20261020100740`.
- All four methods disabled. PayFast/Ozow maintenance on; manual EFT/PayShap ready with maintenance off.
- Proposed run accounts: 0; manual profiles: 0; manual orders: 0.
- Historical counts: orders 15; PayFast log 4; Ozow attempts/receipts 0. These are count checks, not a new full content comparison.
- Existing Preview unchanged: `dpl_Ftm1F2a6Ja9vT24eKtpRVaK4HVr6`, READY, Preview target; https://officebites-dd7kth3is-sp24tg-6983s-projects.vercel.app/. Earlier served-bundle staging isolation evidence remains applicable; no authenticated URL-fetch helper was used.
- Production alias remains on `dpl_9mWoxNCL9NqX7DHKAUy7NCfBWGnt`, timestamp `1792492251782`, unchanged from the investigated checkpoint.

## Blocking conditions

1. No supported Auth user-provisioning operation is exposed by the connected Supabase tools. Local environment files expose only URL/publishable-key variable names; no staging server credential is configured. No values were printed. Do not manufacture auth.users rows, bypass confirmation through public signup, or retrieve production credentials to work around this.
2. Current Vercel project metadata reports passwordProtection, ssoProtection and trustedIps disabled. No independent staging access restriction was verified. This does not prove an unrestricted request succeeds, but it fails the approval's requirement to verify restricted access before activation. No protection configuration change is authorised by this execution approval.
3. External-notification suppression and an operator-controlled guest contact were not fully established. Source inspection found in-app notifications and Auth email flows; absence of an outbound messaging path was not proved across hosted hooks/configuration. No accounts, messages or checkout requests were created.

## Fixture manifest

No generated IDs exist because provisioning did not begin. Planned identities remain vendor-a, vendor-b, customer and admin at `officebites-uat.invalid`; two synthetic storefronts; two R70 meals; A1/A2/B1 destination versions. Do not mistake these labels for existing users or approved profiles. Existing suspended synthetic identities were left untouched.

## Individual test outcomes

| Scenario | Result |
| --- | --- |
| Guest EFT checkout | Not run |
| Guest PayShap checkout | Not run |
| Customer report without confirmation | Not run |
| Simulated vendor verification | Not run |
| Immutable snapshots on profile change | Not run |
| Unapproved destination rejection | Not run |
| Wrong-vendor/unauthorised access | Not run against hosted fixtures |
| Guest-token protection | Not run against hosted fixtures |
| Expiry/cancellation | Not run |
| Under/overpayment and duplicate references | Not run |
| R560 independent admin review | Not run |
| Disputes/refunds/fulfilment/idempotency | Not run |

No hosted fixture RLS result or commission reconciliation is claimed. The required 15% platform plus 2% transaction-related commission (17% total) remains a hosted acceptance criterion, including R11.90 on R70 product value and R95.20 on R560 product value, subject to the actual approved commission snapshot and product/refund basis. A mismatch must stop processing, not be silently corrected by editing global policy.

## Closeout

No activation occurred, so no disabling write was required. All four methods were read and confirmed disabled. No test storefronts/meals/sessions exist to archive or revoke. Immutable financial history was not modified. No funds moved through this execution; no banking app, payment provider or external payment request was invoked. No production write, deployment, alias change, environment update or share-link operation was requested or performed.

## Operator prerequisites and manual browser UAT

1. Provide a supported server-side staging Auth administration path through an approved integration or operator execution; do not paste server secrets into chat or browser code. Provision confirmed synthetic users without invitations/emails and retain generated IDs securely. Establish the narrowly scoped admin role, and verify actual permissions.
2. Independently verify staging access restrictions, including the guest checkout API rather than just the Preview page. If a protection change is needed, obtain separate approval for its exact scope. The existing restriction condition cannot be waived by assuming an obscure URL is private.
3. Confirm hosted Auth hooks/webhooks/notification configuration cannot contact real recipients; choose an operator-controlled guest contact. Resolve this before creating fixtures.
4. Use the exact existing Preview URL in a normal browser. Never use the authenticated URL-fetch helper, Share controls or bypass query parameters. Use existing authorised Vercel identity access if required; stop if access is denied.
5. Use separate browser profiles for Vendor A, Vendor B, customer and admin, and a private session for guests. Confirm requests target only `eyhmarmekioovcjibcbr.supabase.co` before login or checkout.
6. Complete every Phase 1 checkpoint with payments disabled. Vendor submission plus a different admin's synthetic-only approval is required. Leave A2 pending until the snapshot test and B1 unapproved.
7. Only after verified access restriction and all checkpoints pass, use the approved admin_manual_settings RPC for the bounded manual-only window. Re-read all four method states immediately.
8. Follow the approved scenario order, at most 12 orders. Classify each immediately through the versioned preview/classification procedures before verification, fulfilment or accrual. Preserve guest tokens privately. Stop processing an order if classification fails.
9. Treat every receipt/refund/commission collection as simulated evidence. Check RLS using real separate sessions, commission components and idempotency, and test-only reporting. Do not invoke actual banking or fabricate historical provider callbacks.
10. Disable both manual methods, verify all four disabled, archive/suspend fixtures, mark meals unavailable, revoke supported Auth sessions and preserve the ID manifest and immutable history. Recheck production metadata read-only.

Existing approval remains subject to its conditions; no request to reapprove already authorised fixture/test operations is implied. Access-control configuration changes require their own scope. Production readiness, real onboarding/legal sign-off and device/manual acceptance remain outstanding.
