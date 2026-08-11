import { NavLink, useNavigate } from "react-router-dom";
import { FiLogOut, FiX } from "react-icons/fi";
import { APP_NAME } from "../../utils/constants";
import { useAuth } from "../../context/AuthContext";
import Avatar from "../ui/Avatar";

export default function Sidebar({ tabs, open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed lg:sticky top-0 z-50 lg:z-auto h-screen w-72 shrink-0 bg-ink text-paper flex flex-col transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
          <button onClick={onClose} className="lg:hidden text-paper/70">
            <FiX size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 flex flex-col gap-1">
          {tabs.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors ${
                  isActive ? "bg-paper text-ink" : "text-paper/70 hover:bg-paper/10"
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-6 pt-3 border-t border-paper/10 flex flex-col gap-2">
          <div className="flex items-center gap-3 px-3.5 py-2">
            <Avatar src={user?.avatar} name={user?.name} size={34} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-paper/50 truncate capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-paper/70 hover:bg-paper/10"
          >
            <FiLogOut size={17} />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
