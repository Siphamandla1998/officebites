import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../services/api/supabaseClient";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

const FavouriteContext = createContext(null);

export function FavouriteProvider({ children }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [ids, setIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const busy = useRef(new Set());
  const currentUser = useRef(user?.id);
  currentUser.current = user?.id;
  useEffect(() => {
    let active = true;
    setIds([]);
    if (!user?.id) { setLoading(false); return undefined; }
    setLoading(true);
    supabase.from("favourites").select("meal_id").eq("profile_id", user.id).then(({ data, error }) => {
      if (!active) return;
      if (error) showToast("Could not load your favourite meals. Please refresh.", { type: "error" });
      else setIds((data || []).map((row) => row.meal_id));
      setLoading(false);
    });
    return () => { active = false; };
  }, [user?.id, showToast]);

  const toggleFavourite = async (meal) => {
    const uid = user?.id;
    if (!uid) { showToast("Sign in to save favourite meals across devices.", { type: "info" }); return; }
    if (!meal?.id || loading || busy.current.has(meal.id)) return;
    busy.current.add(meal.id);
    try {
      const saved = ids.includes(meal.id);
      const { error } = saved
        ? await supabase.from("favourites").delete().eq("profile_id", uid).eq("meal_id", meal.id)
        : await supabase.from("favourites").upsert({ profile_id: uid, meal_id: meal.id }, { onConflict: "profile_id,meal_id", ignoreDuplicates: true });
      if (error) throw error;
      if (currentUser.current === uid) setIds((current) => saved ? current.filter((id) => id !== meal.id) : [...new Set([...current, meal.id])]);
    } catch (error) { showToast(error.message || "Could not save your favourite meal.", { type: "error" }); }
    finally { busy.current.delete(meal.id); }
  };
  return <FavouriteContext.Provider value={{ ids, loading, toggleFavourite }}>{children}</FavouriteContext.Provider>;
}

export function useFavourites() { return useContext(FavouriteContext); }
