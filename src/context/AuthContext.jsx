import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authService
      .getCurrentUser()
      .then((current) => active && setUser(current))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false));

    // Keep in sync with Supabase's own session lifecycle (token refresh,
    // sign-out from another tab, magic-link completion, etc.) rather than
    // only reacting to calls made through this context.
    const unsubscribe = authService.onAuthStateChange(async (session) => {
      if (!session) {
        if (active) setUser(null);
        return;
      }
      try {
        const current = await authService.getCurrentUser();
        if (active) setUser(current);
      } catch {
        if (active) setUser(null);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const { user: loggedInUser } = await authService.login({ email, password });
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (payload) => {
    const { user: newUser, needsEmailConfirmation } = await authService.register(payload);
    if (!needsEmailConfirmation) setUser(newUser);
    return { user: newUser, needsEmailConfirmation };
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
