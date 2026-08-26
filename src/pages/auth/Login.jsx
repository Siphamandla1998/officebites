import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import TextField from "../../components/forms/TextField";
import Spinner from "../../components/ui/Spinner";

const ROLE_HOME = {
  customer: "/",
  vendor: "/vendor",
  admin: "/admin",
};

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      const loggedInUser = await login({
        email: email.trim(),
        password,
      });

      if (!loggedInUser) {
        throw new Error(
          "Login succeeded but your user profile could not be loaded."
        );
      }

      const role = String(loggedInUser.role || "").toLowerCase();

      if (!role) {
        throw new Error(
          "Your account role could not be determined. Please contact OfficeBites support."
        );
      }

      let destination = ROLE_HOME[role] || "/";

      if (role === "vendor") {
        destination = "/vendor";
      } else if (role === "admin") {
        destination = "/admin";
      } else if (role === "customer") {
        const requestedPath = location.state?.from?.pathname;

        if (
          requestedPath &&
          requestedPath !== "/login" &&
          !requestedPath.startsWith("/vendor") &&
          !requestedPath.startsWith("/admin")
        ) {
          destination = requestedPath;
        } else {
          destination = "/";
        }
      }

      navigate(destination, {
        replace: true,
        state: {},
      });
    } catch (loginError) {
      console.error("[OfficeBites] Login failed:", loginError);

      setError(
        loginError?.message ||
          "Couldn't sign in. Please check your email and password."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-10 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="flex flex-col items-center mb-7">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 rounded-2xl bg-ink text-paper items-center justify-center text-base font-bold shrink-0">
              OB
            </span>

            <span className="text-xl font-extrabold tracking-tight text-ink">
              Office<span className="text-nude-600">Bites</span>
            </span>
          </div>

          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted mt-2">
            Office Food Marketplace
          </span>
        </div>

        {/* Login form */}
        <form
          onSubmit={handleSubmit}
          className="card p-6 flex flex-col gap-5"
        >
          <div className="text-center">
            <h1 className="text-xl font-semibold text-ink">
              Welcome back
            </h1>

            <p className="mt-1 text-sm text-ink-muted">
              Sign in to your OfficeBites account
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {/* Email */}
          <TextField
            label="Email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />

          {/* Password */}
          <TextField
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? (
              <Spinner
                size={16}
                className="!border-paper/30 !border-t-paper"
              />
            ) : (
              "Sign in"
            )}
          </button>

          {/* Forgot password */}
          <div className="text-center text-sm">
            <Link
              to="/forgot-password"
              className="text-ink-muted hover:text-ink"
            >
              Forgot password?
            </Link>
          </div>

          {/* Register */}
          <div className="text-center text-sm text-ink-muted">
            <span>New to OfficeBites? </span>

            <Link
              to="/register"
              className="font-medium text-ink hover:underline"
            >
              Create an account
            </Link>
          </div>

          {/* Guest */}
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
