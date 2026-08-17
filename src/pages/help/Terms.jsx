import StaticPolicyPage from "../../components/features/StaticPolicyPage";

export default function Terms() {
  return (
    <StaticPolicyPage
      title="Terms & Conditions"
      sections={[
        {
          heading: "Using OfficeBites",
          body: "OfficeBites is a marketplace connecting office workers with local food vendors. By placing an order, you agree to pay the listed price and collect your order at the time and place shown on your ticket.",
        },
        {
          heading: "Ordering & payment",
          body: "Orders close at 19:00 the day before delivery. OfficeBites collects and verifies payment on behalf of vendors before an order is confirmed.",
        },
        {
          heading: "Vendor responsibilities",
          body: "Vendors are responsible for the quality and safety of food they prepare. A confirmed order cannot be rejected by a vendor — it must be fulfilled.",
        },
        {
          heading: "Account conduct",
          body: "Accounts found to be abusive, fraudulent, or in breach of these terms may be suspended by OfficeBites admin at any time.",
        },
      ]}
    />
  );
}
