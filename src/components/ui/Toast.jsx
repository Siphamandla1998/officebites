import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from "react-icons/fi";

const ICONS = {
  success: <FiCheckCircle className="text-success shrink-0" size={18} />,
  error: <FiAlertCircle className="text-danger shrink-0" size={18} />,
  info: <FiInfo className="text-info shrink-0" size={18} />,
  default: <FiInfo className="text-ink-soft shrink-0" size={18} />,
};

export default function Toast({ message, type = "default", onDismiss }) {
  return (
    <div
      className="pointer-events-auto flex items-center gap-2.5 rounded-xl bg-ink text-paper px-4 py-3 shadow-float animate-toast-in"
      role="status"
    >
      {ICONS[type] || ICONS.default}
      <p className="text-sm flex-1">{message}</p>
      <button onClick={onDismiss} className="text-paper/60 hover:text-paper" aria-label="Dismiss">
        <FiX size={16} />
      </button>
    </div>
  );
}
