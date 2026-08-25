import { useState } from "react";
import { Outlet } from "react-router-dom";
import { FiGrid, FiUsers, FiShoppingBag, FiBarChart2, FiFileText, FiMenu, FiCreditCard, FiMessageCircle } from "react-icons/fi";
import Sidebar from "../components/layout/Sidebar";

const TABS = [
  { to: "/admin", icon: FiGrid, label: "Overview", end: true },
  { to: "/admin/payments", icon: FiCreditCard, label: "Payments" },
  { to: "/admin/vendors", icon: FiShoppingBag, label: "Vendors" },
  { to: "/admin/customers", icon: FiUsers, label: "Customers" },
  { to: "/admin/chats", icon: FiMessageCircle, label: "Chats" },
  { to: "/admin/analytics", icon: FiBarChart2, label: "Analytics" },
  { to: "/admin/reports", icon: FiFileText, label: "Reports" },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-paper">
      <Sidebar tabs={TABS} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-30 bg-paper/90 backdrop-blur border-b border-line">
          <div className="px-5 pt-[env(safe-area-inset-top)]">
            <div className="h-16 flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="btn-icon">
                <FiMenu size={18} />
              </button>
              <span className="text-sm font-semibold text-ink">Admin dashboard</span>
            </div>
          </div>
        </header>
        <main className="px-5 pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-8 lg:pb-[calc(2rem+env(safe-area-inset-bottom))] max-w-6xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
