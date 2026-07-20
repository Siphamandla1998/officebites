import { NavLink } from "react-router-dom";
import { FiHome, FiCompass, FiClock, FiUser } from "react-icons/fi";

const CUSTOMER_TABS = [
  { to: "/home", icon: FiHome, label: "Home" },
  { to: "/vendors", icon: FiCompass, label: "Explore" },
  { to: "/orders", icon: FiClock, label: "Orders" },
  { to: "/profile", icon: FiUser, label: "Profile" },
];

export default function BottomNav({ tabs = CUSTOMER_TABS }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-app bg-paper-raised/95 backdrop-blur shadow-nav border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around px-2">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2.5 flex-1 text-[11px] font-medium transition-colors ${
                isActive ? "text-ink" : "text-ink-muted"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={19} className={isActive ? "text-nude-600" : ""} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
