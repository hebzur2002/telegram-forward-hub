import { useEffect, useState } from "react";
import { getStoredUser, getToken, type StoredUser } from "@/lib/backend";

export interface CurrentUser {
  user: StoredUser | null;
  loading: boolean;
  isAdmin: boolean;
  phone: string | null;
  token: string | null;
}

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<StoredUser | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getToken());

  useEffect(() => {
    const onStorage = () => {
      setUser(getStoredUser());
      setToken(getToken());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    user,
    loading: false,
    isAdmin: user?.role === "admin",
    phone: user?.phone ?? null,
    token,
  };
}
