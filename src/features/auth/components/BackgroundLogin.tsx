import BgImg from "../../../assets/MobileLoginBg.png";

export default function BackgroundLogin() {
    return (
        <div className="hidden lg:flex lg:w-1/2 relative">
            {/* Background Image */}
            <img 
                className="absolute inset-0 w-full h-full object-cover"
                src={BgImg} 
                alt="Background" 
            />
            
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-linear-to-br from-black/50 via-black/40 to-black/60" />
            
            {/* Welcome Text */}
            <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white mb-10">
                <h1 className="text-5xl font-bold mb-4">Welcome Back</h1>
                <p className="text-xl text-white/90">Sign in to continue to your dashboard</p>
            </div>
        </div>
    );
}
