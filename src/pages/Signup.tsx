import { useState } from "react"
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import BackgroundLogin from "../components/Backgroundlogin";


export default function Signup() {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    
    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();

        if(!fullName.trim()){
          toast.error("Please enter your full name.");
          return;
        }

        setLoading(true);
        try {
          // Create auth user
          const {data, error:signUpError } = await supabase.auth.signUp({
                email, password
          });

          if (signUpError) {
              toast.error(signUpError.message);
              return;
          }  

          const user = data.user;

          // if email confirmations are enabled, user can be null.
          if(!user){
            toast("Account created. Please check your email to confirm before logging in.",
              {icon: "📩"}
            );
            navigate("/login", {replace: true});
            return;
          }

          // Insert profile row in supabase
          const { error: profileError} = await supabase.from("profiles").insert({
            id: user.id,
            email: user.email,
            full_name: fullName.trim(),
            role: "EMPLOYEE",
            status: "PENDING",
          });

          if(profileError){
            toast.error(profileError.message);
            await supabase.auth.signOut();
            return;
          }
          toast.success("Signup successful! Waiting for admin approval.");
          navigate("/pending", {replace: true});          
        } catch (error) {
            toast.error("An unexpected error occurred. Please try again")
            console.error("Signup error:", error)
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-screen h-screen flex overflow-hidden fixed inset-0">
           
            <BackgroundLogin/>

            {/* Right Side - Login Form */}
            <div 
                className="w-screen h-screen lg:w-1/2 flex flex-col justify-center items-center 
                    bg-[url('assets/MobileLoginBg.png')]
                    bg-cover
                    bg-center
                    bg-fixed
                    lg:bg-linear-to-br from-gray-50 to-gray-100 px-8 py-12"
                >
                <div 
                    className="w-full max-w-md"
                >
                    {/* Card Container with Shadow */}
                    <div className="bg-white rounded-2xl shadow-2xl px-10 py-10 border border-gray-200">
                        {/* Logo and Title */}
                        <div className="mb-8 text-center">
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <img  
                                    className="w-12 h-12"  
                                    src="/Logo.png" 
                                    alt="Statewide logo" 
                                />
                                <div className="flex flex-col items-start">
                                    <h1 className="text-2xl font-bold text-gray-900">
                                        Statewide
                                    </h1>
                                    <span className="text-base font-semibold text-gray-600">
                                        Escalator Cleaning
                                    </span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 font-medium ml-8">Operations Portal</p>
                        </div>
                        
                        {/* Login Form */}
                        <form onSubmit={handleSignup} className="space-y-5">
                            <div>
                              <label 
                                htmlFor="fullName"
                                className="block text-sm font-semibold text-gray-700 mb-2"
                              >
                                Full Name
                              </label>
                              <input
                                id="fullName" 
                                type="text"
                                placeholder="Enter full name"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 outline-none transition-all" 
                                value={fullName}
                                onChange={(e)=> setFullName(e.target.value)}
                                disabled={loading}
                              />
                            </div>
                            <div>
                                <label 
                                    htmlFor="email" 
                                    className="block text-sm font-semibold text-gray-700 mb-2"
                                >
                                    Email Address
                                </label>
                                <input 
                                    id="email"
                                    type="email"
                                    placeholder="Enter your email"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 outline-none transition-all" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                            
                            <div>
                                <label 
                                    htmlFor="password"
                                    className="block text-sm font-semibold text-gray-700 mb-2"
                                >
                                    Password
                                </label>
                                <input 
                                    id="password"
                                    type="password"
                                    placeholder="Enter your password"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-linear-to-r from-blue-600 to-blue-700 text-white py-3.5 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 disabled:from-blue-300 disabled:to-blue-400 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                                {loading ? "Creating Account..." : "Create Account"}
                            </button>
                        </form>

                        {/* Sign Up Link */}
                        <div className="mt-6 text-center">
                            <p className="text-sm text-gray-600">
                                Already have an account?{' '}
                                <a 
                                    href="/login" 
                                    className="text-blue-600 font-semibold hover:text-blue-700 hover:underline transition-colors"
                                >
                                   Log In
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}