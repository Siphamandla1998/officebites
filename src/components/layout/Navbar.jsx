import { Link, useNavigate } from "react-router-dom";
import { FiBell, FiShoppingBag, FiArrowLeft } from "react-icons/fi";
import { useCart } from "../../context/CartContext";
import { APP_NAME } from "../../utils/constants";

export default function Navbar({ title, showBack = false, transparent = false, showCart = true }) {
  const navigate = useNavigate();
  const { count, setCartOpen } = useCart();

  return (
    <header
      className={`sticky top-0 z-30 pt-[env(safe-area-inset-top)] ${
        transparent ? "bg-transparent" : "bg-paper/90 backdrop-blur border-b border-line"
      }`}
    >
      <div className="ob-container h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {showBack ? (
            <button onClick={() => navigate(-1)} className="btn-icon" aria-label="Go back">
              <FiArrowLeft size={18} />
            </button>
          ) : null}
          <Link to="/" className="flex items-center gap-2 min-w-0">
            {!title && (
              <span className="text-lg font-bold tracking-tight text-ink">{APP_NAME}</span>
            )}
            {title && <h1 className="text-base font-semibold text-ink truncate">{title}</h1>}
          </Link>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/notifications" className="btn-icon" aria-label="Notifications">
            <FiBell size={17} />
          </Link>
          {showCart && (
            <button onClick={() => setCartOpen(true)} className="btn-icon relative" aria-label="Cart">
              <FiShoppingBag size={17} />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 h-4.5 min-w-[18px] px-1 rounded-full bg-nude-500 text-[10px] text-paper flex items-center justify-center font-semibold">
                  {count}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
