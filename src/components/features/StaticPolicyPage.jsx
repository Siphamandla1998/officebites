import Navbar from "../../components/layout/Navbar";

/**
 * Generic static content page used for Terms & Conditions, Privacy Policy,
 * Refund Policy, and Business Hours — each just supplies a title and
 * section list, avoiding four near-identical page components.
 */
export default function StaticPolicyPage({ title, sections }) {
  return (
    <div className="pb-8">
      <Navbar showBack title={title} showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-4">
        {sections.map((s) => (
          <div key={s.heading} className="card p-4">
            <h3 className="text-sm font-semibold text-ink mb-1.5">{s.heading}</h3>
            <p className="text-sm text-ink-soft leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
