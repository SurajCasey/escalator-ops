import { Link, Outlet } from "react-router-dom";
import Logo from "../../public/logo.png";
import LogoutButton from "../components/LogoutButton";


export default function AdminLayout(){
    return(
          <div
            className="flex flex-row gap-4 "
        >
            <aside 
                className="w-1/4 h-screen bg-slate-800 text-white flex flex-col 
                gap-4  "
            >
                <div className="text-xl font-bold flex flex-row gap-2 items-center 
                    bg-slate-900 shadow-neutral-200 p-4"
                >
                    <img src={Logo} className="w-10 h-10" />
                    <h1>
                        Statewide Operations
                    </h1>
                </div>
                <nav className="flex flex-col gap-2 px-4">
                    <Link 
                        to="/admin/users"
                        className="text-blue-500 cursor-pointer hover:text-blue-700"
                    >
                        Users
                    </Link>
                     <Link 
                        className="p-2 hover:bg-blue-900 rounded-md"
                        to="/dashboard">
                        Dashboard
                    </Link>
                   <Link 
                        className="p-2 hover:bg-blue-900 rounded-md"
                        to="/schedule">
                     Schedule
                   </Link>
                   <Link 
                        className="p-2 hover:bg-blue-900 rounded-md"
                        to="/calendar"> 
                        Calendar 
                   </Link>
                    <Link 
                        className="p-2 hover:bg-blue-900 rounded-md"
                        to="/clients">
                        Clients
                    </Link>
                    <Link 
                        className="p-2 hover:bg-blue-900 rounded-md"
                        to="/employees">
                        Employees   
                    </Link>
                    <Link   
                        className="p-2 hover:bg-blue-900 rounded-md"
                        to="/settings"> 
                        Settings 
                    </Link>
                </nav>

                <div className="mt-auto">
                    <LogoutButton />
                </div>

            </aside>

            <main>
                <Outlet/>
            </main>

        </div>

    );
}