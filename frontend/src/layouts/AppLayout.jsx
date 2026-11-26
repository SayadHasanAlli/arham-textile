import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Wallet } from 'lucide-react';
import {
  LayoutDashboard,
  PlusCircle,
  ClipboardList,
  Users,
  Store,
  Tag,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const adminNav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/production-entry", label: "Production Entry", icon: PlusCircle },
  { to: "/admin/records", label: "All Records", icon: ClipboardList },
  { to: "/admin/workers", label: "Workers", icon: Users },
  { to: "/admin/vendors", label: "Vendors", icon: Store },
  { to: "/admin/pricing", label: "Production Pricing", icon: Tag },
  { to: "/admin/payouts", label: "Payouts", icon: Wallet },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const workerNav = [
  { to: "/worker", label: "My Profile", icon: LayoutDashboard, end: true },
  { to: "/worker/settings", label: "Settings", icon: Settings },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navItems = user?.role === "admin" ? adminNav : workerNav;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform lg:translate-x-0 lg:static ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-slate-900">ARHAM TEXTILE</h1>
            <p className="text-xs text-slate-500">Production Management</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="mb-3 px-3">
            <p className="text-sm font-medium text-slate-900 truncate">
              {user?.worker_name || user?.username}
            </p>
            <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between lg:hidden sticky top-0 z-10">
          <span className="text-sm font-semibold">ARHAM TEXTILE</span>
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-slate-600">
            <Menu className="w-5 h-5" />
          </button>
        </header>
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
