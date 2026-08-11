import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiCopy } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import FileUpload from "../../components/forms/FileUpload";
import Spinner from "../../components/ui/Spinner";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { paymentService } from "../../services/paymentService";
import { useToast } from "../../context/ToastContext";
import { formatCurrency } from "../../utils/formatters";

export default function PaymentUpload() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: order, loading } = useAsync(() => orderService.getOrderById(orderId), [orderId]);
  const { data: bank } = useAsync(() => paymentService.getBankDetails(), []);

  const copyRef = () => {
    if (order) {
      navigator.clipboard?.writeText(order.ticketNumber);
      showToast("Reference copied", { type: "info" });
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      showToast("Please attach a screenshot of your payment", { type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const { path } = await paymentService.uploadProof(file, orderId);
      await orderService.attachPaymentProof(orderId, path, order.ticketNumber);
      showToast("Payment submitted for verification", { type: "success" });
      navigate(`/orders/${orderId}/ticket`);
    } catch (err) {
      showToast(err.message || "Upload failed", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !order || !bank) {
    return (
      <div>
        <Navbar showBack title="Payment" showCart={false} />
        <div className="ob-container pt-4"><div className="skeleton h-48" /></div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <Navbar showBack title="Upload payment" showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-5">
        <div className="card p-4 flex flex-col gap-2.5">
          <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">Pay via EFT</p>
          {[
            ["Account name", bank.accountName],
            ["Bank", bank.bank],
            ["Account number", bank.accountNumber],
            ["Branch code", bank.branchCode],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-ink-muted">{label}</span>
              <span className="font-medium text-ink">{value}</span>
            </div>
          ))}
          <button
            onClick={copyRef}
            className="mt-2 flex items-center justify-between rounded-xl bg-nude-50 px-3.5 py-2.5"
          >
            <span className="text-sm">
              <span className="text-ink-muted">Reference: </span>
              <span className="font-semibold text-ink">{order.ticketNumber}</span>
            </span>
            <FiCopy size={14} className="text-ink-muted" />
          </button>
          <div className="flex justify-between pt-2 border-t border-line">
            <span className="text-sm font-semibold text-ink">Amount due</span>
            <span className="text-base font-bold text-ink">{formatCurrency(order.total)}</span>
          </div>
        </div>

        <FileUpload onFileSelect={setFile} />

        <button onClick={handleSubmit} className="btn-primary w-full" disabled={submitting}>
          {submitting ? (
            <Spinner size={16} className="!border-paper/30 !border-t-paper" />
          ) : (
            "Submit for verification"
          )}
        </button>
      </div>
    </div>
  );
}
