import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export interface CurrentUser {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  phone: string | null;
}

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async (u: User | null) => {
      if (!u) {
        if (!mounted) return;
        setUser(null);
        setIsAdmin(false);
        setPhone(null);
        setLoading(false);
        return;
      }
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("id", u.id)
        .maybeSingle();
      if (!mounted) return;
      setUser(u);
      setIsAdmin(Boolean(roleRows?.some((r) => r.role === "admin")));
      setPhone(profile?.phone ?? u.phone ?? null);
      setLoading(false);
    };

    supabase.auth.getUser().then(({ data }) => load(data.user));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        load(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading, isAdmin, phone };
}
