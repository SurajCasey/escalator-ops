import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { Navigate, Outlet } from "react-router-dom";

type Status = "PENDING" | "ACTIVE" | "DISABLED";
type Profile = { status: Status; role: "ADMIN" | "EMPLOYEE" };


export default function RequireActive() {
    const [loading, setLoading] = useState(true);
    const [redirect, setRedirect] = useState<null | string>(null);

    useEffect(()=> {
        let mounted = true;

        const run = async () => {
            if(mounted) setLoading(true);

            const { data } = await supabase.auth.getSession();
            const session = data.session;

            if(!session){
                if(mounted){
                    setRedirect("/login");
                    setLoading(false);
                }
                return;
            }

            const userId = session.user.id;

            const { data: profile, error} = await supabase
            .from("profiles")
            .select("status, role")
            .eq("id", userId)
            .single<Profile>();

            if(error || !profile){
                if (mounted){
                    setRedirect("/pending");
                    setLoading(false);
                }
                return;
            }

            if(profile.status === "PENDING") setRedirect('/pending');
            else if(profile.status === "DISABLED") setRedirect('/login');
            else setRedirect(null);

            if(mounted) setLoading(false);
        };

        run();

        return() => {
            mounted = false;
        }
    }, []);

    if(loading) return <div className="w-screen h-screen flex items-center justify-center">Loading...</div>;
    if(redirect) return <Navigate to={redirect} replace/>;

    return <Outlet />;

}
