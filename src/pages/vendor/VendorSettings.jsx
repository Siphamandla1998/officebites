import { useEffect, useState } from "react";
import {
  FiCheckCircle,
  FiMapPin,
  FiNavigation,
} from "react-icons/fi";

import TextField from "../../components/forms/TextField";
import TextAreaField from "../../components/forms/TextAreaField";
import FileUpload from "../../components/forms/FileUpload";
import Spinner from "../../components/ui/Spinner";

import { useAsync } from "../../hooks/useAsync";
import { vendorService } from "../../services/vendorService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

export default function VendorSettings() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const {
    data: vendor,
    loading,
    refetch,
  } = useAsync(
    () => vendorService.getVendorById(user.vendorId),
    [user.vendorId]
  );

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  useEffect(() => {
    if (!vendor) return;

    setForm({
      name: vendor.name || "",
      tagline: vendor.tagline || "",
      building: vendor.building || "",
      contactNumber: vendor.contactNumber || "",
      email: vendor.email || "",
      address: vendor.address || vendor.building || "",
      deliveryRadius:
        vendor.deliveryRadius !== "" &&
        vendor.deliveryRadius !== null &&
        vendor.deliveryRadius !== undefined
          ? String(vendor.deliveryRadius)
          : "2",
      operatingHours:
        vendor.operatingHours || "Mon–Fri, 08:00–16:00",
      latitude: vendor.latitude ?? null,
      longitude: vendor.longitude ?? null,
    });
  }, [vendor]);

  const update = (key) => (event) => {
    setForm((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const hasCoordinates =
    Number.isFinite(Number(form?.latitude)) &&
    Number.isFinite(Number(form?.longitude));

  const captureBusinessLocation = () => {
    if (!navigator.geolocation) {
      showToast(
        "Location services aren't supported by this browser.",
        { type: "error" }
      );
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setForm((current) => ({
          ...current,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }));

        setLocating(false);

        showToast(
          "Business location captured. Save changes to apply it.",
          { type: "success" }
        );
      },

      (error) => {
        setLocating(false);

        let message =
          "We couldn't get your business location.";

        if (error.code === error.PERMISSION_DENIED) {
          message =
            "Location permission was denied. Allow location access in your browser and try again.";
        } else if (
          error.code === error.POSITION_UNAVAILABLE
        ) {
          message =
            "Your current location is unavailable. Check your device location settings and try again.";
        } else if (error.code === error.TIMEOUT) {
          message =
            "Getting your location took too long. Please try again.";
        }

        showToast(message, { type: "error" });
      },

      GEO_OPTIONS
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const radius = Number(form.deliveryRadius);

    if (!form.address.trim()) {
      showToast(
        "Add your business address before saving.",
        { type: "error" }
      );
      return;
    }

    if (!Number.isFinite(radius) || radius <= 0) {
      showToast(
        "Delivery radius must be greater than 0 km.",
        { type: "error" }
      );
      return;
    }

    if (!hasCoordinates) {
      showToast(
        "Set your business location before saving. This is how OfficeBites shows your store to nearby customers.",
        { type: "error" }
      );
      return;
    }

    setSaving(true);

    try {
      const updates = {
        ...form,
        deliveryRadius: radius,
      };

      if (logoFile) {
        updates.logoFile = logoFile;
      }

      if (coverFile) {
        updates.coverImageFile = coverFile;
      }

      await vendorService.updateVendorProfile(
        user.vendorId,
        updates
      );

      await refetch();

      setLogoFile(null);
      setCoverFile(null);

      showToast(
        "Business settings saved",
        { type: "success" }
      );
    } catch (err) {
      showToast(
        err.message || "Couldn't save settings",
        { type: "error" }
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-xl font-bold text-ink">
          Settings
        </h1>

        <div className="skeleton h-96" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-ink">
          Settings
        </h1>

        <p className="text-sm text-ink-muted mt-0.5">
          Manage your business details, delivery area and
          marketplace location.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-5"
      >
        <section className="card p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Business details
            </h2>

            <p className="text-xs text-ink-muted mt-1">
              Information customers may see when browsing your
              storefront.
            </p>
          </div>

          <TextField
            label="Business name"
            value={form.name}
            onChange={update("name")}
            required
          />

          <TextAreaField
            label="Business description"
            value={form.tagline}
            onChange={update("tagline")}
            rows={3}
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <TextField
              label="Operating hours"
              value={form.operatingHours}
              onChange={update("operatingHours")}
            />

            <TextField
              label="Building / location name"
              value={form.building}
              onChange={update("building")}
              placeholder="e.g. Eduvos Building"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <TextField
              label="Contact number"
              type="tel"
              placeholder="e.g. 082 000 0000"
              value={form.contactNumber}
              onChange={update("contactNumber")}
            />

            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={update("email")}
            />
          </div>
        </section>

        <section className="card p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-nude-100 flex items-center justify-center text-nude-700 shrink-0">
              <FiMapPin size={17} />
            </div>

            <div>
              <h2 className="text-base font-semibold text-ink">
                Business location
              </h2>

              <p className="text-xs text-ink-muted mt-1">
                OfficeBites uses this location to show your
                business to customers inside your delivery area.
              </p>
            </div>
          </div>

          <TextField
            label="Business address"
            value={form.address}
            onChange={update("address")}
            placeholder="e.g. 1 Lunar Row, Umhlanga"
            required
          />

          <TextField
            label="Delivery radius (km)"
            type="number"
            min="0.1"
            step="0.1"
            value={form.deliveryRadius}
            onChange={update("deliveryRadius")}
            required
          />

          <div
            className={`rounded-xl border p-4 ${
              hasCoordinates
                ? "border-line bg-nude-50/60"
                : "border-line bg-paper"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {hasCoordinates ? (
                    <FiCheckCircle
                      size={18}
                      className="text-nude-700"
                    />
                  ) : (
                    <FiNavigation
                      size={18}
                      className="text-ink-muted"
                    />
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-ink">
                    {hasCoordinates
                      ? "Business location set"
                      : "Set your exact business location"}
                  </p>

                  <p className="text-xs text-ink-muted mt-1 max-w-md">
                    {hasCoordinates
                      ? "Your location is ready for nearby customer discovery. Capture it again if the business moves."
                      : "While you are at the business premises, use this device's location to place your store correctly in the OfficeBites marketplace."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={captureBusinessLocation}
                disabled={locating}
                className="btn-secondary shrink-0"
              >
                {locating ? (
                  <>
                    <Spinner size={14} />
                    Locating...
                  </>
                ) : (
                  <>
                    <FiNavigation size={14} />
                    {hasCoordinates
                      ? "Update location"
                      : "Use current location"}
                  </>
                )}
              </button>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-ink-muted">
            Your exact coordinates are used for distance and
            delivery-area calculations. Customers don't need to
            see the raw GPS coordinates.
          </p>
        </section>

        <section className="card p-5 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold text-ink">
              Store images
            </h2>

            <p className="text-xs text-ink-muted mt-1">
              Keep your marketplace profile recognisable and
              professional.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <FileUpload
              label="Profile picture"
              onFileSelect={setLogoFile}
            />

            <FileUpload
              label="Cover image"
              onFileSelect={setCoverFile}
            />
          </div>
        </section>

        <button
          type="submit"
          className="btn-primary w-full sm:w-auto sm:self-start !px-6"
          disabled={saving || locating}
        >
          {saving ? (
            <Spinner
              size={16}
              className="!border-paper/30 !border-t-paper"
            />
          ) : (
            "Save changes"
          )}
        </button>
      </form>
    </div>
  );
}