import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

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
        throw new Error("Login succeeded but your user profile could not be loaded.");
      }

      const role = String(loggedInUser.role || "").toLowerCase();

      if (!role) {
        throw new Error(
          "Your account role could not be determined. Please contact OfficeBites support."
        );
      }

      /*
       * Always use the authenticated user's role as the source
       * of truth for the destination.
       */
      let destination = ROLE_HOME[role] || "/";

      /*
       * Do not allow a vendor/admin to be redirected back into
       * the customer application because of an old saved route.
       */
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

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-ink mb-1"
            >
              Email
            </label>

            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-500"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-ink mb-1"
            >
              Password
            </label>

            <input
              id="login-password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>

          <div className="text-center text-sm">
            <Link
              to="/forgot-password"
              className="text-ink-muted hover:text-ink"
            >
              Forgot password?
            </Link>
          </div>

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
