import { useState } from "react";
import { Outlet } from "react-router-dom";
import { FiGrid, FiUsers, FiShoppingBag, FiBarChart2, FiFileText, FiMenu } from "react-icons/fi";
import Sidebar from "../components/layout/Sidebar";

const TABS = [
  { to: "/admin", icon: FiGrid, label: "Overview", end: true },
  { to: "/admin/vendors", icon: FiShoppingBag, label: "Vendors" },
  { to: "/admin/customers", icon: FiUsers, label: "Customers" },
  { to: "/admin/analytics", icon: FiBarChart2, label: "Analytics" },
  { to: "/admin/reports", icon: FiFileText, label: "Reports" },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-paper">
      <Sidebar tabs={TABS} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 z-30 bg-paper/90 backdrop-blur border-b border-line px-5 h-16 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="btn-icon">
            <FiMenu size={18} />
          </button>
          <span className="text-sm font-semibold text-ink">Admin dashboard</span>
        </header>
        <main className="p-5 lg:p-8 max-w-6xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
