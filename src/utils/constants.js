// Central place for brand + business-rule constants.
// Keep business logic values here so they're never "magic numbers" in components.

export const APP_NAME = "OfficeBites";

export const ROLES = {
  CUSTOMER: "customer",
  VENDOR: "vendor",
  ADMIN: "admin",
};

// Orders close at 19:00 the previous day (business rule from product doc).
export const ORDER_CUTOFF_HOUR = 19;

export const ORDER_STATUS = {
  PENDING_PAYMENT: "pending_payment",
  PAYMENT_SUBMITTED: "payment_submitted",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const ORDER_STATUS_LABELS = {
  [ORDER_STATUS.PENDING_PAYMENT]: "Awaiting payment",
  [ORDER_STATUS.PAYMENT_SUBMITTED]: "Verifying payment",
  [ORDER_STATUS.CONFIRMED]: "Confirmed",
  [ORDER_STATUS.PREPARING]: "Preparing",
  [ORDER_STATUS.READY]: "Ready",
  [ORDER_STATUS.COMPLETED]: "Completed",
  [ORDER_STATUS.CANCELLED]: "Cancelled",
};

export const VENDOR_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  SUSPENDED: "suspended",
  REJECTED: "rejected",
};

export const COMMISSION_RATE = 0.1; // OfficeBites takes 10% per completed order

export const CURRENCY = "R";
