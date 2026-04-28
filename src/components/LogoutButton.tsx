import { useNavigate } from "react-router-dom";
import { logout } from "../lib/auth";
import toast from "react-hot-toast";
import { LogOut } from "lucide-react";

type Props = { compact?: boolean };

export default function LogoutButton({ compact }: Props) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logged out successfully");
      navigate("/login");
    } catch {
      toast.error("Error logging out");
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-red-600 transition-all"
        title="Logout"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">Logout</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  );
}
