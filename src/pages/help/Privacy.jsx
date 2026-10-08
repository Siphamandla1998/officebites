import StaticPolicyPage from "../../components/features/StaticPolicyPage";

export default function Privacy() {
  return (
    <StaticPolicyPage
      title="Privacy Policy"
      sections={[
        {
          heading: "What we collect",
          body:
            "We collect the information you provide when creating an account, placing an order, or contacting support — including information such as your name, contact details, delivery location, and order history.",
        },
        {
          heading: "How we use it",
          body:
            "Your information is used to process orders, provide order updates, support customers and vendors, and improve OfficeBites. We don't sell your personal data.",
        },
        {
          heading: "Payments",
          body:
           "Payments are processed through PayFast. OfficeBites uses verified payment confirmation information from the payment process to update your order status automatically.",
        },
        {
          heading: "Support attachments",
          body:
            "If you choose to send an attachment or screenshot when contacting support or reporting a problem, it is used to investigate and respond to your request.",
        },
        {
          heading: "Your choices",
          body:
            "You can manage available account details from your Profile page or contact support if you need assistance with your personal information.",
        },
      ]}
    />
  );
}