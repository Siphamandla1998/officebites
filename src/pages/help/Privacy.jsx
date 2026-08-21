import StaticPolicyPage from "../../components/features/StaticPolicyPage";

export default function Privacy() {
  return (
    <StaticPolicyPage
      title="Privacy Policy"
      sections={[
        {
          heading: "What we collect",
          body: "We collect the information you provide when creating an account, placing an order, or contacting support — including your name, email, delivery building, and order history.",
        },
        {
          heading: "How we use it",
          body: "Your information is used to process orders, verify payments, communicate order updates, and improve OfficeBites. We don't sell your personal data.",
        },
        {
          heading: "Payment proof uploads",
          body: "Screenshots you upload as proof of payment are used solely to verify your order and are retained only as long as needed for that purpose.",
        },
        {
          heading: "Your choices",
          body: "You can update or delete your account details at any time from your Profile page, or by contacting support.",
        },
      ]}
    />
  );
}
