import { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import TextField from "../forms/TextField";
import TextAreaField from "../forms/TextAreaField";
import SelectField from "../forms/SelectField";
import FileUpload from "../forms/FileUpload";
import Spinner from "../ui/Spinner";
import { categories } from "../../mock/categories";

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  category: categories[0]?.name || "",
  preparationTime: "",
  available: true,
  featured: false,
  image: "",
};

/**
 * Reusable add/edit form for a vendor's menu item. Pass `meal` to edit an
 * existing item, or omit it to add a new one. Validates required fields
 * before calling onSave.
 */
export default function MealFormModal({ open, onClose, onSave, meal, saving }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(
        meal
          ? {
              name: meal.name,
              description: meal.description,
              price: meal.price,
              category: meal.category,
              preparationTime: meal.preparationTime || "",
              available: meal.available,
              featured: meal.featured,
              image: meal.image,
            }
          : EMPTY_FORM
      );
      setErrors({});
      setImageFile(null);
    }
  }, [open, meal]);

  const update = (key) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Meal name is required";
    if (!form.description.trim()) next.description = "Add a short description";
    if (!form.price || Number(form.price) <= 0) next.price = "Enter a valid price";
    if (!form.category) next.category = "Choose a category";
    if (!form.preparationTime || Number(form.preparationTime) <= 0)
      next.preparationTime = "Enter preparation time in minutes";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const image = imageFile ? URL.createObjectURL(imageFile) : form.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80";
    onSave({
      ...form,
      price: Number(form.price),
      preparationTime: Number(form.preparationTime),
      image,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={meal ? "Edit meal" : "Add meal"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField label="Name" value={form.name} onChange={update("name")} error={errors.name} />
        <TextAreaField
          label="Description"
          value={form.description}
          onChange={update("description")}
          error={errors.description}
          rows={3}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Price (R)"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={update("price")}
            error={errors.price}
          />
          <TextField
            label="Prep time (mins)"
            type="number"
            min="1"
            value={form.preparationTime}
            onChange={update("preparationTime")}
            error={errors.preparationTime}
          />
        </div>
        <SelectField
          label="Category"
          value={form.category}
          onChange={update("category")}
          error={errors.category}
          options={categories.map((c) => ({ value: c.name, label: c.name }))}
        />
        <FileUpload label="Meal image" onFileSelect={setImageFile} />
        <div className="flex gap-5">
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={form.available}
              onChange={(e) => update("available")(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-ink"
            />
            Available
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => update("featured")(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-ink"
            />
            Featured
          </label>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={saving}>
          {saving ? <Spinner size={16} className="!border-paper/30 !border-t-paper" /> : meal ? "Save changes" : "Add meal"}
        </button>
      </form>
    </Modal>
  );
}
