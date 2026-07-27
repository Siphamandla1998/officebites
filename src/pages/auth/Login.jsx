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
    setSubmitting(true);
    try {
      // Role is never chosen at login — it's whatever role is on the
      // account's profile row, set at signup and changed only by an admin.
      const user = await login({ email, password });
      showToast(`Welcome back, ${user.name.split(" ")[0]}!`, { type: "success" });
      navigate(location.state?.from?.pathname || ROLE_HOME[user.role] || "/", { replace: true });
    } catch (err) {
      showToast(err.message || "Couldn't sign in", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary w-full mt-1" disabled={submitting}>
          {submitting ? <Spinner size={16} className="!border-paper/30 !border-t-paper" /> : "Sign in"}
        </button>
      </form>
      <p className="text-sm text-center text-ink-soft">
        New to OfficeBites?{" "}
        <Link to="/register" className="font-semibold text-ink">
          Create an account
        </Link>
      </p>
      <p className="text-sm text-center text-ink-soft">
        Just here to order?{" "}
        <Link to="/" className="font-semibold text-ink">
          Continue as a guest
        </Link>
      </p>
    </div>
  );
}
