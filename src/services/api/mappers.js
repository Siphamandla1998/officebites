// Converts Supabase's snake_case rows (and nested relations) into the exact
// camelCase shapes every page/component already expects from the old mock
// data. Centralized here so foodService, vendorService, and orderService
// never disagree on what a "meal" or "vendor" object looks like.

export function mapVendor(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    tagline: row.tagline,
    category: row.category,
    rating: Number(row.rating) || 0,
    reviewCount: row.review_count || 0,
    prepTimeMins: row.prep_time_mins,
    coverImage: row.cover_image,
    logo: row.logo,
    building: row.building,
    status: row.status,
    featured: row.featured,
    subscriptionTier: row.subscription_tier,
    contactNumber: row.contact_number,
    email: row.email,
    address: row.address,
    deliveryRadius: row.delivery_radius,
    operatingHours: row.operating_hours,
    joinedAt: row.created_at,
  };
}

export function mapMeal(row) {
  if (!row) return null;
  return {
    id: row.id,
    vendorId: row.vendor_id,
    vendorName: row.vendors?.name || row.vendor_name || "",
    name: row.name,
    description: row.description,
    price: Number(row.price),
    image: row.image,
    category: row.category,
    tags: row.tags || [],
    available: row.available,
    featured: row.featured,
    preparationTime: row.preparation_time,
    rating: Number(row.rating) || 0,
    reviewCount: row.review_count || 0,
  };
}

export function mapReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    vendorId: row.vendor_id,
    mealId: row.meal_id,
    customerName: row.customer_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

/** Maps a fully-nested order row (with order_suborders -> order_items -> vendors) to the mock shape. */
export function mapOrder(row) {
  if (!row) return null;
  const subOrders = (row.order_suborders || []).map((so) => ({
    vendorId: so.vendor_id,
    vendorName: so.vendors?.name || "",
    status: so.status,
    paymentStatus: so.payment_status,
    subtotal: Number(so.subtotal),
    collectionTime: so.collection_time || "",
    notes: so.notes || "",
    items: (so.order_items || []).map((item) => ({
      mealId: item.meal_id,
      name: item.meal_name,
      qty: item.qty,
      price: Number(item.price),
    })),
  }));

  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    customerId: row.customer_id,
    customerName: row.profiles?.name || row.guest_name || "Guest",
    deliveryDate: row.delivery_date,
    status: row.status,
    createdAt: row.created_at,
    subOrders,
    total: Number(row.total),
    paymentProof: row.payment_proof_url,
  };
}

// Nested select strings, kept in one place so every query asking for a full
// order shape stays in sync with mapOrder() above.
export const ORDER_SELECT = `
  id, ticket_number, customer_id, guest_name, guest_contact, delivery_date,
  status, total, payment_proof_url, created_at,
  profiles ( name ),
  order_suborders (
    id, vendor_id, status, payment_status, subtotal, collection_time, notes,
    vendors ( name ),
    order_items ( meal_id, meal_name, qty, price )
  )
`;
