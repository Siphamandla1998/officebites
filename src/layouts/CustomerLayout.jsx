import { Outlet, Navigate, useLocation } from "react-router-dom";
import BottomNav from "../components/layout/BottomNav";
import CartDrawer from "../components/features/CartDrawer";
import Spinner from "../components/ui/Spinner";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../utils/constants";

export default function CustomerLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  if (user?.role === ROLES.VENDOR) {
    return <Navigate to="/vendor" replace />;
  }

  if (user?.role === ROLES.ADMIN) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <main className="app-shell pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <Outlet />
      <BottomNav />
      <CartDrawer />
    </main>
  );
}
