import { Link, Outlet } from "react-router-dom";


export default function AdminLayout(){
    return(
        <div
            className="flex gap-5"
        >
            <aside>
                <div>Admin</div>
                <nav >
                    <Link 
                        to="/admin/users"
                        className="text-blue-500 cursor-pointer hover:text-blue-700"
                    >
                        Users
                    </Link>
                    {/* later add jobs, clients */}
                </nav>

            </aside>

            <main>
                <Outlet/>
            </main>

        </div>

    );
}