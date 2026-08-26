import { Link } from "react-router-dom";
import {
  FiArrowRight,
  FiShield,
  FiTrendingUp,
  FiClock,
} from "react-icons/fi";
import { APP_NAME } from "../../utils/constants";

const PILLARS = [
  {
    icon: FiClock,
    title: "Order by 19:00, sorted by lunch",
    desc: "Browse local vendors near your building and place your order the day before.",
  },
  {
    icon: FiShield,
    title: "Payments, handled",
    desc: "OfficeBites verifies every payment so vendors only prep confirmed orders.",
  },
  {
    icon: FiTrendingUp,
    title: "Built for vendors too",
    desc: "Menu tools, order queues and revenue dashboards — not just a delivery app.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-[100dvh] flex flex-col pt-[env(safe-area-inset-top)]">
      {/* Hero */}
      <div className="relative px-6 pt-14 pb-10 overflow-hidden">
        {/* Decorative background shapes */}
        <div className="absolute -top-24 -right-20 h-64 w-64 rounded-full bg-nude-200/70 blur-2xl" />
        <div className="absolute -bottom-10 -left-16 h-48 w-48 rounded-full bg-nude-100 blur-2xl" />

        <div className="relative">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-flex h-12 w-12 rounded-2xl bg-ink text-paper items-center justify-center text-base font-bold shrink-0">
              OB
            </span>
          
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-ink">
                Office<span className="text-nude-600">Bites</span>
              </span>
          
              <span className="text-[10px] uppercase tracking-[0.12em] text-ink-muted font-semibold mt-0.5">
                Office Food Marketplace
              </span>
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-[2rem] leading-[1.15] font-bold tracking-tight text-ink">
            The office food marketplace, run right.
          </h1>

          {/* Description */}
          <p className="text-sm text-ink-muted mt-3 leading-relaxed">
            {APP_NAME} connects office teams with local food vendors — real
            meals, verified payments, and a ticket the moment your order is
            confirmed.
          </p>

          {/* Actions */}
          <div className="flex flex-col gap-3 mt-7">
            <Link
              to="/register"
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              Get started
              <FiArrowRight size={15} />
            </Link>

            <Link
              to="/login"
              className="btn-outline w-full flex items-center justify-center"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </div>

      {/* Food image */}
      <div className="px-6 pb-10">
        <img
          src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80"
          alt="Freshly prepared meals"
          className="w-full h-44 object-cover rounded-2xl shadow-card"
        />
      </div>

      {/* Feature pillars */}
      <div className="px-6 flex flex-col gap-4 pb-14">
        {PILLARS.map((pillar) => {
          const Icon = pillar.icon;

          return (
            <div
              key={pillar.title}
              className="card p-4 flex gap-3.5"
            >
              <div className="h-10 w-10 rounded-xl bg-nude-100 text-nude-700 flex items-center justify-center shrink-0">
                <Icon size={17} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-ink">
                  {pillar.title}
                </h3>

                <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                  {pillar.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Vendor CTA */}
      <div className="mt-auto px-6 pb-10 pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
        <p className="text-[11px] text-ink-muted text-center">
          Are you a food vendor?{" "}
          <Link
            to="/register"
            className="text-ink font-medium"
          >
            Apply to sell on {APP_NAME}
          </Link>
        </p>
      </div>
    </div>
  );
}
