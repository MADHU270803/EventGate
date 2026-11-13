import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // If a saved wristband exists, we start in "checking" mode.
  const [loading, setLoading] = useState(Boolean(getToken()));

  // On page load, ask the server who the saved wristband belongs to.
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    api("/auth/me")
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        // Nothing to do: the user simply stays logged out.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // api.js announces this when the server rejects our wristband.
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("eventgate:logout", onLogout);
    return () => window.removeEventListener("eventgate:logout", onLogout);
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (fields) => {
    const data = await api("/auth/register", { method: "POST", body: fields });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}