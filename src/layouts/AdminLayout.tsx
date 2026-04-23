import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { ChevronRight, Menu, X } from "lucide-react";
import Logo from "../assets/Logo.png";
import LogoutButton from "../components/LogoutButton";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard" },
  { to: "/admin/schedule", label: "Schedule" },
  { to: "/admin/calendar", label: "Calendar" },
  { to: "/admin/clients", label: "Clients" },
  { to: "/admin/inventory", label: "Inventory" },
  { to: "/admin/reports", label: "Reports" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/employees", label: "Employees" },
  { to: "/admin/settings", label: "Settings" },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-slate-100">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={closeSidebar}
          className="fixed inset-0 z-30 bg-slate-950/50"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen flex-col bg-slate-800 text-white transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } w-screen lg:w-64`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 p-4">
          <div className="flex items-center gap-2">
            <img src={Logo} className="h-10 w-10" alt="Statewide logo" />
            <h1 className="text-xl font-bold">Statewide</h1>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              className="rounded-md p-2 transition hover:bg-blue-900"
              to={item.to}
              onClick={closeSidebar}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto p-4">
          <LogoutButton />
        </div>
      </aside>

      <div className="fixed bottom-5 right-5 z-50 lg:hidden">
        <button
          type="button"
          onClick={() => setSidebarOpen((current) => !current)}
          className="inline-flex items-center justify-center rounded-full bg-white p-3.5 text-blue-600 shadow-lg transition hover:bg-blue-50"
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {!sidebarOpen && (
        <div className="fixed left-0 top-1/2 z-50 hidden -translate-y-1/2 lg:block">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center justify-center rounded-r-xl border border-slate-200 border-l-0 bg-white px-2 py-6 text-blue-600 shadow-sm transition hover:bg-blue-50"
            aria-label="Open sidebar"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {sidebarOpen && (
        <div className="fixed right-4 top-4 z-50 hidden lg:block">
          <button
            type="button"
            onClick={closeSidebar}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 p-3 text-white transition hover:bg-slate-700"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <main className="min-h-screen w-full overflow-y-auto pt-16 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}
