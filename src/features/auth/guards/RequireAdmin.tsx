import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import toast from "react-hot-toast";
import { Navigate, Outlet } from "react-router-dom";


type Status = "PENDING" | "ACTIVE" | "DISABLED";
type Role = "ADMIN" | "EMPLOYEE";

type Profile = {status: Status, role: Role};

export default function RequireAdmin(){
    const[loading, setLoading] = useState(true);
    const [redirect, setRedirect] = useState<null | string> (null);

    useEffect(()=>{
        let mounted = true;

        const run = async()=> {
            const { data } = await supabase.auth.getSession();
            const session= data.session;

            if(!session){
                if(mounted){
                    setRedirect("/login");
                    setLoading(false);
                }
                return;
            }

            const {data: profile, error} = await supabase
            .from("profiles")
            .select("status, role")
            .eq("id",session.user.id)
            .single<Profile>();

            if(error || !profile){
                if(mounted){
                    setRedirect("/login");
                    setLoading(false);
                }
                return;
            }

            if(profile.status === "PENDING"){
                if(mounted) setRedirect("/pending");
            }else if(profile.status === "DISABLED"){
                toast.error("Your account is disabled.");
                await supabase.auth.signOut();
                if(mounted) setRedirect("/login");
            }else if(profile.role !== "ADMIN"){
                toast.error("Admin access only");
                if(mounted) setRedirect("/dashboard");
            }else {
                if(mounted) setRedirect(null);
            }

            if(mounted) setLoading(false);
        };
        run();

        return()=> {
            mounted = false;
        };
    }, []);

    if(loading)
        return(
            <div className="w-screen h-screen flex items-center justify-center">Loading...</div>
        );

    if(redirect)
        return <Navigate to={redirect} replace/>;

    return <Outlet/>;
}
