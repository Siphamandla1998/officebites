import { Outlet, Navigate, useLocation } from "react-router-dom";
import BottomNav from "../components/layout/BottomNav";
import CartDrawer from "../components/features/CartDrawer";
import Spinner from "../components/ui/Spinner";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../utils/constants";

// Routes rendering their own navbar/hero
const NO_PADDING_TOP = ["/"];

export default function CustomerLayout() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();

  /*
   * Wait for Supabase to restore the persisted session.
   *
   * This is important because on a fresh browser load:
   *
   * browser
   *   ↓
   * Supabase restores session
   *   ↓
   * AuthContext loads profile
   *   ↓
   * role becomes available
   *
   * Without this wait, the app can briefly assume the user
   * is a customer before the vendor profile has loaded.
   */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  /*
   * A vendor must NEVER be rendered inside CustomerLayout.
   *
   * This protects against the exact problem where a vendor's
   * Supabase session survives a browser restart but "/" renders
   * the customer application.
   */
  if (user?.role === ROLES.VENDOR) {
    return <Navigate to="/vendor" replace />;
  }

  /*
   * Same protection for administrators.
   */
  if (user?.role === ROLES.ADMIN) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <main
      className={`pb-24 ${
        NO_PADDING_TOP.includes(pathname) ? "" : ""
      }`}
    >
      <Outlet />
      <BottomNav />
      <CartDrawer />
    </main>
  );
}
