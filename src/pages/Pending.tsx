import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

const Pending = () => {
  const navigate = useNavigate();

  const handleLogout= async () => {
    await supabase.auth.signOut();
    navigate('/login', {replace: true});

  }

  return (
    <div>
      <div 
        className="w-screen h-screen  flex flex-col justify-center items-center 
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
                <div className="mb-8 ">
                    <div className="flex items-center justify-items-start gap-3 mb-2">
                        <img  
                            className="w-16 h-16"  
                            src="/Logo.png" 
                            alt="Statewide logo" 
                        />
                        <div className="flex flex-col items-start">
                            <h1 className="text-2xl font-bold text-gray-900 md:text-4xl">
                                Statewide
                            </h1>
                            <span className="text-base font-semibold text-gray-600 md:text-2xl">
                                Escalator Cleaning
                            </span>
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 pl-4 font-medium ml-15 md:text-md">Operations Portal</p>
                </div>
                
                <div
                  className="space-y-3"
                >
                  <h1 className="text-2xl font-bold text--900">Account Pending Approval</h1>
                  <p>Your have signed up for your account, but it has not been approved.
                    Please wait for admin approval.
                  </p>
                </div>

                    <button
                      onClick={handleLogout}         
                        className="w-full bg-linear-to-r from-red-600 to-red-700 text-white py-3.5 px-4 rounded-lg 
                          font-semibold hover:from-red-700 hover:to-red-800 disabled:from-blue-300 
                          disabled:to-blue-400 disabled:cursor-not-allowed transition-all duration-200 
                          shadow-lg hover:shadow-xl transform hover:-translate-y-0.5
                          cursor-pointer mt-8"
                    >
                        Sign Out
                    </button>
              </div>
          </div>
      </div>

    </div>
  )
}

export default Pending


