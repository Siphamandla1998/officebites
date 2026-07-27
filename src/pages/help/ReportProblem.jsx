import { useState } from "react";
import Navbar from "../../components/layout/Navbar";
import TextAreaField from "../../components/forms/TextAreaField";
import SelectField from "../../components/forms/SelectField";
import FileUpload from "../../components/forms/FileUpload";
import Spinner from "../../components/ui/Spinner";
import TicketSubmittedPanel from "../../components/features/TicketSubmittedPanel";
import { supportService } from "../../services/supportService";
import { useToast } from "../../context/ToastContext";
import { TICKET_PRIORITY } from "../../utils/constants";

const PROBLEM_TYPES = [
  "Payment Issue",
  "App Bug",
  "Order Problem",
  "Vendor Complaint",
  "Customer Complaint",
  "Technical Error",
  "Feature Request",
];

// Best-effort device/browser detection for the report — purely informational,
// never blocks submission if unavailable.
function detectEnvironment() {
  if (typeof navigator === "undefined") return { device: "Unknown", browser: "Unknown", os: "Unknown" };
  const ua = navigator.userAgent;
  const device = /Mobi|Android/i.test(ua) ? "Mobile" : "Desktop";
  const browser = /Chrome/i.test(ua) ? "Chrome" : /Firefox/i.test(ua) ? "Firefox" : /Safari/i.test(ua) ? "Safari" : "Other";
  const os = /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "macOS" : /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : "Other";
  return { device, browser, os };
}

export default function ReportProblem() {
  const { showToast } = useToast();
  const env = detectEnvironment();
  const [form, setForm] = useState({ type: PROBLEM_TYPES[0], description: "", priority: TICKET_PRIORITY.MEDIUM });
  const [errors, setErrors] = useState({});
  const [screenshot, setScreenshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [ticket, setTicket] = useState(null);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.description.trim() || form.description.trim().length < 10)
      next.description = "Please describe the problem (at least 10 characters)";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const created = await supportService.reportProblem({ ...form, ...env, hasScreenshot: !!screenshot });
      setTicket(created);
      showToast("Problem reported", { type: "success" });
    } catch (err) {
      showToast(err.message || "Couldn't submit your report", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-8">
      <Navbar showBack title="Report a Problem" showCart={false} />
      <div className="ob-container pt-4">
        {ticket ? (
          <TicketSubmittedPanel ticket={ticket} />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <SelectField
              label="What's the problem?"
              value={form.type}
              onChange={update("type")}
              options={PROBLEM_TYPES.map((t) => ({ value: t, label: t }))}
            />
            <TextAreaField
              label="Description"
              value={form.description}
              onChange={update("description")}
              error={errors.description}
              rows={5}
              placeholder="Tell us what happened..."
            />
            <SelectField
              label="Priority"
              value={form.priority}
              onChange={update("priority")}
              options={[
                { value: TICKET_PRIORITY.LOW, label: "Low" },
                { value: TICKET_PRIORITY.MEDIUM, label: "Medium" },
                { value: TICKET_PRIORITY.HIGH, label: "High" },
              ]}
            />
            <FileUpload label="Screenshot (optional)" onFileSelect={setScreenshot} />
            <div className="rounded-xl bg-nude-50 p-3 text-xs text-ink-muted flex flex-col gap-1">
              <span>Device: <span className="text-ink-soft font-medium">{env.device}</span></span>
              <span>Browser: <span className="text-ink-soft font-medium">{env.browser}</span></span>
              <span>OS: <span className="text-ink-soft font-medium">{env.os}</span></span>
              <span className="mt-1">This is captured automatically to help us debug faster.</span>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? <Spinner size={16} className="!border-paper/30 !border-t-paper" /> : "Submit report"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
