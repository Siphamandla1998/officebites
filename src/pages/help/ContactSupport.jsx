import { useState } from "react";
import Navbar from "../../components/layout/Navbar";
import TextField from "../../components/forms/TextField";
import TextAreaField from "../../components/forms/TextAreaField";
import SelectField from "../../components/forms/SelectField";
import FileUpload from "../../components/forms/FileUpload";
import Spinner from "../../components/ui/Spinner";
import TicketSubmittedPanel from "../../components/features/TicketSubmittedPanel";
import { supportService, FAQ_CATEGORIES } from "../../services/supportService";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";


export default function ContactSupport() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    subject: "",
    category: FAQ_CATEGORIES[0],
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [attachment, setAttachment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState(null);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!form.email.trim() || !form.email.includes("@")) next.email = "Enter a valid email";
    if (!form.subject.trim()) next.subject = "Subject is required";
    if (!form.message.trim() || form.message.trim().length < 10)
      next.message = "Please describe your issue (at least 10 characters)";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const created = await supportService.submitContactForm({ ...form, attachment });
      setTicket(created);
      showToast("Support ticket created", { type: "success" });
    } catch (err) {
      showToast(err.message || "Couldn't submit your request", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-8">
      <Navbar showBack title="Contact Support" showCart={false} />
      <div className="ob-container pt-4">
        {ticket ? (
          <TicketSubmittedPanel ticket={ticket} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField label="Name" value={form.name} onChange={update("name")} error={errors.name} />
            <TextField label="Email" type="email" value={form.email} onChange={update("email")} error={errors.email} />
            <TextField label="Subject" value={form.subject} onChange={update("subject")} error={errors.subject} />
            <SelectField
              label="Category"
              value={form.category}
              onChange={update("category")}
              options={FAQ_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
            <TextAreaField
              label="Message"
              value={form.message}
              onChange={update("message")}
              error={errors.message}
              rows={5}
            />
            <FileUpload label="Attachment (optional)" onFileSelect={setAttachment} />
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? <Spinner size={16} className="!border-paper/30 !border-t-paper" /> : "Submit request"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
