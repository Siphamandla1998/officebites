# OfficeBites legal approval checklist

Review date: 16 October 2026. Status: **not legally approved; publication and commercial activation blocked**.

This is an engineering-to-legal handover, not a legal opinion. Obtain owner approval and appropriate South African professional review of the final documents and actual operating processes. Check applicable ECTA/CPA exceptions for perishable food rather than promising or denying a blanket cancellation right.

## Entity and disclosures

- [ ] Verify the supplied entity name Officebites PTY LTD and enterprise number K2026677349 against registration evidence, including place of registration and applicable office-bearer disclosures. Siphamandla Khumalo is recorded as owner/beneficiary; this does not establish a statutory office.
- [ ] Supply principal business and legal-notice addresses and confirm support email/telephone.
- [ ] Establish VAT registration status, whether published prices include VAT, invoice requirements and treatment of commission, transaction charges, acquisition charges and refunds. Do not invent a VAT number or assume registration.
- [ ] Identify the Information Officer, contact and registration evidence; review PAIA obligations and complaint channels.

## Document-by-document approval

| Route | Required review against actual implementation | Current status |
| --- | --- | --- |
| `/terms` | Marketplace/vendor responsibilities, food supply, prices including delivery/tax, payment security, order review/correction, availability, delivery, cancellation, dispute resolution, accessible transaction records | No published version; do not interpret the unpublished notice as accepted terms |
| `/privacy` | Responsible party, processing purposes/lawful grounds, account/location/chat/support/payment metadata, recipients/operators, international transfers, retention, security and breach process, access/correction/objection and Regulator complaints | No published version; Information Officer and addresses missing |
| `/refund-policy` | Eligibility, perishable-food exceptions, support evidence, provider-confirmed refunds, partial refunds, delivery allocation, timelines the operations team can meet, escalation | No published version; refund execution/settlement incomplete |
| `/vendor-agreement` | Vendor approval/suspension, food safety/fulfilment, account retention, immutable consent, corporate membership attribution, term/expiry, dispute handling, settlement obligations | No published version; corporate acceptance cannot activate charging |
| `/vendor-fees` | Standard 15% + 2% within 17%, legitimate negotiated rates, acquisition bands, SAST week/eligibility, refunds without reusing positions, payout deductions/negative balances, VAT/provider expenses | No published version; final tax and settlement terms missing |

## Statements that require reconciliation

- [ ] Retired `src/pages/help/RefundPolicy.jsx` still contains 1–2-day review and 3–5-day refund promises. It is redirected away from the published policy routes; do not republish that component without operational/legal approval.
- [ ] Do not claim automated refunds, completed corporate payout reconciliation, guaranteed delivery, enabled distance enforcement, active Ozow or recurring billing: these are not established by this implementation.
- [ ] Resolve meal-specific ordering cutoffs. Owner permits advance ordering until 13:00 SAST the previous day and some same-day ordering; the same-day closing time remains unspecified. Current code still uses the legacy global 19:00 previous-day rule.
- [ ] Approve whether refunded corporate orders keep consumed tier positions, how post-expiry fulfilment is treated, negotiated terms, vendor-funded discounts, disputes and already-paid payout recovery.
- [ ] Confirm statutory retention and financial-history obligations before enabling any purge; retention remains disabled.

## Publication and acceptance evidence

- [ ] Owner and reviewer approve each exact document version/content hash, effective date and approval reference; an admin-entered reference alone is not proof of professional approval.
- [ ] Verify all five documents, cross-links, mobile rendering, print/save-PDF and public access against final content.
- [ ] Verify all eight acknowledgements are initially unchecked; demonstrate actual signup/upgrade acceptance, retained version/hash and existing-vendor reacceptance rules.
- [ ] Verify support/privacy contact procedures operationally before publication.
- [ ] Release charging only after refund, payout, independent-session concurrency and gateway verification pass; keep hard activation constraints in place until a reviewed corrective release.

Primary review references: [ECTA, official government index](https://www.gov.za/documents/electronic-communications-and-transactions-act), [Information Regulator POPIA guidance](https://inforegulator.org.za/popia/), [Regulator section 18 privacy-notice example](https://inforegulator.org.za/privacy-notice/). Applicability and final wording require professional review.
