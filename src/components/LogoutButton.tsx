import { useNavigate } from "react-router-dom";
import { logout } from "../lib/auth";
import toast from "react-hot-toast";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await logout();
            toast.success("Logged out successfully");
            navigate("/login");
        } catch (error) {
            toast.error("Error logging out");
            console.error("Logout error:", error);
        }
    };

    return (
        <button
            onClick={handleLogout}
            className="w-full p-2 bg-red-600 text-white rounded-md hover:bg-red-700 
            transition-colors cursor-pointer"
        >
            <LogOut className="inline-block mr-2" />
            Logout
        </button>
    );
}