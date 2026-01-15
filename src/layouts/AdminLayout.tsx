import { Link, Outlet } from "react-router-dom";


export default function AdminLayout(){
    return(
        <div>
            <aside>
                <div>Admin</div>
                <nav>
                    <Link to="/admin/users">
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