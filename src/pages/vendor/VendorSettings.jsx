import { useState, useEffect } from "react";
import TextField from "../../components/forms/TextField";
import TextAreaField from "../../components/forms/TextAreaField";
import FileUpload from "../../components/forms/FileUpload";
import Spinner from "../../components/ui/Spinner";
import { useAsync } from "../../hooks/useAsync";
import { vendorService } from "../../services/vendorService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function VendorSettings() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { data: vendor, loading } = useAsync(() => vendorService.getVendorById(user.vendorId), [user.vendorId]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);

  useEffect(() => {
    if (vendor) {
      setForm({
        name: vendor.name,
        tagline: vendor.tagline,
        building: vendor.building,
        contactNumber: vendor.contactNumber || "",
        email: vendor.email || "",
        address: vendor.address || vendor.building,
        deliveryRadius: vendor.deliveryRadius || "2",
        operatingHours: vendor.operatingHours || "Mon–Fri, 08:00–16:00",
      });
    }
  }, [vendor]);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updates = { ...form };
      if (logoFile) updates.logo = URL.createObjectURL(logoFile);
      if (coverFile) updates.coverImage = URL.createObjectURL(coverFile);
      await vendorService.updateVendorProfile(user.vendorId, updates);
      showToast("Settings saved", { type: "success" });
    } catch (err) {
      showToast(err.message || "Couldn't save settings", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-xl font-bold text-ink">Settings</h1>
        <div className="skeleton h-96" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-ink">Settings</h1>
        <p className="text-sm text-ink-muted mt-0.5">Keep your business details up to date.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 flex flex-col gap-4">
        <TextField label="Business name" value={form.name} onChange={update("name")} required />
        <TextAreaField
          label="Business description"
          value={form.tagline}
          onChange={update("tagline")}
          rows={3}
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Operating hours" value={form.operatingHours} onChange={update("operatingHours")} />
          <TextField label="Delivery radius (km)" type="number" min="0" value={form.deliveryRadius} onChange={update("deliveryRadius")} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <TextField label="Contact number" type="tel" placeholder="e.g. 082 000 0000" value={form.contactNumber} onChange={update("contactNumber")} />
          <TextField label="Email" type="email" value={form.email} onChange={update("email")} />
        </div>
        <TextField label="Address" value={form.address} onChange={update("address")} />

        <div className="grid sm:grid-cols-2 gap-4">
          <FileUpload label="Profile picture" onFileSelect={setLogoFile} />
          <FileUpload label="Cover image" onFileSelect={setCoverFile} />
        </div>

        <button type="submit" className="btn-primary w-full sm:w-auto sm:self-start !px-6" disabled={saving}>
          {saving ? <Spinner size={16} className="!border-paper/30 !border-t-paper" /> : "Save changes"}
        </button>
      </form>
    </div>
  );
}
