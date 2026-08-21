import { useEffect, useState } from "react";

import Modal from "../ui/Modal";
import TextField from "../forms/TextField";
import TextAreaField from "../forms/TextAreaField";
import SelectField from "../forms/SelectField";

const DEFAULT_CATEGORIES = [
  { name: "Meals" },
  { name: "Drinks" },
  { name: "Snacks" },
  { name: "Desserts" },
];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABELS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
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
  availableDays: ALL_DAYS,
};

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
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    if (meal) {
      setForm({
        name: meal.name || "",
        description: meal.description || "",
        price: meal.price ?? "",
        category: meal.category || "Meals",
        preparationTime: meal.preparationTime ?? "",
        available: meal.available ?? true,
        featured: meal.featured ?? false,
        image: meal.image || "",
        availableDays: meal.availableDays || ALL_DAYS,
      });

      setPreview(meal.image || "");
    } else {
      setForm({ ...EMPTY_FORM });
      setPreview("");
    }

    setImageFile(null);
    setErrors({});
  }, [open, meal]);

  const update = (key) => (event) => {
    const value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;

    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const toggleDay = (day) => {
    setForm((previous) => {
      const has = previous.availableDays.includes(day);
      const next = has
        ? previous.availableDays.filter((d) => d !== day)
        : [...previous.availableDays, day].sort();
      return { ...previous, availableDays: next };
    });
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrors((previous) => ({
        ...previous,
        image: "Only image files are allowed.",
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors((previous) => ({
        ...previous,
        image: "Image must be smaller than 5MB.",
      }));
      return;
    }

    setErrors((previous) => ({
      ...previous,
      image: "",
    }));

    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    const nextErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = "Meal name is required.";
    }

    if (!form.description.trim()) {
      nextErrors.description =
        "Add a short description.";
    }

    if (
      form.price === "" ||
      form.price === null ||
      Number(form.price) <= 0
    ) {
      nextErrors.price = "Enter a valid price.";
    }

    if (!form.category) {
      nextErrors.category = "Choose a category.";
    }

    if (form.availableDays.length === 0) {
      nextErrors.availableDays = "Select at least one day.";
    }

    if (
      form.preparationTime === "" ||
      Number(form.preparationTime) <= 0
    ) {
      nextErrors.preparationTime =
        "Enter preparation time.";
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    await onSave({
      ...form,
      price: Number(form.price),
      preparationTime: Number(form.preparationTime),
      imageFile: imageFile || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={meal ? "Edit meal" : "Add meal"}
    >
      <form
        onSubmit={submit}
        className="space-y-4"
      >
        <TextField
          label="Name"
          value={form.name}
          onChange={update("name")}
          error={errors.name}
          required
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
          required
        />

        <TextField
          label="Preparation time (minutes)"
          type="number"
          min="1"
          value={form.preparationTime}
          onChange={update("preparationTime")}
          error={errors.preparationTime}
          required
        />

        <SelectField
          label="Category"
          value={form.category}
          onChange={update("category")}
          error={errors.category}
          options={categories.map((category) => ({
            value: category.name,
            label: category.name,
          }))}
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium">
            Available on
          </label>
          <p className="text-xs text-ink-muted -mt-1">
            Which days do you cook this? Leave all selected if it's available every day.
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {DAY_LABELS.map((day) => {
              const active = form.availableDays.includes(day.value);
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    active
                      ? "bg-ink text-paper border-ink"
                      : "bg-transparent text-ink-muted border-line"
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
          {form.availableDays.length === 0 && (
            <p className="text-xs text-danger">
              Select at least one day, or this meal won't be orderable.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="meal-image"
            className="block text-sm font-medium"
          >
            Meal image
          </label>

          <input
            id="meal-image"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm"
          />

          {errors.image && (
            <p className="text-sm text-danger">
              {errors.image}
            </p>
          )}

          {preview && (
            <img
              src={preview}
              alt="Meal preview"
              className="mt-3 h-40 w-full rounded-lg object-cover"
            />
          )}
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.available}
            onChange={update("available")}
            className="h-4 w-4"
          />

          <span className="text-sm">
            Available for customers
          </span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.featured}
            onChange={update("featured")}
            className="h-4 w-4"
          />

          <span className="text-sm">
            Featured meal
          </span>
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex-1"
          >
            {saving
              ? "Saving..."
              : meal
                ? "Save changes"
                : "Add meal"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
