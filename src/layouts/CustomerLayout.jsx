import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "../components/layout/BottomNav";
import CartDrawer from "../components/features/CartDrawer";

// Routes rendering their own navbar/hero (no shared top bar wanted here)
const NO_PADDING_TOP = ["/home"];

export default function CustomerLayout() {
  const { pathname } = useLocation();

  return (
    <div className="app-shell shadow-float">
      <main className={`pb-24 ${NO_PADDING_TOP.includes(pathname) ? "" : ""}`}>
        <Outlet />
      </main>
      <BottomNav />
      <CartDrawer />
    </div>
  );
}
