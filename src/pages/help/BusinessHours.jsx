import StaticPolicyPage from "../../components/features/StaticPolicyPage";

export default function BusinessHours() {
  return (
    <StaticPolicyPage
      title="Business Hours"
      sections={[
        { heading: "Support team", body: "Monday – Friday, 07:00 – 18:00. Live chat and ticket replies are fastest during these hours." },
        { heading: "Ordering window", body: "Orders for a given delivery day close at 19:00 the previous day, seven days a week." },
        { heading: "Vendor collection times", body: "Collection windows vary by vendor and are shown on each order ticket." },
      ]}
    />
  );
}
