import { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../../services/authService";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      await authService.requestPasswordReset(email.trim());
      // Always show the same success state regardless of whether the email
      // matches an account — don't let this form be used to check which
      // emails are registered.
      setSent(true);
    } catch (err) {
      setError(err?.message || "Couldn't send the reset email. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="card p-6 space-y-5">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-ink">Reset your password</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Works for customer, vendor, and admin accounts.
            </p>
          </div>

          {sent ? (
            <div
              role="status"
              className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
            >
              If an account exists for <span className="font-medium">{email}</span>, we've sent a
              password reset link. Check your inbox (and spam folder).
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
                <label htmlFor="forgot-email" className="block text-sm font-medium text-ink mb-1">
                  Email
                </label>
                <input
                  id="forgot-email"
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

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}

          <div className="text-center text-sm">
            <Link to="/login" className="text-ink-muted hover:text-ink">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
