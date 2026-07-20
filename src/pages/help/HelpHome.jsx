import { useNavigate } from "react-router-dom";
import {
  FiHelpCircle,
  FiMail,
  FiMessageCircle,
  FiAlertTriangle,
  FiBookOpen,
  FiFileText,
  FiShield,
  FiRefreshCw,
  FiClock,
  FiStar,
} from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";

const CARDS = [
  { to: "/help/faq", icon: FiHelpCircle, title: "FAQs", desc: "Quick answers to common questions" },
  { to: "/help/contact", icon: FiMail, title: "Contact Support", desc: "Send us a message and we'll reply" },
  { to: "/help/chat", icon: FiMessageCircle, title: "Live Chat", desc: "Chat with our support team now" },
  { to: "/help/report", icon: FiAlertTriangle, title: "Report a Problem", desc: "Flag a bug or an order issue" },
  { to: "/help/guides", icon: FiBookOpen, title: "Guides", desc: "Step-by-step help articles" },
  { to: "/help/tickets", icon: FiFileText, title: "My Tickets", desc: "Track support requests you've raised" },
  { to: "/help/feedback", icon: FiStar, title: "Rate Support", desc: "Tell us how we're doing" },
  { to: "/help/terms", icon: FiShield, title: "Terms & Conditions", desc: "Our platform terms" },
  { to: "/help/privacy", icon: FiShield, title: "Privacy Policy", desc: "How we handle your data" },
  { to: "/help/refunds", icon: FiRefreshCw, title: "Refund Policy", desc: "How refunds work" },
  { to: "/help/hours", icon: FiClock, title: "Business Hours", desc: "When our support team is online" },
];

export default function HelpHome() {
  const navigate = useNavigate();

  return (
    <div className="pb-8">
      <Navbar showBack title="Help & Support" showCart={false} />
      <div className="ob-container pt-4">
        <p className="text-sm text-ink-muted mb-4">
          Everything you need to get help with an order, your account, or your store.
        </p>
        <div className="grid grid-cols-2 gap-3.5">
          {CARDS.map((c) => (
            <button
              key={c.to}
              onClick={() => navigate(c.to)}
              className="card p-4 flex flex-col items-start gap-2.5 text-left hover:border-nude-400 transition-colors"
            >
              <div className="h-10 w-10 rounded-xl bg-nude-100 text-nude-700 flex items-center justify-center">
                <c.icon size={17} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">{c.title}</h3>
                <p className="text-xs text-ink-muted mt-0.5">{c.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
