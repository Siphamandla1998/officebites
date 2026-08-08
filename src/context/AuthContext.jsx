```jsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import { authService } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /*
   * Initial authentication check.
   *
   * IMPORTANT:
   * We wait for Supabase to restore the session and then fetch
   * the user's profile before allowing the application to finish
   * its authentication loading state.
   */
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();

        if (!mounted) return;

        setUser(currentUser || null);
      } catch (error) {
        console.error(
          "[OfficeBites] Failed to restore session:",
          error
        );

        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    /*
     * Keep authentication state synchronized after initialization.
     *
     * We intentionally do NOT immediately process the initial
     * session event here because initializeAuth() already handles it.
     */
    const unsubscribe = authService.onAuthStateChange(
      async (session) => {
        if (!mounted) return;

        if (!session) {
          setUser(null);
          setLoading(false);
          return;
        }

        try {
          const currentUser =
            await authService.getCurrentUser();

          if (!mounted) return;

          setUser(currentUser || null);
        } catch (error) {
          console.error(
            "[OfficeBites] Failed to refresh profile:",
            error
          );

          if (mounted) {
            setUser(null);
          }
        }
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(
    async ({ email, password }) => {
      const result = await authService.login({
        email,
        password,
      });

      const loggedInUser = result.user;

      if (!loggedInUser) {
        throw new Error(
          "Unable to load your account profile."
        );
      }

      console.log(
        "[OfficeBites] Authenticated user:",
        {
          id: loggedInUser.id,
          role: loggedInUser.role,
          vendorId: loggedInUser.vendorId,
        }
      );

      setUser(loggedInUser);

      return loggedInUser;
    },
    []
  );

  const register = useCallback(
    async (payload) => {
      const result =
        await authService.register(payload);

      if (!result.needsEmailConfirmation) {
        setUser(result.user);
      }

      return result;
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within AuthProvider"
    );
  }

  return context;
}
```
