import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import TextField from "../../components/forms/TextField";
import SelectField from "../../components/forms/SelectField";
import Spinner from "../../components/ui/Spinner";
import { ROLES } from "../../utils/constants";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: ROLES.CUSTOMER });
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const user = await register(form);
      showToast("Account created — welcome to OfficeBites!", { type: "success" });
      navigate(user.role === ROLES.VENDOR ? "/vendor" : user.role === ROLES.ADMIN ? "/admin" : "/home");
    } catch (err) {
      showToast(err.message || "Couldn't create account", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <SelectField
          label="I want to join as a"
          value={form.role}
          onChange={update("role")}
          options={[
            { value: ROLES.CUSTOMER, label: "Customer — order lunch" },
            { value: ROLES.VENDOR, label: "Vendor — sell food" },
          ]}
        />
        <TextField label="Full name" placeholder="Jane Dlamini" value={form.name} onChange={update("name")} required />
        <TextField
          label="Work email"
          type="email"
          placeholder="you@company.com"
          value={form.email}
          onChange={update("email")}
          required
        />
        <TextField
          label="Password"
          type="password"
          placeholder="••••••••"
          value={form.password}
          onChange={update("password")}
          required
        />
        {form.role === ROLES.VENDOR && (
          <p className="text-xs text-ink-muted bg-nude-50 rounded-lg px-3 py-2.5">
            Vendor accounts are reviewed by OfficeBites admin before your store goes live.
          </p>
        )}
        <button type="submit" className="btn-primary w-full mt-1" disabled={submitting}>
          {submitting ? <Spinner size={16} className="!border-paper/30 !border-t-paper" /> : "Create account"}
        </button>
      </form>
      <p className="text-sm text-center text-ink-soft">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-ink">
          Sign in
        </Link>
      </p>
    </div>
  );
}
