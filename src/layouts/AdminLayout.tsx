import { Link, Outlet } from "react-router-dom";
// import Logo from "../../public/logo.png";
import LogoutButton from "../components/LogoutButton";


export default function AdminLayout(){
    return(
          <div
            className="flex flex-row gap-4 "
        >
            <aside 
                className="w-64 min-w-64 max-w-64 h-screen bg-slate-800 text-white 
                flex flex-col gap-4 md:w-56 md:min-w-56 md:max-w-56 
                lg:w-64 lg:min-w-64 lg:max-w-64"
            >
                <div className="text-xl font-bold flex flex-row gap-2 items-center 
                    bg-slate-900 shadow-neutral-200 p-4"
                >
                    <img src="/logo.png" className="w-10 h-10" />
                    <h1>
                        Statewide Operations
                    </h1>
                </div>
                <nav className="flex flex-col gap-2 px-4">
                    <Link 
                        to="/admin/users"
                        className="p-2 hover:bg-blue-900 rounded-md"
                    >
                        Users
                    </Link>
                     <Link 
                        className="p-2 hover:bg-blue-900 rounded-md"
                        to="/admin/dashboard">
                        Dashboard
                    </Link>
                   <Link 
                        className="p-2 hover:bg-blue-900 rounded-md"
                        to="/admin/schedule">
                     Schedule
                   </Link>
                   <Link 
                        className="p-2 hover:bg-blue-900 rounded-md"
                        to="/admin/calendar"> 
                        Calendar 
                   </Link>
                    <Link 
                        className="p-2 hover:bg-blue-900 rounded-md"
                        to="/admin/clients">
                        Clients
                    </Link>
                    <Link 
                        className="p-2 hover:bg-blue-900 rounded-md"
                        to="/admin/inventory"
                    >
                     Inventory
                    </Link>
                    <Link 
                        className="p-2 hover:bg-blue-900 rounded-md"
                        to="/admin/employees">
                        Employees   
                    </Link>
                    <Link   
                        className="p-2 hover:bg-blue-900 rounded-md"
                        to="/admin/settings"> 
                        Settings 
                    </Link>
                </nav>

                <div className="mt-auto">
                    <LogoutButton />
                </div>

            </aside>

            <main className="w-full">
                <Outlet/>
            </main>

        </div>

    );
}