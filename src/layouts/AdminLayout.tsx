import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3, Building2, Calendar, Clock,
  LayoutDashboard, Menu, Package, Settings,
  Timer, Users, X,
} from "lucide-react";
import Logo from "../assets/Logo.png";
import LogoutButton from "../components/LogoutButton";
import { useIdleLogout } from "../hooks/useIdleLogout";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/admin/schedule",  label: "Schedule",  Icon: Clock },
  { to: "/admin/calendar",  label: "Calendar",  Icon: Calendar },
  { to: "/admin/clients",   label: "Clients",   Icon: Building2 },
  { to: "/admin/inventory", label: "Inventory", Icon: Package },
  { to: "/admin/reports",   label: "Reports",   Icon: BarChart3 },
  { to: "/admin/people",    label: "People",    Icon: Users },
  { to: "/admin/timesheet", label: "Timesheet", Icon: Timer },
  { to: "/admin/settings",  label: "Settings",  Icon: Settings },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
    isActive
      ? "bg-blue-600 text-white shadow-sm"
      : "text-slate-400 hover:text-white hover:bg-white/10"
  }`;

const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-xs font-medium transition-all text-center ${
    isActive
      ? "bg-blue-600 text-white"
      : "text-slate-400 hover:bg-white/10 hover:text-white"
  }`;

export default function AdminLayout() {
  useIdleLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Top Navbar ──────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-slate-900 border-b border-slate-700/60 shadow-lg flex items-center gap-2 px-4">

        {/* Brand */}
        <NavLink to="/admin/dashboard" className="flex items-center gap-2.5 shrink-0 mr-3">
          <img src={Logo} className="h-8 w-8" alt="Statewide" />
          <span className="text-white font-bold text-[15px] tracking-tight hidden sm:block">
            Statewide
          </span>
        </NavLink>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <div className="hidden lg:block">
            <LogoutButton compact />
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* ── Mobile dropdown ──────────────────────────────────────── */}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="fixed top-14 left-0 right-0 z-40 bg-slate-900 border-b border-slate-700/60 shadow-2xl">
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {NAV_ITEMS.map(({ to, label, Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className={mobileLinkClass}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </NavLink>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700/60">
                <LogoutButton />
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Page content ─────────────────────────────────────────── */}
      <main className="pt-14 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
