import { useNavigate } from "react-router-dom";
import {
  FiChevronRight,
  FiHeart,
  FiClock,
  FiMessageCircle,
  FiLogOut,
  FiHelpCircle,
  FiLogIn,
} from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import Avatar from "../../components/ui/Avatar";
import { useAuth } from "../../context/AuthContext";

const MENU = [
  { to: "/orders", icon: FiClock, label: "Order history" },
  { to: "/favourites", icon: FiHeart, label: "Favourite meals" },
  { to: "/chat", icon: FiMessageCircle, label: "Messages" },
  { to: "/help", icon: FiHelpCircle, label: "Help & support" },
];

export default function Profile() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div>
      <Navbar title="Profile" showCart={false} />
      <div className="ob-container pt-4 pb-8">
        {isAuthenticated ? (
          <div className="card p-4 flex items-center gap-3.5">
            <Avatar src={user.avatar} name={user.name} size={56} />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink truncate">{user.name}</h2>
              <p className="text-xs text-ink-muted truncate">{user.email}</p>
              {user.building && <p className="text-xs text-ink-muted mt-0.5">{user.building}</p>}
            </div>
          </div>
        ) : (
          <div className="card p-4 flex items-center gap-3.5">
            <div className="h-14 w-14 rounded-full bg-nude-100 text-nude-700 flex items-center justify-center shrink-0">
              <FiLogIn size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-ink">You're browsing as a guest</h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Sign in to save your order history and favourites across devices — ordering works fine without it too.
              </p>
              <button onClick={() => navigate("/login")} className="btn-primary !px-4 !py-2 text-sm mt-3">
                Sign in / Create account
              </button>
            </div>
          </div>
        )}

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

        {isAuthenticated && (
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 mt-5 text-sm font-medium text-danger py-3"
          >
            <FiLogOut size={16} /> Log out
          </button>
        )}
      </div>
    </div>
  );
}
