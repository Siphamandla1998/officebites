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


// ===============================
// ORDER LIFECYCLE
// ===============================

export const ORDER_STATUS = {
  PENDING_PAYMENT: "pending_payment",
  PAYMENT_SUBMITTED: "payment_submitted",
  CONFIRMED: "confirmed",
  ACCEPTED: "accepted",
  PREPARING: "preparing",
  READY: "ready",
  COLLECTED: "collected",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};


export const ORDER_STATUS_LABELS = {
  [ORDER_STATUS.PENDING_PAYMENT]: "Awaiting payment",
  [ORDER_STATUS.PAYMENT_SUBMITTED]: "Verifying payment",
  [ORDER_STATUS.CONFIRMED]: "Confirmed",
  [ORDER_STATUS.ACCEPTED]: "Accepted",
  [ORDER_STATUS.PREPARING]: "Preparing",
  [ORDER_STATUS.READY]: "Ready for collection",
  [ORDER_STATUS.COLLECTED]: "Collected",
  [ORDER_STATUS.COMPLETED]: "Completed",
  [ORDER_STATUS.CANCELLED]: "Cancelled",
};


// Vendor order progression
export const VENDOR_ORDER_FLOW = [
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.ACCEPTED,
  ORDER_STATUS.PREPARING,
  ORDER_STATUS.READY,
  ORDER_STATUS.COLLECTED,
  ORDER_STATUS.COMPLETED,
];


export const VENDOR_ORDER_ACTION_LABELS = {
  [ORDER_STATUS.ACCEPTED]: "Accept order",
  [ORDER_STATUS.PREPARING]: "Start preparing",
  [ORDER_STATUS.READY]: "Mark ready",
  [ORDER_STATUS.COLLECTED]: "Mark collected",
  [ORDER_STATUS.COMPLETED]: "Complete order",
};


// ===============================
// PAYMENT
// ===============================

export const PAYMENT_STATUS = {
  UNPAID: "unpaid",
  VERIFYING: "verifying",
  PAID: "paid",
};


// ===============================
// VENDOR
// ===============================

export const VENDOR_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  SUSPENDED: "suspended",
  REJECTED: "rejected",
};


// ===============================
// OFFICEBITES FEES
// ===============================

// Percentage OfficeBites keeps from vendor sales
// Example: R100 meal order = R15 commission
export const COMMISSION_RATE = 0.15;


// Payment gateway / transaction processing fee
// Example: R100 order = R2.50 transaction fee
export const TRANSACTION_FEE_RATE = 0.025;


// Total platform deduction
// Commission + payment processing
export const PLATFORM_FEE_RATE =
  COMMISSION_RATE + TRANSACTION_FEE_RATE;


// Currency
export const CURRENCY = "R";


// ===============================
// SUPPORT TICKETS
// ===============================

export const TICKET_STATUS = {
  OPEN: "open",
  PENDING: "pending",
  RESOLVED: "resolved",
};


export const TICKET_STATUS_LABELS = {
  [TICKET_STATUS.OPEN]: "Open",
  [TICKET_STATUS.PENDING]: "Pending",
  [TICKET_STATUS.RESOLVED]: "Resolved",
};


export const TICKET_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};
