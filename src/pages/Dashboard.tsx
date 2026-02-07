import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase"
import { useEffect, useState } from "react";


export default function Dashboard  ()  {
    const navigate = useNavigate();
    const [email, setEmail] = useState<string>("");

    useEffect(()=> {
        const load = async () => {
            const {data} = await supabase.auth.getSession();
            const userEmail = data.session?.user?.email;

            if(!userEmail){
                navigate("/login");
                return;
            }

            setEmail(userEmail);
        };
        load();
    }, [navigate])

  return (
    <div>
        <h1>Temporary Dashboard</h1>
        <p>You are logged in as: {email} </p>
      
    </div>
  )
}


