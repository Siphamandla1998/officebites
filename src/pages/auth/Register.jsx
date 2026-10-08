import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import TextField from "../../components/forms/TextField";
import SelectField from "../../components/forms/SelectField";
import Spinner from "../../components/ui/Spinner";
import { ROLES } from "../../utils/constants";

const VENDOR_CATEGORIES = [
  { value: "Home-cooked meals", label: "Home-cooked meals" },
  { value: "Fast food", label: "Fast food" },
  { value: "African cuisine", label: "African cuisine" },
  { value: "Bakery", label: "Bakery" },
  { value: "Healthy food", label: "Healthy food" },
  { value: "Desserts", label: "Desserts" },
  { value: "Drinks", label: "Drinks" },
  { value: "Other", label: "Other" },
];

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    businessName: "",
    businessCategory: "",
    email: "",
    password: "",
    role: ROLES.CUSTOMER,
    building: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isVendor = form.role === ROLES.VENDOR;

  const update = (key) => (e) =>
    setForm((current) => ({
      ...current,
      [key]: e.target.value,
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isVendor && !form.businessName.trim()) {
      showToast("Enter your business name", {
        type: "error",
      });
      return;
    }

    if (isVendor && !form.businessCategory) {
      showToast("Select your business category", {
        type: "error",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { user, needsEmailConfirmation } =
        await register(form);

      if (needsEmailConfirmation) {
        setConfirmSent(true);
        return;
      }

      showToast(
        isVendor
          ? "Vendor account created — your storefront is now pending review."
          : "Account created — welcome to OfficeBites!",
        { type: "success" }
      );

      navigate(
        user.role === ROLES.VENDOR
          ? "/vendor"
          : user.role === ROLES.ADMIN
            ? "/admin"
            : "/"
      );
    } catch (err) {
      showToast(
        err.message || "Couldn't create account",
        { type: "error" }
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmSent) {
    return (
      <div className="card p-6 text-center flex flex-col gap-2">
        <h3 className="text-base font-semibold text-ink">
          Check your inbox
        </h3>

        <p className="text-sm text-ink-muted">
          We've sent a confirmation link to{" "}
          <span className="font-medium text-ink">
            {form.email}
          </span>
          . Click it, then come back and sign in.
        </p>

        {isVendor && (
          <p className="text-xs text-ink-muted bg-nude-50 rounded-lg px-3 py-2.5 mt-2">
            Your OfficeBites storefront has been created
            and will remain under review until approved.
          </p>
        )}

        <Link
          to="/login"
          className="btn-primary mt-3"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <SelectField
          label="I want to join as a"
          value={form.role}
          onChange={update("role")}
          options={[
            {
              value: ROLES.CUSTOMER,
              label: "Customer — order food",
            },
            {
              value: ROLES.VENDOR,
              label: "Vendor — sell food",
            },
          ]}
        />

        <TextField
          label="Your name"
          placeholder="Jane Dlamini"
          value={form.name}
          onChange={update("name")}
          required
        />

        {isVendor && (
          <>
            <TextField
              label="Business name"
              placeholder="e.g. Jane's Kitchen"
              value={form.businessName}
              onChange={update("businessName")}
              required
            />

            <SelectField
              label="What type of food do you sell?"
              value={form.businessCategory}
              onChange={update("businessCategory")}
              options={[
                {
                  value: "",
                  label: "Select a category",
                },
                ...VENDOR_CATEGORIES,
              ]}
            />

            <TextField
              label="Business location"
              placeholder="e.g. Umhlanga, Gateway or your building"
              value={form.building}
              onChange={update("building")}
            />
          </>
        )}

        <TextField
          label="Email address"
          type="email"
          placeholder="name@example.com"
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
          minLength={6}
        />

        {isVendor && (
          <div className="text-xs text-ink-muted bg-nude-50 rounded-lg px-3 py-3">
            <p className="font-medium text-ink mb-1">
              Your storefront will be reviewed before going live.
            </p>

            <p>
              You can create your OfficeBites vendor
              account now. Customers will only see your
              store after it has been approved by
              OfficeBites.
            </p>
          </div>
        )}

        <button
          type="submit"
          className="btn-primary w-full mt-1"
          disabled={submitting}
        >
          {submitting ? (
            <Spinner
              size={16}
              className="!border-paper/30 !border-t-paper"
            />
          ) : isVendor ? (
            "Create vendor account"
          ) : (
            "Create account"
          )}
        </button>
      </form>

      <p className="text-sm text-center text-ink-soft">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-semibold text-ink"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}