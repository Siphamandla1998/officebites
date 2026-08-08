import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCurrentUser = useCallback(async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      console.error("Failed to restore user session:", error);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initialiseAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();

        if (mounted) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Failed to initialise authentication:", error);

        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initialiseAuth();

    const unsubscribe = authService.onAuthStateChange(async (session) => {
      if (!mounted) return;

      if (!session) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const currentUser = await authService.getCurrentUser();

        if (mounted) {
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Failed to refresh authenticated user:", error);

        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const result = await authService.login({ email, password });

    setUser(result.user);

    return result.user;
  }, []);

  const register = useCallback(async (payload) => {
    const result = await authService.register(payload);

    if (!result.needsEmailConfirmation && result.user) {
      setUser(result.user);
    }

    return {
      user: result.user,
      needsEmailConfirmation: result.needsEmailConfirmation,
    };
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
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
