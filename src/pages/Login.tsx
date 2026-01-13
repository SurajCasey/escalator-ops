import { useState } from "react"
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";




export default function Login  () {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);


    const navigate = useNavigate();
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);


        try {
            const { error } = await supabase.auth.signInWithPassword({
                email, password
            });

            if (error){
                toast.error(error.message);
            } else {
                toast.success("Login successful");
                navigate("/dashboard");
            }
        } catch (error) {
            toast.error("An unexpected error occured. Please try again")
            console.error("login error:", error)
        }finally{
            setLoading(false);
        }
    };


  return (
    <div>
        <div>
            <div>
                <img  
                    className="w-8 "  
                    src="/public/Logo.png" 
                    alt="statewide logo" 
                />
                <h1>Statewide <span>Escalator Cleaning</span></h1>
            </div>
            <p>Operations portal</p>
        </div>
        
        <form onSubmit={handleSubmit}>
            <div>
                <label htmlFor="email">Email Address</label>
                <input 
                    id="email"
                    type="email"
                    placeholder="email"
                    className="input" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value) }
                />
            </div>
            <div>
                <label htmlFor="password">
                    Password
                </label>
                <input 
                    id="password"
                    type="password"
                    placeholder="password"
                    className="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)} 
                />
            </div>

            <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-4"
            >
                {loading ? "logging in..." : "Log In"}
            </button>
        </form>

        <div>
            <p>Don't have an account?</p>
            <a href="/signup">Sign up</a>
        </div>
      
    </div>
  )
}

