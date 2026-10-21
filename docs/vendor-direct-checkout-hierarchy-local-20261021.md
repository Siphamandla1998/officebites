# Customer checkout payment hierarchy - local review

Branch: `feat/vendor-direct-launch-payments`. Local changes only; no commit, push, deployment, hosted user/order provisioning, settings changes or payment activation.

## Changes

- Payment section now presents only eligible PayShap and EFT / Bank Transfer radio cards. Backend `get_vendor_manual_methods` remains the authority for approved recipient support and gateway/vendor availability. PayShap defaults only when eligible; EFT is the fallback only when eligible; otherwise selection is null.
- Removed customer provider listing and Other Payment Methods accordion. No new gateway eligibility is inferred from provider flags. Provider code, historical reconciliation, records, admin settings and backend guards were not changed. Any future gateway needs a separately reviewed authorised, order-eligible backend contract before UI inclusion.
- Confirmed empty eligibility shows "Online ordering is temporarily unavailable.", explains preparation and saved cart, disables Place Order and offers Back to menu. Initial loading and API errors are distinct; errors offer Retry and show no stale radio cards. The order-creation handler and backend checks still fail closed.
- Selection is separate from the concise vendor-funds/payment/refund disclosure. A short next-step explanation leads into protected instructions after order creation. No banking data is placed in checkout.
- Removed support from selection. Payment instructions have Payment Help; tracking has Get Help with This Order. Existing Profile > Help & support navigation and `/support` redirect to `/help/contact` remain unchanged. No contact details invented.
- Existing protected destination snapshots, copy controls, report-only payment operation, independent verification, refund/dispute handling and fulfilment protections remain intact. Poppins styling preserved; radio cards have keyboard focus rings and full label targets.

## Exact files edited in this task

1. `src/pages/customer/Checkout.jsx`
2. `src/pages/customer/PaymentUpload.jsx`
3. `src/pages/customer/OrderTracking.jsx` - only the Link import and contextual help link added; pre-existing uncommitted ManualPaymentStatus import/render preserved.
4. `checks/browser-harness.jsx` - local deferred eligibility fixture added.
5. `checks/manual-payments-browser.spec.mjs` - hierarchy, empty/error/loading, keyboard/mobile and contextual support tests.
6. This report.

Unrelated existing working-tree changes remain unmodified. No shared styles, provider configuration, services, RLS, ledger or migration changes.

## Validation and evidence

Commands use the existing local Node runtime and installed Microsoft Edge. Browser harness is rebuilt before testing. `playwright test --grep-invert unmocked` excludes the pre-existing hosted-read smoke test; new and existing included cases use local synthetic services with Supabase traffic blocked.

Coverage: PayShap only, EFT only, both/default and keyboard selection, neither, unapproved profile, hidden gateways/accordion even with synthetic provider flags enabled, eligibility refresh, pending lookup, API failure/retry, support contexts and direct redirect/refresh, guest checkout, protected instructions, method-specific copying, report-versus-settlement and terminal-state safeguards, existing status/fulfilment/recovery tests.

Logs: `.officebites-local/payment-hierarchy-browser.log`, `payment-hierarchy-browser-build.log`, `payment-hierarchy-lint.log`, `payment-hierarchy-build.log`.

Screenshots: `.officebites-local/payment-hierarchy/` contains PayShap-only, EFT-only, both-eligible and neither-eligible states at 390 and 1440 pixels, using synthetic recipients/cart data only.

Executed results: **57 browser tests passed (3.6 minutes)**. After refining screenshot framing and adding an explicit Back to menu/cart-preservation assertion, **all four eligibility cases passed again (24.8 seconds)**. Lint passed with existing warnings; PWA build passed and generated service worker/precache (125 entries). Targeted whitespace checks passed. Mobile screenshots were visually inspected; payment options, empty-state navigation and concise disclosures are visible above the fixed order bar when scrolled into view. No shared-style changes were needed.

No native hosted payment/refund or staging UAT claim. Existing Preview remains unchanged; a separate approval is required to commit and deploy this redesign. HEAD remains `f69201a`; all changes here remain local for review.
