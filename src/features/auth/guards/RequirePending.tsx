import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Navigate, Outlet } from "react-router-dom";

type Status = "PENDING" | "ACTIVE" | "DISABLED";
type Profile = {status: Status};

export default function RequirePending () {
    const [loading, setLoading] = useState(true);
    const [redirect, setRedirect] = useState<null | string> (null);

    useEffect(()=> {
        let mounted = true;

        const run = async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;

            if(!session){
                if(mounted){
                    setRedirect("/login");
                    setLoading(false);
                }
                return;
            }

            const { data:profile, error} = await supabase
            .from("profiles")
            .select("status")
            .eq("id", session.user.id)
            .single<Profile>();

            if(error || !profile){
                if(mounted){
                    setRedirect("/login")
                    setLoading(false);
                }
                return;
            }

            if(profile.status === "PENDING") setRedirect(null);
            else if (profile.status === "ACTIVE") setRedirect("/dashboard");
            else setRedirect("/login");

            if(mounted) setLoading(false);
        }
        run();
        return () => {
            mounted = false;
        }
    },[]);

    if(loading) return <div className="w-screen h-screen flex items-center justify-center">Loading...</div>
    if(redirect) return <Navigate to={redirect} replace/>;
    return <Outlet />;
}
