import { Link, Outlet } from "react-router-dom";
import Logo from "../assets/Logo.png";
import LogoutButton from "../components/LogoutButton";

export default function EmployeeLayout() {
  return (
    <div className="flex">
      {/* SIDEBAR */}
      <aside
        className="
          fixed
          left-0
          top-0
          h-screen
          w-64
          bg-slate-800
          text-white
          flex
          flex-col
        "
      >
        {/* LOGO */}
        <div className="flex items-center gap-2 bg-slate-900 border-b border-gray-600 p-4">
          <img src={Logo} className="w-10 h-10" />
          <h1 className="text-xl font-bold">Statewide</h1>
        </div>

        {/* NAV */}
        <nav className="flex flex-col gap-2 px-4 py-4 overflow-y-auto">
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/dashboard">
            Dashboard
          </Link>
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/schedule">
            Schedule
          </Link>
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/calendar">
            Calendar
          </Link>
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/clients">
            Clients
          </Link>
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/inventory">
            Inventory
          </Link>
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/employees">
            Employees
          </Link>
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/settings">
            Settings
          </Link>
        </nav>

        {/* LOGOUT */}
        <div className="mt-auto p-4">
          <LogoutButton />
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="ml-64 w-full min-h-screen overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}