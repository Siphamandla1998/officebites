import StaticPolicyPage from "../../components/features/StaticPolicyPage";

export default function RefundPolicy() {
  return (
    <StaticPolicyPage
      title="Refund Policy"
      sections={[
        {
          heading: "When refunds apply",
          body: "Refunds are considered when a vendor is unable to fulfil part or all of a confirmed order, or when an order was charged in error.",
        },
        {
          heading: "How to request one",
          body: "Contact support with your ticket number and a description of the issue. Most requests are reviewed within 1–2 business days.",
        },
        {
          heading: "Processing time",
          body: "Approved refunds are returned to your original payment method and are typically completed within 3–5 business days.",
        },
      ]}
    />
  );
}
