import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3, Building2, Calendar, ChevronDown,
  LayoutDashboard, LogOut, Menu, Package,
  Settings, Timer, Users, X,
} from "lucide-react";
import Logo from "../assets/Logo.png";
import LogoutButton from "../components/LogoutButton";
import { useIdleLogout } from "../hooks/useIdleLogout";
import { supabase } from "../lib/supabase";

/* ── Nav definition ──────────────────────────────────────── */
const PRIMARY = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/schedule",  label: "Schedule",  Icon: Calendar },
  { to: "/clock",     label: "Clock In",  Icon: Timer },
  { to: "/reports",   label: "Reports",   Icon: BarChart3 },
];

const SECONDARY = [
  { to: "/clients",   label: "Clients",   Icon: Building2 },
  { to: "/inventory", label: "Inventory", Icon: Package },
  { to: "/people",    label: "People",    Icon: Users },
  { to: "/settings",  label: "Settings",  Icon: Settings },
];

/* ── Shared class helpers ────────────────────────────────── */
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
    isActive
      ? "bg-blue-600 text-white shadow-sm"
      : "text-slate-400 hover:text-white hover:bg-white/10"
  }`;

const mobileGridClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-xs font-medium transition-all text-center ${
    isActive
      ? "bg-blue-600 text-white"
      : "text-slate-400 hover:bg-white/10 hover:text-white"
  }`;

/* ── "More" dropdown ─────────────────────────────────────── */
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
          open
            ? "bg-white/15 text-white"
            : "text-slate-400 hover:text-white hover:bg-white/10"
        }`}
      >
        More
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-slate-800 border border-slate-700/60 shadow-2xl overflow-hidden z-50">
          {SECONDARY.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
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
export default function EmployeeLayout() {
  useIdleLogout();
  const [mobileOpen, setMobileOpen] = useState(false);
  const ALL_ITEMS = [...PRIMARY, ...SECONDARY];

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-slate-900 border-b border-slate-700/50 shadow-lg">
        <div className="flex h-full items-center gap-1 px-3 md:px-4">

          {/* Brand */}
          <NavLink to="/dashboard" className="flex items-center gap-2 shrink-0 mr-3">
            <img src={Logo} className="h-8 w-8 rounded-lg" alt="Statewide" />
            <span className="text-white font-bold text-sm tracking-tight hidden sm:block">
              Statewide
            </span>
          </NavLink>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Primary nav — md+ (right-aligned) */}
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

          {/* Mobile hamburger — < md */}
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* ── Mobile dropdown (< md) ──────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed top-14 left-0 right-0 z-40 bg-slate-900 border-b border-slate-700/60 shadow-2xl">
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {ALL_ITEMS.map(({ to, label, Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileOpen(false)}
                    className={mobileGridClass}
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

      {/* ── Page content ─────────────────────────────────────── */}
      <main className="pt-14 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
