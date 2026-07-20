import { ORDER_STATUS } from "../utils/constants";

export const orders = [
  {
    id: "o-1001",
    ticketNumber: "OB-202607-4821",
    customerId: "u-1",
    customerName: "Lindiwe Zulu",
    deliveryDate: "2026-07-18",
    status: ORDER_STATUS.CONFIRMED,
    createdAt: "2026-07-17T14:22:00",
    subOrders: [
      {
        vendorId: "v-1",
        vendorName: "Mama Thandi's Kitchen",
        items: [{ mealId: "m-1", name: "Umngqusho with Beef Stew", qty: 1, price: 65 }],
        status: ORDER_STATUS.CONFIRMED,
        subtotal: 65,
      },
      {
        vendorId: "v-4",
        vendorName: "Curry Corner",
        items: [{ mealId: "m-7", name: "Durban Bunny Chow (Mutton)", qty: 1, price: 85 }],
        status: ORDER_STATUS.PREPARING,
        subtotal: 85,
      },
    ],
    total: 150,
    paymentProof: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=60",
  },
  {
    id: "o-1002",
    ticketNumber: "OB-202607-1187",
    customerId: "u-1",
    customerName: "Lindiwe Zulu",
    deliveryDate: "2026-07-16",
    status: ORDER_STATUS.COMPLETED,
    createdAt: "2026-07-15T11:03:00",
    subOrders: [
      {
        vendorId: "v-2",
        vendorName: "Braai Brothers",
        items: [{ mealId: "m-3", name: "Braai Chicken Quarter Combo", qty: 2, price: 72 }],
        status: ORDER_STATUS.COMPLETED,
        subtotal: 144,
      },
    ],
    total: 144,
    paymentProof: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=60",
  },
  {
    id: "o-1003",
    ticketNumber: "OB-202607-9034",
    customerId: "u-4",
    customerName: "Kabelo Nkosi",
    deliveryDate: "2026-07-18",
    status: ORDER_STATUS.PAYMENT_SUBMITTED,
    createdAt: "2026-07-17T18:41:00",
    subOrders: [
      {
        vendorId: "v-1",
        vendorName: "Mama Thandi's Kitchen",
        items: [{ mealId: "m-2", name: "Pap, Chakalaka & Boerewors", qty: 3, price: 58 }],
        status: ORDER_STATUS.PAYMENT_SUBMITTED,
        subtotal: 174,
      },
    ],
    total: 174,
    paymentProof: null,
  },
];
