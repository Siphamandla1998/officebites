# Exact document and existing-vendor handoff

The owner stated: **“I approve all the terms and conditions we creaed”**. The local
approval record and hashes of the six available policy files are in
`OWNER-APPROVAL-RECORD.json`. That instruction is preserved; no further broad approval
is being requested. The current task still expressly prohibits publication.

The available texts are under
`checks/reference-regressions/docs/legal-implementation/policies/`: Terms_Revision_A,
Privacy_Revision_A, Refunds_Revision_A, Delivery_Revision_B, Cookies_Revision_B and
Company_Information_Revision_B. They still contain working-draft notices and/or
unverified disclosure fields. The manifest identifies their exact bytes and blocker
line numbers; it does not declare missing facts verified. No text was copied into
the application bundle, seeded as an approved version or stripped of required POPIA
disclosures to make publication pass.

| Included release capability | Content / owner action still needed |
|---|---|
| Terms, Privacy, Refunds routes and concise labels; six-document versioned publication | Complete verified CIPC/service-address/office-bearer/Information Officer, retention/transfers, tax and actual capability details; then freeze final hashes/version metadata |
| Vendor review, unchecked authority declaration, Accept & Continue, immutable assigned acceptance | Actual complete Vendor Agreement and Operating Standards source files are not present in this release's policy-text set; supply the intended existing approved sources |
| Vendor-specific Commercial Fee Schedule assignment | Supply SHE COOKS BY SNE's actual schedule/scope/sign-off; never use synthetic fixtures or a global schedule |
| 15% + 2% accepted-fee snapshot, no repricing after instruction creation | VAT registration/effective date, invoicing and component-rounding/accounting treatment remain unresolved; no invented VAT number or automatic invoice |
| Flat optional 5%, 7.5%, 10% marketing tiers remain excluded/disabled | No attribution/accounting engine or charging activation is included |
| Independent banking/compliance review; vendor-direct receipt/refund audit | Real verified vendor evidence and receiving capabilities are an admin operation, not data to add to source/tests |

Owner approval therefore closes the broad **owner-intent** question. It does not
turn incomplete files or absent vendor documents into complete approved database
versions. Phase E's exact-hash/independent-review/completeness gates remain intact.

## SHE COOKS BY SNE — reuse, never reprovision

Run `checks/she-cooks-existing-account-preflight.sql` only in a later separately
approved read-only session on the actual vendor's project. It returns aggregate
link booleans, not email, bank details or personal identifiers. Expected: one
matching business, one vendor for its owner, existing Auth identity and profile,
matching `profiles.vendor_id`/`vendors.owner_id` and vendor role. A failed link,
removed identity or suspension is an explicit owner/admin review; never solve it
with signup, user import or a second vendor INSERT.

Use her existing login and linked vendor ID. Do not copy her real identity/banking
into staging; staging UAT uses a synthetic equivalent. A local native regression
confirmed `become_vendor` returns the existing ID and `already_vendor=true`, without
another vendor row. A separate transactional query test verified the expected
one-account shape. Neither test looked up or modified the real hosted account.

Existing vendor status/history is preserved without silent strict enrollment.
The admin must explicitly review its transition: if necessary request changes to
allow pending submissions, assign the actual documents, approve bank/compliance
independently, obtain authenticated acceptance, complete review, then approve/restore
under the backend gate. An old approved status or visible legacy exception alone
does not permit new EFT/PayShap orders. No transition, linking repair, activation,
new account or real bank approval was performed here.
