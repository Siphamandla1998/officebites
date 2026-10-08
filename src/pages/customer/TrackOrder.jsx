import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import TextField from "../../components/forms/TextField";
import Spinner from "../../components/ui/Spinner";
import { orderService } from "../../services/orderService";
import { useToast } from "../../context/ToastContext";
import { addGuestOrder } from "../../utils/guest";

export default function TrackOrder() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [ticketNumber, setTicketNumber] = useState("");
  const [contact, setContact] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const next = {};

    if (!ticketNumber.trim()) {
      next.ticketNumber = "Enter your order code";
    }

    if (!contact.trim()) {
      next.contact =
        "Enter the phone number you gave at checkout";
    }

    setErrors(next);

    if (Object.keys(next).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const cleanTicketNumber = ticketNumber.trim();
      const cleanContact = contact.trim();

      const order =
        await orderService.trackGuestOrder(
          cleanTicketNumber,
          cleanContact
        );

      if (!order) {
        showToast(
          "We couldn't find an order matching those details",
          { type: "error" }
        );
        return;
      }

      // Store the secure lookup information locally so this
      // device can reopen the guest order later without relying
      // on the order UUID as proof of access.
      addGuestOrder({
        id: order.id,
        ticketNumber: order.ticketNumber,
        contact: cleanContact,
      });

      navigate(`/orders/${order.id}`);
    } catch (err) {
      showToast(
        err.message || "Couldn't look up that order",
        { type: "error" }
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-8">
      <Navbar
        showBack
        title="Track your order"
        showCart={false}
      />

      <div className="ob-container pt-4 flex flex-col gap-5">
        <div className="card p-4 flex flex-col gap-2">
          <div className="h-9 w-9 rounded-lg bg-nude-100 text-nude-700 flex items-center justify-center">
            <FiSearch size={16} />
          </div>

          <p className="text-sm font-semibold text-ink">
            Find an order from another device
          </p>

          <p className="text-xs text-ink-muted">
            Enter your order code and the phone number you
            gave at checkout. We'll match both before showing
            your order.
          </p>
        </div>

        <div className="card p-4 flex flex-col gap-3">
          <TextField
            label="Order code"
            value={ticketNumber}
            onChange={(e) =>
              setTicketNumber(e.target.value)
            }
            error={errors.ticketNumber}
            placeholder="e.g. OB-7F42KQ"
          />

          <TextField
            label="Phone number used at checkout"
            value={contact}
            onChange={(e) =>
              setContact(e.target.value)
            }
            error={errors.contact}
            placeholder="So we can confirm it's your order"
          />
        </div>

        <button
          onClick={handleSubmit}
          className="btn-primary w-full"
          disabled={submitting}
        >
          {submitting ? (
            <Spinner
              size={16}
              className="!border-paper/30 !border-t-paper"
            />
          ) : (
            "Find my order"
          )}
        </button>
      </div>
    </div>
  );
}