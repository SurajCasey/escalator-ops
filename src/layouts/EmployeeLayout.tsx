import { Link, Outlet } from "react-router-dom";


export default function EmployeeLayout() {
    return(
        <div>
            <aside>
                <div>Statewide ops</div>
                <nav>
                    <Link to="/dashboard">
                        Dashboard
                    </Link>
                </nav>
            </aside>

            <main>
                <Outlet/>
            </main>
        </div>
    );
}