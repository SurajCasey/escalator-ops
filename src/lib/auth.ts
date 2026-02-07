import { supabase } from "./supabase";

export async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        console.error("Error signing out:", error.message);
    }
}