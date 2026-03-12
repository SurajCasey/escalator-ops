import { Link, Outlet } from "react-router-dom";
import Logo from "../assets/Logo.png";
import LogoutButton from "../components/LogoutButton";

export default function AdminLayout() {
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
          <h1 className="text-xl font-bold">Statewide Operations</h1>
        </div>

        {/* NAV */}
        <nav className="flex flex-col gap-2 px-4 py-4">
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/admin/dashboard">
            Dashboard
          </Link>
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/admin/schedule">
            Schedule
          </Link>
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/admin/calendar">
            Calendar
          </Link>
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/admin/clients">
            Clients
          </Link>
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/admin/inventory">
            Inventory
          </Link>
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/admin/users">
            Users
          </Link>
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/admin/employees">
            Employees
          </Link>
          <Link className="p-2 hover:bg-blue-900 rounded-md" to="/admin/settings">
            Settings
          </Link>
        </nav>

        {/* LOGOUT – ALWAYS BOTTOM */}
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