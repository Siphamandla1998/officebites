import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiArrowLeft, FiShoppingBag } from "react-icons/fi";
import TextField from "../../components/forms/TextField";
import SelectField from "../../components/forms/SelectField";
import Spinner from "../../components/ui/Spinner";
import { authService } from "../../services/authService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const VENDOR_CATEGORIES = [
  {
    value: "Home-cooked meals",
    label: "Home-cooked meals",
  },
  {
    value: "Fast food",
    label: "Fast food",
  },
  {
    value: "African cuisine",
    label: "African cuisine",
  },
  {
    value: "Bakery",
    label: "Bakery",
  },
  {
    value: "Healthy food",
    label: "Healthy food",
  },
  {
    value: "Desserts",
    label: "Desserts",
  },
  {
    value: "Drinks",
    label: "Drinks",
  },
  {
    value: "Other",
    label: "Other",
  },
];

export default function BecomeVendor() {
  const navigate = useNavigate();

  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    businessName: "",
    businessCategory: "",
    building: user?.building || "",
  });

  const [submitting, setSubmitting] = useState(false);

  const update = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.businessName.trim()) {
      showToast("Enter your business name", {
        type: "error",
      });
      return;
    }

    if (!form.businessCategory) {
      showToast("Select your business category", {
        type: "error",
      });
      return;
    }

    setSubmitting(true);

    try {
      const result = await authService.becomeVendor(form);

      const refreshedUser = await refreshUser();

      showToast(
        result.alreadyVendor
          ? "Your vendor account is already set up."
          : "Vendor application submitted successfully.",
        {
          type: "success",
        }
      );

      if (
        refreshedUser?.role === "vendor" &&
        refreshedUser?.vendorId
      ) {
        navigate("/vendor", {
          replace: true,
        });
        return;
      }

      navigate("/profile", {
        replace: true,
      });
    } catch (error) {
      showToast(
        error.message ||
          "Couldn't submit your vendor application.",
        {
          type: "error",
        }
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      <div className="ob-container py-5">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-ink-muted mb-5"
        >
          <FiArrowLeft size={17} />
          Back
        </button>

        <div className="max-w-xl mx-auto flex flex-col gap-5">
          <div>
            <div className="h-11 w-11 rounded-xl bg-nude-100 text-nude-700 flex items-center justify-center mb-3">
              <FiShoppingBag size={20} />
            </div>

            <h1 className="text-2xl font-bold text-ink">
              Sell on OfficeBites
            </h1>

            <p className="text-sm text-ink-muted mt-1">
              Create your food business storefront and start
              preparing for customers on OfficeBites.
            </p>
          </div>

          <div className="card p-4 bg-nude-50">
            <p className="text-sm font-semibold text-ink">
              Your customer account stays with you
            </p>

            <p className="text-xs text-ink-muted mt-1 leading-relaxed">
              We'll use your existing OfficeBites account to
              create your vendor profile. You don't need
              another email address or password.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="card p-5 flex flex-col gap-4"
          >
            <TextField
              label="Business name"
              placeholder="e.g. Sne's Kitchen"
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
              placeholder="e.g. Eduvos Building, Umhlanga"
              value={form.building}
              onChange={update("building")}
            />

            <div className="rounded-xl bg-nude-50 px-3.5 py-3">
              <p className="text-sm font-medium text-ink">
                What happens next?
              </p>

              <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                Your storefront will be created as pending.
                OfficeBites will review it before customers
                can discover and order from your business.
                You'll be able to complete your business
                details and menu from the vendor dashboard.
              </p>
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={submitting}
            >
              {submitting ? (
                <Spinner
                  size={16}
                  className="!border-paper/30 !border-t-paper"
                />
              ) : (
                "Submit vendor application"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}