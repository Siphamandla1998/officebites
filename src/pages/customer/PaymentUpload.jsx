import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiCopy, FiCreditCard } from "react-icons/fi";
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
  const [method, setMethod] = useState("payfast");
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [payfastLoading, setPayfastLoading] = useState(false);

  const { data: order, loading } = useAsync(() => orderService.getOrderById(orderId), [orderId]);
  const { data: bank } = useAsync(() => paymentService.getBankDetails(), []);

  const copyRef = () => {
    if (order) {
      navigator.clipboard?.writeText(order.ticketNumber);
      showToast("Reference copied", { type: "info" });
    }
  };

  const handlePayfast = async () => {
    setPayfastLoading(true);
    try {
      const { processUrl, fields } = await paymentService.initiatePayfastPayment(orderId);
      // Real browser navigation to PayFast, not a fetch redirect — the
      // frontend never sees or handles a "success" from this, that only
      // ever comes back through the server-side ITN.
      paymentService.redirectToPayfast({ processUrl, fields });
    } catch (err) {
      showToast(err.message || "Couldn't start PayFast payment", { type: "error" });
      setPayfastLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!file) {
      showToast("Please attach a screenshot of your payment", { type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      const { path } = await paymentService.uploadProof(file, orderId);
      await orderService.attachPaymentProof(orderId, path);
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
      <Navbar showBack title="Payment" showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-5">
        <div className="flex justify-between pt-1 pb-1">
          <span className="text-sm font-semibold text-ink">Amount due</span>
          <span className="text-base font-bold text-ink">{formatCurrency(order.total)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-nude-50 p-1">
          <button
            onClick={() => setMethod("payfast")}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              method === "payfast" ? "bg-paper shadow-sm text-ink" : "text-ink-muted"
            }`}
          >
            Pay with PayFast
          </button>
          <button
            onClick={() => setMethod("manual_eft")}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              method === "manual_eft" ? "bg-paper shadow-sm text-ink" : "text-ink-muted"
            }`}
          >
            Manual EFT
          </button>
        </div>

        {method === "payfast" ? (
          <div className="card p-4 flex flex-col gap-3">
            <div className="h-9 w-9 rounded-lg bg-nude-100 text-nude-700 flex items-center justify-center">
              <FiCreditCard size={16} />
            </div>
            <p className="text-sm font-semibold text-ink">Pay securely with PayFast</p>
            <p className="text-xs text-ink-muted">
              You'll be redirected to PayFast to complete payment by card or instant EFT. Your order is
              confirmed automatically the moment PayFast confirms the payment — there's nothing further
              to upload.
            </p>
            <button onClick={handlePayfast} className="btn-primary w-full" disabled={payfastLoading}>
              {payfastLoading ? (
                <Spinner size={16} className="!border-paper/30 !border-t-paper" />
              ) : (
                `Pay ${formatCurrency(order.total)} with PayFast`
              )}
            </button>
          </div>
        ) : (
          <>
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
              <p className="text-xs text-ink-muted pt-1">
                After paying, upload a screenshot below. OfficeBites will verify it and confirm your
                order — this is not automatic.
              </p>
            </div>

            <FileUpload onFileSelect={setFile} />

            <button onClick={handleManualSubmit} className="btn-primary w-full" disabled={submitting}>
              {submitting ? (
                <Spinner size={16} className="!border-paper/30 !border-t-paper" />
              ) : (
                "Submit for verification"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
