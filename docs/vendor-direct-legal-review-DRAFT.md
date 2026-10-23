# Unpublished draft — human legal/commercial review required

This file does not publish, approve or replace any legal version. No regulatory approval is asserted. The current legal portal has no approved published documents in the previously inspected staging configuration; recheck before launch.

## Proposed minimum customer disclosure

“The food vendor named in your order sells and fulfils your food order and receives your payment directly. OfficeBites provides marketplace, ordering, tracking and delivery-coordination services. Pay only the recipient shown in your order instructions. Check the recipient name in your banking app before transferring. OfficeBites does not receive your food-payment proceeds or distribute them to the vendor. Your payment report or proof of payment does not confirm received funds; the vendor must independently verify receipt. Orders remain subject to availability and acceptance. Contact OfficeBites through Support for help coordinating a payment dispute or vendor refund.”

## Terms and refund policy amendments to review

- Identify the contracting seller, its support route, and delivery/collection responsibilities before order submission. Confirm the business disclosures and effective documents are complete.
- Explain one vendor per checkout, deadlines, abandoned orders, late/under/over/duplicate payments and outdated payment instructions. Do not promise automatic confirmation, bank reversals or instant refunds.
- Specify cancellation rights before and after payment, when a vendor may decline, and responsibility/timeframes for vendor refunds. Human counsel must confirm applicable customer rights and mandatory remedies; no policy should override them.
- Support must preserve cancelled/disputed orders and original payment destinations. Customer money already sent is reconciled with the receiving vendor; OfficeBites cannot refund via PayFast/Ozow for a transfer those gateways did not process.
- Decide exact escalation contacts, response targets, refund evidence and independently verified refund destination. Do not request banking credentials, PINs or OTPs. Do not assume refunds must use a customer-supplied replacement account.

## Vendor agreement amendments to review

- Record consent to vendor-direct receipt; verify the account belongs to the actual food business and the bank permits the intended usage. Independently verify PayShap receiving capability and registered ShapID.
- Name the people authorised to confirm bank receipt; require independent bank inspection and prompt discrepancy reports. Include high-value/admin-review procedures and obligations after an order is cancelled or expires.
- Confirm when the contractual commission becomes due. This implementation uses the existing verified-paid commission snapshot and vendor-specific rate, normally 17%. It does not activate marketing tiers, charge another 17%, infer VAT, or automatically collect commission.
- Confirm treatment of delivery receipts: the vendor receives the entire quoted amount including delivery, while the existing commission applies to product subtotal. Define who funds delivery services and how any delivery reimbursement is invoiced. This must be agreed before a real delivery-fee pilot.
- Agree weekly statement/invoice dates, payment terms, collection evidence, credit notes, refund allocations and any negative balances after commission was collected before a refund. CSV statements are not tax invoices.
- Confirm any marketing/acquisition agreements separately. Existing disabled feature flags remain unchanged; commercial sign-off is required before enabling them for this settlement model.

## Privacy / POPIA amendments to review

- Explain processing of vendor bank details, approval evidence, payment references, guest contact and order capabilities for order/payment support. Define access, lawful basis, retention and data-subject request handling.
- Only the vendor, authorised administrators and the customer with order-specific access see necessary recipient instructions. No public bank catalogue or proof-upload bucket is introduced.
- Payment capabilities persist in the current browser tab's session storage and memory, never in URLs. Loss of that capability requires authenticated access or support assistance; ticket/contact order recovery alone does not reveal bank details.
- Define a retention policy for bank profiles and audit/refund evidence consistent with contractual/legal requirements; the implementation deliberately retains historical records rather than silently deleting them.

## Provider approval is unresolved

PayFast's rejection is supplied business context, not reversed by software. Keep new PayFast marketplace payments blocked. Ozow's [published terms](https://ozow.com/terms-and-conditions) describe merchant/sponsor-bank obligations and additional onboarding requirements; they do not establish approval for OfficeBites' specific third-party marketplace model. Obtain written approval addressing the actual fund flow, merchant identity, vendor settlement and permitted services before any future provider release. No outbound message has been sent to either provider.
