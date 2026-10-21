# Admin settings UI final review — 21 October 2026

Branch `feat/vendor-direct-launch-payments`; HEAD `bb074addb7f9a348f72f6946dfdef32580044083`. No staging, commit, push, deployment, hosted inspection or hosted write performed. Existing unrelated working-tree changes preserved.

## Findings

1. **Commit scope prerequisite:** `ManualPaymentWorkspace.jsx` is untracked at HEAD, despite being in the verified Preview source. `AdminPayments.jsx` has the uncommitted import/render required to expose it. A safety-only patch cannot be presented as a standalone working commit against HEAD without first recording this prerequisite. Do not silently stage the whole workspace as if all of its payment/profile/refund/statement functionality were new safety work.
2. **Test harness defect corrected during review:** the unconditional `orderService.getRecentPayments = async () => []` stub introduced by the safety task suppressed the existing verified-receipt fixture. The expanded checkout regression found the failure. Removed the unnecessary stub; production service code unchanged. The final rerun is recorded below.
3. **No new application blocker found in the reviewed save/reload paths.** A synchronous local lock prevents concurrent mutations in the mounted form, the disabled fieldset locks edits during save/reload, and unchanged values cannot submit. Reload-only actions never mutate. Backend concurrency/idempotency/interlock protection is still absent and remains a separately approved design.

## Behaviour and compatibility

- The service call still sends only `p_eft`, `p_payshap`, `p_minutes`, `p_threshold`, `p_reason` to `admin_manual_settings`; numeric conversion remains in the existing service. A successful void/204 response is accepted. No backend signature, SQL, grant or migration changed. Reason max length 500 matches the existing downstream notice cap.
- Automatic reason clearing occurs after the mutation promise resolves successfully, before reload. Mutation failure retains reason/draft and requires reconciliation. Explicit **Discard draft and use latest settings** also deliberately clears the reason; that is a user action rather than a claim of save success. Full navigation/remount is not durable draft storage.
- Confirmed server values and local draft remain separate. Failed reads retain both. Changed server values preserve dirty edits, show a conflict and block save; repeated reads do not remove the conflict. A successful post-save reconciliation adopts the actual returned values, which may include another admin's later change. It cannot prove global concurrency safety.
- The form displays separate messages for unconfirmed/failed save, committed save with failed read, and successful save plus reload. No mutation retry loop exists.
- Workspace comparison against verified deployed source is only the new form import and replacement of the old inline settings form: two inserted lines, twelve removed lines. No eligibility, commission, profile, refund or payment-state logic changed by this safety patch. Existing gateway enable/disable RPC semantics are preserved; no new activation permission is granted.
- Current frontend tests run in the complete existing working tree, which includes earlier unrelated work. They do not prove that an arbitrarily selected subset is a self-contained release artifact. After scope approval and prerequisite capture, verify the isolated commit candidate before any release.

## Accessibility and layout

New local checks at 390px and 1440px verify associated field labels, named form, focusable save button, keyboard Enter submission, all inputs/buttons within viewport bounds and no horizontal overflow. Status uses `role=status`; conflicts use `role=alert`. Save/reload and disabled states retain native button/fieldset semantics. Screenshots were visually inspected: labels wrap, number/reason fields and action buttons remain readable; visible focus ring retained. Capture was adjusted to avoid the fixed admin header covering the heading.

Evidence: `.officebites-local/admin-settings-review/form-390.png` and `form-1440.png`. This is a focused keyboard/layout review, not a screen-reader or WCAG conformance certification.

## Exact recommended commit scope

First record the existing workspace as an explicitly reviewed prerequisite, in a separate commit:

1. `src/components/features/ManualPaymentWorkspace.jsx` — **pre-safeguard deployed version**, not current file. Verified retained source: `.officebites-local/hierarchy-preview-20261021/source/src/components/features/ManualPaymentWorkspace.jsx`; SHA-256 `adfbcda8344b1a285b456437eaf2a941e63fe7a201a372c09882f75808d3123c`, rechecked against release manifest.
2. `src/pages/admin/AdminPayments.jsx` — only the existing two added import/render lines.

Then the narrowly scoped safety commit includes exactly:

1. `src/components/features/ManualSettingsForm.jsx` — new component.
2. `src/components/features/ManualPaymentWorkspace.jsx` — only safety import/form-replacement diff against the prerequisite version.
3. `checks/browser-harness.jsx` — synthetic settings/deferred read/write fixtures, excluding the removed recent-payments stub.
4. `checks/admin-settings-browser.spec.mjs` — eight focused cases, including keyboard/mobile/desktop captures.
5. `playwright.config.mjs` — register the focused spec only.
6. `docs/admin-payment-settings-safety-design-20261021.md` — design and existing validation evidence; no backend implementation.
7. This review document.

Proposed safety commit message: `fix(admin): guard manual payment settings saves and reloads`.

Proposed prerequisite message: `chore(admin): record existing vendor-direct payment workspace`.

Exclude all other tracked/untracked work: the active `OFFICEBITES-PREVIEW-RELEASE-20261016.md`, cart/checkout-control changes, other existing checkout/recovery test edits, vendor page integrations, OrderTracking/ManualPaymentStatus changes, SQL migrations/DB checks, security/UAT tooling, marketplace/launch/legal/other reports, generated builds/logs/screenshots and environment/configuration secrets. No migration should enter either commit. No index entries have been changed in this review.

## Validation

Local synthetic browser command: `node node_modules/@playwright/test/cli.js test admin-settings-browser.spec.mjs manual-payments-browser.spec.mjs checkout-browser.spec.mjs --grep-invert unmocked`, using installed Edge. Hosted Supabase traffic is aborted; hosted-read smoke tests excluded. Log: `.officebites-local/admin-settings-review-browser.log`.

Browser harness rebuilt after the test-fixture correction. Lint passed with existing warnings only (`.officebites-local/admin-settings-review-lint.log`). The previously passed PWA build remains applicable to unchanged application source; only test/review files changed during this review. Targeted tracked whitespace checks passed. No production or hosted database/configuration change is required for these UI safeguards; exposing them in a Preview would require separate deployment approval.

Final rerun: **46 passed (2.9 minutes)** — eight focused admin-settings cases, 19 existing checkout cases and 19 existing manual-payment cases. The earlier verified-receipt fixture failure is resolved. No test failure remains in these executed suites. Server-side version/idempotency/activation protections and the Git prerequisite/scope issue remain explicit limitations, not browser-test failures.
