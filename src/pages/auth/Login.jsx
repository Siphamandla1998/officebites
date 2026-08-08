```jsx
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

import TextField from "../../components/forms/TextField";
import Spinner from "../../components/ui/Spinner";

import { ROLES } from "../../utils/constants";

const ROLE_HOME = {
  [ROLES.CUSTOMER]: "/",
  [ROLES.VENDOR]: "/vendor",
  [ROLES.ADMIN]: "/admin",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const { showToast } = useToast();

  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submitting) return;

    setSubmitting(true);

    try {
      const user = await login({
        email: email.trim(),
        password,
      });

      // Make sure the profile returned by Supabase has a valid role.
      if (!user?.role) {
        throw new Error(
          "Your account role could not be determined. Please contact OfficeBites support."
        );
      }

      // Vendor accounts must have a vendor ID.
      if (user.role === ROLES.VENDOR && !user.vendorId) {
        throw new Error(
          "Your vendor account is missing its vendor profile. Please contact OfficeBites support."
        );
      }

      // Debug information while we verify the login flow.
      console.log("[OfficeBites] Login successful:", {
        id: user.id,
        name: user.name,
        role: user.role,
        vendorId: user.vendorId,
      });

      showToast(
        `Welcome back, ${(user.name || "there").split(" ")[0]}!`,
        {
          type: "success",
        }
      );

      /*
       * If the user was redirected to login because they tried
       * to access a protected page, return them there.
       *
       * Otherwise send them to the correct home for their role.
       */
      const requestedPath = location.state?.from?.pathname;

      const destination =
        requestedPath && requestedPath !== "/login"
          ? requestedPath
          : ROLE_HOME[user.role] || "/";

      navigate(destination, {
        replace: true,
        state: {},
      });
    } catch (err) {
      console.error("[OfficeBites] Login failed:", err);

      showToast(
        err?.message || "Couldn't sign in. Please check your details.",
        {
          type: "error",
        }
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <form
          onSubmit={handleSubmit}
          className="card p-6 space-y-5"
        >
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-ink">
              Welcome back
            </h1>

            <p className="mt-1 text-sm text-ink-muted">
              Sign in to your OfficeBites account
            </p>
          </div>

          <TextField
            label="Email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <TextField
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Spinner size={18} />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>

          <div className="text-center text-sm text-ink-muted">
            <span>New to OfficeBites? </span>

            <Link
              to="/register"
              className="font-medium text-ink hover:underline"
            >
              Create an account
            </Link>
          </div>

          <div className="text-center text-sm">
            <Link
              to="/"
              className="text-ink-muted hover:text-ink"
            >
              Just here to order? Continue as a guest
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
```
