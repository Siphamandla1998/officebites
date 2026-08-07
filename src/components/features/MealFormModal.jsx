import { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import TextField from "../forms/TextField";
import TextAreaField from "../forms/TextAreaField";
import SelectField from "../forms/SelectField";
import FileUpload from "../ui/FileUpload";

const DEFAULT_CATEGORIES = [
  { name: "Meals" },
  { name: "Drinks" },
  { name: "Snacks" },
  { name: "Desserts" },
];

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  category: "Meals",
  preparationTime: "",
  available: true,
  featured: false,
  image: "",
};


/**
 * Reusable add/edit form for a vendor's menu item.
 * Pass `meal` to edit an existing item, or omit it to add a new one.
 */
export default function MealFormModal({
  open,
  onClose,
  onSave,
  meal,
  saving,
  categories = DEFAULT_CATEGORIES,
}) {

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);


  useEffect(() => {

    if (!open) return;

    setForm(
      meal
        ? {
            name: meal.name || "",
            description: meal.description || "",
            price: meal.price || "",
            category: meal.category || "Meals",
            preparationTime: meal.preparationTime || "",
            available: meal.available ?? true,
            featured: meal.featured ?? false,
            image: meal.image || "",
          }
        : EMPTY_FORM
    );

    setErrors({});
    setImageFile(null);

  }, [open, meal]);


  const update = (key) => (e) => {

    const value =
      e?.target?.type === "checkbox"
        ? e.target.checked
        : e?.target
        ? e.target.value
        : e;

    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };


  const validate = () => {

    const next = {};

    if (!form.name.trim()) {
      next.name = "Meal name is required";
    }

    if (!form.description.trim()) {
      next.description = "Add a short description";
    }

    if (!form.price || Number(form.price) <= 0) {
      next.price = "Enter a valid price";
    }

    if (!form.category) {
      next.category = "Choose a category";
    }

    if (
      !form.preparationTime ||
      Number(form.preparationTime) <= 0
    ) {
      next.preparationTime =
        "Enter preparation time in minutes";
    }

    setErrors(next);

    return Object.keys(next).length === 0;
  };


  const handleSubmit = (e) => {

    e.preventDefault();

    if (!validate()) return;


    onSave({
      ...form,
      price: Number(form.price),
      preparationTime: Number(form.preparationTime),

      // Existing image remains if editing
      image: form.image || null,

      // New upload goes to Supabase Storage
      imageFile: imageFile || null,
    });

  };


  return (

    <Modal
      open={open}
      onClose={onClose}
      title={meal ? "Edit meal" : "Add meal"}
    >

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >

        <TextField
          label="Name"
          value={form.name}
          onChange={update("name")}
          error={errors.name}
        />


        <TextAreaField
          label="Description"
          value={form.description}
          onChange={update("description")}
          error={errors.description}
          rows={3}
        />


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


        <SelectField
          label="Category"
          value={form.category}
          onChange={update("category")}
          error={errors.category}
          options={categories.map((c) => ({
            value: c.name,
            label: c.name,
          }))}
        />


        <FileUpload
          label="Meal image"
          accept="image/*"
          onFileSelect={(file) =>
            setImageFile(file)
          }
        />


        <label className="flex items-center gap-2">

          <input
            type="checkbox"
            checked={form.available}
            onChange={update("available")}
            className="h-4 w-4 rounded border-line accent-ink"
          />

          Available

        </label>


        <label className="flex items-center gap-2">

          <input
            type="checkbox"
            checked={form.featured}
            onChange={update("featured")}
            className="h-4 w-4 rounded border-line accent-ink"
          />

          Featured

        </label>


        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full"
        >

          {saving
            ? "Saving..."
            : meal
            ? "Save changes"
            : "Add meal"}

        </button>


      </form>

    </Modal>

  );

}
