import { FiCheckCircle } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

export default function TicketSubmittedPanel({ ticket }) {
  const navigate = useNavigate();
  return (
    <div className="card p-6 flex flex-col items-center text-center gap-3">
      <div className="h-12 w-12 rounded-full bg-success/10 text-success flex items-center justify-center">
        <FiCheckCircle size={22} />
      </div>
      <h3 className="text-base font-semibold text-ink">We've got your request</h3>
      <p className="text-sm text-ink-muted">
        Your ticket number is
        <span className="block text-lg font-bold text-ink mt-1">{ticket.ticketNumber}</span>
      </p>
      <p className="text-xs text-ink-muted">
        Our support team will follow up by email, or you can track progress in your tickets.
      </p>
      <div className="flex gap-2.5 w-full mt-1">
        <button onClick={() => navigate("/help/tickets")} className="btn-outline flex-1">
          View tickets
        </button>
        <button onClick={() => navigate("/help")} className="btn-primary flex-1">
          Done
        </button>
      </div>
    </div>
  );
}
