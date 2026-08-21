import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../services/api/supabaseClient";
import { authService } from "../../services/authService";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Supabase exchanges the token in the reset-link URL for a temporary
    // recovery session automatically on load. That can either already be
    // done by the time this effect runs, or fire moments later as a
    // PASSWORD_RECOVERY auth event — so we check both.
    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) {
        setReady(true);
        setChecking(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
      setChecking(false);
    });

    // If nothing has happened after a few seconds, stop showing the loading
    // state and fall through to "invalid or expired link".
    const timeout = setTimeout(() => {
      if (mounted) setChecking(false);
    }, 4000);

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      await authService.updatePassword(password);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err) {
      setError(err?.message || "Couldn't update your password. Please request a new reset link.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="card p-6 space-y-5">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-ink">Choose a new password</h1>
          </div>

          {checking ? (
            <p className="text-center text-sm text-ink-muted">Verifying your reset link...</p>
          ) : done ? (
            <div
              role="status"
              className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
            >
              Password updated — redirecting you to sign in.
            </div>
          ) : !ready ? (
            <div className="space-y-4">
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                This reset link is invalid or has expired.
              </div>
              <Link to="/forgot-password" className="btn-primary w-full flex items-center justify-center">
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="reset-password" className="block text-sm font-medium text-ink mb-1">
                  New password
                </label>
                <input
                  id="reset-password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label htmlFor="reset-password-confirm" className="block text-sm font-medium text-ink mb-1">
                  Confirm new password
                </label>
                <input
                  id="reset-password-confirm"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:border-gray-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? "Updating..." : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
