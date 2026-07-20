export const FAQ_CATEGORIES = [
  "Ordering",
  "Payments",
  "Collections",
  "Vendor Accounts",
  "Customer Accounts",
  "Technical Issues",
];

export const faqs = [
  {
    id: "faq-1",
    category: "Ordering",
    question: "How late can I place an order?",
    answer:
      "Ordering closes at 19:00 the day before your chosen delivery date. Once the cutoff passes, that day's menu locks and your order moves to the next available delivery day.",
  },
  {
    id: "faq-2",
    category: "Ordering",
    question: "Can I order from more than one vendor at once?",
    answer:
      "Yes. Add meals from as many vendors as you like — checkout is a single experience, but OfficeBites splits your order behind the scenes so each vendor only sees their own items.",
  },
  {
    id: "faq-3",
    category: "Payments",
    question: "How do I pay for my order?",
    answer:
      "After checkout you'll see OfficeBites' bank details and a reference number. Pay by EFT, then upload a screenshot of your payment as proof — we verify it and confirm your order.",
  },
  {
    id: "faq-4",
    category: "Payments",
    question: "How long does payment verification take?",
    answer:
      "Most payments are verified within a couple of hours during business hours. You'll get a notification the moment your order is confirmed.",
  },
  {
    id: "faq-5",
    category: "Collections",
    question: "Where do I collect my order?",
    answer:
      "Your order ticket shows the vendor and collection time for each item. Head to the vendor's stand in your building at the time shown and quote your ticket number.",
  },
  {
    id: "faq-6",
    category: "Collections",
    question: "What if I miss my collection time?",
    answer:
      "Message the vendor directly from your order tracking page — most vendors will hold a confirmed order for a short grace period.",
  },
  {
    id: "faq-7",
    category: "Vendor Accounts",
    question: "How do I become a vendor on OfficeBites?",
    answer:
      "Register for a vendor account and our admin team will review your application. Once approved, you can add your menu and start receiving orders.",
  },
  {
    id: "faq-8",
    category: "Vendor Accounts",
    question: "Can I reject a confirmed order?",
    answer:
      "No — once OfficeBites has verified payment and confirmed an order, it can't be rejected. You can move it through Accepted → Preparing → Ready → Collected → Completed.",
  },
  {
    id: "faq-9",
    category: "Customer Accounts",
    question: "How do I change my delivery building?",
    answer: "Go to Profile → Delivery building and update it — this changes which vendors you see by default.",
  },
  {
    id: "faq-10",
    category: "Technical Issues",
    question: "The app isn't loading my menu — what do I do?",
    answer:
      "OfficeBites works offline for menus you've already viewed. If a menu won't load at all, check your connection and refresh — if it persists, report a problem from the Help Centre.",
  },
];

export const guides = [
  {
    id: "guide-1",
    title: "How to Place an Order",
    summary: "Browse vendors, build your cart, and check out in a few taps.",
    body: "Browse categories or vendors from Home, add meals to your cart from any vendor, and repeat across as many vendors as you like. When you're ready, open your cart and tap Checkout. Your order is split automatically so each vendor only sees their own items — you just get one ticket.",
  },
  {
    id: "guide-2",
    title: "How Collection Works",
    summary: "What to expect when your order is ready.",
    body: "Each vendor on your order sets a collection time, shown on your ticket. Track your order's status in real time from Order Tracking — once it says Ready, head to the vendor's stand and quote your ticket number to collect.",
  },
  {
    id: "guide-3",
    title: "How Vendors Accept Orders",
    summary: "The order pipeline vendors follow, step by step.",
    body: "Once OfficeBites confirms payment, a vendor accepts the order, marks it Preparing, then Ready once it's packed, and finally Collected and Completed once the customer has it. A confirmed order can never be rejected — only moved forward.",
  },
  {
    id: "guide-4",
    title: "Payment Guide",
    summary: "How to pay for your order and get it verified.",
    body: "After checkout, you'll see OfficeBites' bank details and a unique reference number — always use your ticket number as the payment reference. Upload a screenshot of your proof of payment and we'll verify it, usually within a couple of hours.",
  },
  {
    id: "guide-5",
    title: "Refund Process",
    summary: "What happens if something goes wrong with your order.",
    body: "If a vendor can't fulfil part of your order, contact support with your ticket number. Approved refunds are processed back to the original payment method — most refunds are completed within 3–5 business days.",
  },
  {
    id: "guide-6",
    title: "Managing Your Account",
    summary: "Update your details, building, and preferences.",
    body: "Head to Profile to update your delivery building, view order history, manage favourite meals, and message vendors directly. Vendors can manage their business details from Vendor Dashboard → Settings.",
  },
];

export const initialTickets = [
  {
    id: "t-1",
    ticketNumber: "SUP-2026-000198",
    subject: "Payment not verified after 3 hours",
    category: "Payments",
    priority: "high",
    status: "resolved",
    createdAt: "2026-07-14T10:12:00",
    messages: [
      { id: 1, sender: "user", text: "My payment for OB-202607-1187 hasn't been verified yet.", time: "2026-07-14T10:12:00" },
      { id: 2, sender: "support", text: "Thanks for flagging — we've verified it now, your order is confirmed!", time: "2026-07-14T11:40:00" },
    ],
  },
  {
    id: "t-2",
    ticketNumber: "SUP-2026-000221",
    subject: "Wrong item in my order",
    category: "Ordering",
    priority: "medium",
    status: "open",
    createdAt: "2026-07-17T09:30:00",
    messages: [
      { id: 1, sender: "user", text: "I received a Regular Kota instead of a Special Kota.", time: "2026-07-17T09:30:00" },
    ],
  },
];
