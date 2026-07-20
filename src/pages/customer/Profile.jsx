import { useNavigate } from "react-router-dom";
import {
  FiChevronRight,
  FiHeart,
  FiClock,
  FiMapPin,
  FiMessageCircle,
  FiLogOut,
  FiHelpCircle,
} from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import Avatar from "../../components/ui/Avatar";
import { useAuth } from "../../context/AuthContext";

const MENU = [
  { to: "/orders", icon: FiClock, label: "Order history" },
  { to: "/favourites", icon: FiHeart, label: "Favourite meals" },
  { to: "/chat", icon: FiMessageCircle, label: "Messages" },
  { to: "/profile/building", icon: FiMapPin, label: "Delivery building" },
  { to: "/help", icon: FiHelpCircle, label: "Help & support" },
];

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div>
      <Navbar title="Profile" showCart={false} />
      <div className="ob-container pt-4 pb-8">
        <div className="card p-4 flex items-center gap-3.5">
          <Avatar src={user?.avatar} name={user?.name} size={56} />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink truncate">{user?.name}</h2>
            <p className="text-xs text-ink-muted truncate">{user?.email}</p>
            <p className="text-xs text-ink-muted flex items-center gap-1 mt-0.5">
              <FiMapPin size={11} /> {user?.building}
            </p>
          </div>
        </div>

        <div className="card mt-5 divide-y divide-line overflow-hidden">
          {MENU.map(({ to, icon: Icon, label }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-ink-soft hover:bg-nude-50"
            >
              <Icon size={17} className="text-ink-muted" />
              <span className="flex-1 text-left">{label}</span>
              <FiChevronRight size={15} className="text-ink-muted" />
            </button>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 mt-5 text-sm font-medium text-danger py-3"
        >
          <FiLogOut size={16} /> Log out
        </button>
      </div>
    </div>
  );
}
