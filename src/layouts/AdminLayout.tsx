import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Banknote, BarChart3, Building2, CalendarDays, CalendarOff, ChevronDown,
  FileText, LayoutDashboard, LogOut, Menu, Package,
  Receipt, Settings, ShoppingCart, Timer, Users, X,
} from "lucide-react";
import Logo from "../assets/Logo.png";
import LogoutButton from "../components/LogoutButton";
import { useIdleLogout } from "../hooks/useIdleLogout";
import { supabase } from "../lib/supabase";

/* ── Nav definition ──────────────────────────────────────── */
const PRIMARY = [
  { to: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/admin/schedule",  label: "Schedule",  Icon: CalendarDays },
  { to: "/admin/people",    label: "People",    Icon: Users },
];

const SECONDARY = [
  { to: "/admin/clients",           label: "Clients",    Icon: Building2 },
  { to: "/admin/invoices",          label: "Invoices",   Icon: FileText },
  { to: "/admin/inventory",         label: "Inventory",  Icon: Package },
  { to: "/admin/purchase-requests", label: "Purchases",  Icon: ShoppingCart },
  { to: "/admin/receipts",          label: "Receipts",   Icon: Receipt },
  { to: "/admin/payroll",           label: "Payroll",      Icon: Banknote },
  { to: "/admin/reports",           label: "Reports",      Icon: BarChart3 },
  { to: "/admin/timesheet",         label: "Timesheet",    Icon: Timer },
  { to: "/admin/availability",      label: "Availability", Icon: CalendarOff },
  { to: "/admin/settings",          label: "Settings",     Icon: Settings },
];

/* ── Class helpers ───────────────────────────────────────── */
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
    isActive
      ? "bg-blue-600 text-white shadow-sm"
      : "text-slate-400 hover:text-white hover:bg-white/10"
  }`;

const mobileGridClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center gap-1.5 px-1 py-3 rounded-xl text-center transition-all ${
    isActive
      ? "bg-blue-600 text-white"
      : "text-slate-400 hover:bg-white/10 hover:text-white"
  }`;

/* ── "More" dropdown (desktop) ───────────────────────────── */
function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
          open ? "bg-white/15 text-white" : "text-slate-400 hover:text-white hover:bg-white/10"
        }`}
      >
        More
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-slate-800 border border-slate-700/60 shadow-2xl overflow-hidden z-50">
          {SECONDARY.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
          <div className="border-t border-slate-700/60 mt-1 pt-1">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Layout ──────────────────────────────────────────────── */
export default function AdminLayout() {
  useIdleLogout();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const ALL_ITEMS = [...PRIMARY, ...SECONDARY];

  /* Auto-hide header on mobile when scrolling down */
  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 60) { setNavVisible(true); lastScrollY.current = currentY; return; }
      if (currentY < lastScrollY.current - 8) setNavVisible(true);
      else if (currentY > lastScrollY.current + 8) setNavVisible(false);
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 h-14 bg-slate-900 border-b border-slate-700/50 shadow-lg transition-transform duration-300 ${
          !navVisible ? "-translate-y-full md:translate-y-0" : "translate-y-0"
        }`}
      >
        <div className="flex h-full items-center gap-1 px-3 md:px-4">
          <NavLink to="/admin/dashboard" className="flex items-center gap-2 shrink-0 mr-3">
            <img src={Logo} className="h-8 w-8 rounded-lg" alt="Statewide" />
            <span className="text-white font-bold text-sm tracking-tight hidden sm:block">Statewide</span>
          </NavLink>

          <div className="flex-1" />

          {/* Primary nav — md+ */}
          <nav className="hidden md:flex items-center gap-0.5">
            {PRIMARY.map(({ to, label, Icon }) => (
              <NavLink key={to} to={to} className={navLinkClass}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* More dropdown — md+ */}
          <div className="hidden md:block ml-1">
            <MoreMenu />
          </div>

          {/* Hamburger — mobile only, always in header */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden ml-1 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* ── Mobile bottom-sheet overlay ─────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-[35] bg-slate-950/70 backdrop-blur-md md:hidden"
            onClick={closeMobile}
          />
          <div className="fixed bottom-0 inset-x-0 z-[36] rounded-t-2xl bg-slate-900 border-t border-slate-700/60 shadow-2xl overflow-hidden md:hidden">
            <div className="p-4 max-h-[75vh] overflow-y-auto">
              {/* Handle bar */}
              <div className="w-10 h-1 bg-slate-600 rounded-full mx-auto mb-4" />
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 px-1">Navigation</p>
              <div className="grid grid-cols-4 gap-1.5">
                {ALL_ITEMS.map(({ to, label, Icon }) => (
                  <NavLink key={to} to={to} onClick={closeMobile} className={mobileGridClass}>
                    <Icon className="h-5 w-5" />
                    <span className="text-[10px] leading-tight font-medium">{label}</span>
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

      {/* ── FAB — only visible when header is hidden (scrolled away) ── */}
      {!navVisible && (
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="md:hidden fixed bottom-6 right-6 z-[37] w-14 h-14 rounded-full bg-slate-900 border border-slate-700/60 shadow-2xl text-white flex items-center justify-center transition-all active:scale-95 hover:bg-slate-800"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      )}

      {/* ── Page content ─────────────────────────────────────── */}
      <main className="pt-14 min-h-screen pb-8 md:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
