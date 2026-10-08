import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const requestVersion = useRef(0);
  const mounted = useRef(true);

  const loadCurrentUser = useCallback(async () => {
    const version = ++requestVersion.current;
    const isCurrent = () => mounted.current && version === requestVersion.current;

    try {
      const currentUser = await authService.getCurrentUser();
      if (isCurrent()) setUser(currentUser);
      return currentUser;
    } catch (error) {
      if (isCurrent()) {
        console.error("Failed to restore user session:", error);
        setUser(null);
      }
      return null;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadCurrentUser();

    const unsubscribe = authService.onAuthStateChange((session) => {
      if (!mounted.current) return;

      if (!session) {
        ++requestVersion.current;
        setUser(null);
        setLoading(false);
        return;
      }

      return loadCurrentUser();
    });

    return () => {
      mounted.current = false;
      ++requestVersion.current;
      unsubscribe();
    };
  }, [loadCurrentUser]);

  const login = useCallback(async ({ email, password }) => {
    const version = ++requestVersion.current;
    const result = await authService.login({ email, password });

    if (mounted.current && version === requestVersion.current) {
      setUser(result.user);
    }

    return result.user;
  }, []);

  const register = useCallback(async (payload) => {
    const version = ++requestVersion.current;
    const result = await authService.register(payload);

    if (mounted.current && version === requestVersion.current &&
        !result.needsEmailConfirmation && result.user) {
      setUser(result.user);
    }

    return {
      user: result.user,
      needsEmailConfirmation: result.needsEmailConfirmation,
    };
  }, []);

  const logout = useCallback(async () => {
    const version = ++requestVersion.current;
    await authService.logout();
    if (mounted.current && version === requestVersion.current) {
      setUser(null);
    }
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: Boolean(user),
    refreshUser: loadCurrentUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
