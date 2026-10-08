import { useNavigate } from "react-router-dom";
import {
  FiMessageSquare,
  FiFileText,
  FiHelpCircle,
  FiShoppingBag,
  FiArrowRight,
  FiClock,
} from "react-icons/fi";

import Navbar from "../../components/layout/Navbar";

export default function LiveChatSupport() {
  const navigate = useNavigate();

  const options = [
    {
      icon: FiShoppingBag,
      title: "Order issue",
      description:
        "For preparation, substitutions, availability or collection questions, use the chat linked to your OfficeBites order.",
      action: "View my orders",
      onClick: () => navigate("/orders"),
    },
    {
      icon: FiMessageSquare,
      title: "Contact OfficeBites Support",
      description:
        "Create a support ticket for payment, account, platform or other issues that need help from the OfficeBites team.",
      action: "Create support ticket",
      onClick: () => navigate("/help/contact"),
    },
    {
      icon: FiFileText,
      title: "My support tickets",
      description:
        "Track your support requests and continue conversations with the OfficeBites team.",
      action: "View tickets",
      onClick: () => navigate("/help/tickets"),
    },
    {
      icon: FiHelpCircle,
      title: "Help Centre",
      description:
        "Find answers to common questions about orders, payments, accounts and using OfficeBites.",
      action: "Browse help",
      onClick: () => navigate("/help"),
    },
  ];

  return (
    <div className="min-h-screen bg-paper">
      <Navbar
        showBack
        title="OfficeBites Support"
        showCart={false}
      />

      <main className="ob-container py-6 pb-24">
        <section className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-line bg-white p-5 sm:p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-nude-100 text-ink">
              <FiMessageSquare size={20} />
            </div>

            <h1 className="mt-4 text-xl font-semibold text-ink">
              How can we help?
            </h1>

            <p className="mt-2 text-sm leading-6 text-ink-soft">
              Choose the support option that best matches what
              you need help with.
            </p>

            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-nude-50 p-3.5">
              <FiClock
                size={16}
                className="mt-0.5 shrink-0 text-ink-muted"
              />

              <p className="text-xs leading-5 text-ink-soft">
                Live agent chat is not currently available.
                Support requests are handled through OfficeBites
                support tickets so your issue and responses stay
                recorded in one place.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {options.map(
              ({
                icon: Icon,
                title,
                description,
                action,
                onClick,
              }) => (
                <button
                  key={title}
                  type="button"
                  onClick={onClick}
                  className="group w-full rounded-2xl border border-line bg-white p-4 text-left transition hover:border-nude-400"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-nude-100 text-ink">
                      <Icon size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">
                        {title}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-ink-soft">
                        {description}
                      </p>

                      <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ink">
                        <span>{action}</span>

                        <FiArrowRight
                          size={13}
                          className="transition-transform group-hover:translate-x-0.5"
                        />
                      </div>
                    </div>
                  </div>
                </button>
              )
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-line bg-nude-50 p-4">
            <p className="text-sm font-semibold text-ink">
              Which support option should I use?
            </p>

            <div className="mt-3 space-y-2 text-xs leading-5 text-ink-soft">
              <p>
                <strong className="text-ink">
                  Vendor/order fulfilment:
                </strong>{" "}
                use the chat attached to your order.
              </p>

              <p>
                <strong className="text-ink">
                  Payment or platform problem:
                </strong>{" "}
                create an OfficeBites support ticket.
              </p>

              <p>
                <strong className="text-ink">
                  General question:
                </strong>{" "}
                check the Help Centre first, then create a ticket
                if you still need assistance.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}