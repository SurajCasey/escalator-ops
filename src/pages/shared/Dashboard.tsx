import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase"
import { useEffect, useState } from "react";


export default function Dashboard  ()  {
    const navigate = useNavigate();
    const [email, setEmail] = useState<string>("");
    const [name, setName] = useState<string>("");

    useEffect(()=> {
        const load = async () => {
            const {data} = await supabase.auth.getSession();
            const userEmail = data.session?.user?.email;
            if(!userEmail){
                navigate("/login");
                return;
            }
            
            setEmail(userEmail);

            const {data:profileData, error} = await supabase
            .from("profiles")
            .select("full_name")
            .eq("email", userEmail)
            .single();

            if(error){
                console.error("Error fetching profile:", error.message);
                return;
            }

            setName(profileData?.full_name || "");
        };
        load();
    }, [navigate])

  return (
    <div>
        <h1>Temporary Dashboard</h1>
        <p>You are logged in as: {name}</p>
        <p>Email: {email}</p>   
      
    </div>
  )
}


