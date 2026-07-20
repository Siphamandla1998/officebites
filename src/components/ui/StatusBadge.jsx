import { ORDER_STATUS, ORDER_STATUS_LABELS, VENDOR_STATUS } from "../../utils/constants";

const STYLES = {
  [ORDER_STATUS.PENDING_PAYMENT]: "bg-nude-100 text-nude-700",
  [ORDER_STATUS.PAYMENT_SUBMITTED]: "bg-info/10 text-info",
  [ORDER_STATUS.CONFIRMED]: "bg-success/10 text-success",
  [ORDER_STATUS.PREPARING]: "bg-warning/10 text-warning",
  [ORDER_STATUS.READY]: "bg-nude-500/15 text-nude-700",
  [ORDER_STATUS.COMPLETED]: "bg-ink/5 text-ink-soft",
  [ORDER_STATUS.CANCELLED]: "bg-danger/10 text-danger",
  [VENDOR_STATUS.PENDING]: "bg-warning/10 text-warning",
  [VENDOR_STATUS.APPROVED]: "bg-success/10 text-success",
  [VENDOR_STATUS.SUSPENDED]: "bg-danger/10 text-danger",
  [VENDOR_STATUS.REJECTED]: "bg-danger/10 text-danger",
};

const LABELS = {
  ...ORDER_STATUS_LABELS,
  [VENDOR_STATUS.PENDING]: "Pending review",
  [VENDOR_STATUS.APPROVED]: "Approved",
  [VENDOR_STATUS.SUSPENDED]: "Suspended",
  [VENDOR_STATUS.REJECTED]: "Rejected",
};

export default function StatusBadge({ status, className = "" }) {
  return (
    <span className={`badge ${STYLES[status] || "bg-nude-100 text-ink-soft"} ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {LABELS[status] || status}
    </span>
  );
}
