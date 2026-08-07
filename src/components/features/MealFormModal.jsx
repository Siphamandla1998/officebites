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
      e.target?.type === "checkbox"
        ? e.target.checked
        : e.target.value;

    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };


  const validate = () => {

    const next = {};

    if (!form.name.trim())
      next.name = "Meal name is required";

    if (!form.description.trim())
      next.description = "Description required";

    if (!form.price || Number(form.price)<=0)
      next.price = "Enter valid price";

    if (!form.preparationTime)
      next.preparationTime="Preparation time required";


    setErrors(next);

    return Object.keys(next).length===0;
  };


  const submit = (e)=>{
    e.preventDefault();

    if(!validate()) return;


    onSave({
      ...form,
      price:Number(form.price),
      preparationTime:Number(form.preparationTime),
      imageFile
    });

  };


  return (
    <Modal
      open={open}
      onClose={onClose}
      title={meal ? "Edit meal":"Add meal"}
    >

<form onSubmit={submit} className="space-y-4">


<FileUpload
label="Meal image"
accept="image/*"
onFileSelect={setImageFile}
/>


<TextField
label="Meal name"
value={form.name}
onChange={update("name")}
error={errors.name}
/>


<TextAreaField
label="Description"
rows={3}
value={form.description}
onChange={update("description")}
error={errors.description}
/>


<TextField
label="Price (R)"
type="number"
value={form.price}
onChange={update("price")}
error={errors.price}
/>


<TextField
label="Preparation time (minutes)"
type="number"
value={form.preparationTime}
onChange={update("preparationTime")}
error={errors.preparationTime}
/>


<SelectField
label="Category"
value={form.category}
onChange={update("category")}
options={
categories.map(c=>({
value:c.name,
label:c.name
}))
}
/>


<label className="flex gap-2">
<input
type="checkbox"
checked={form.available}
onChange={update("available")}
/>
Available
</label>


<label className="flex gap-2">
<input
type="checkbox"
checked={form.featured}
onChange={update("featured")}
/>
Featured
</label>


<button
disabled={saving}
className="btn-primary w-full"
>
{
saving
?"Saving..."
:meal
?"Save changes"
:"Add meal"
}
</button>


</form>

    </Modal>
  );
}
