// Converts Supabase snake_case rows into the camelCase shapes
// used throughout OfficeBites.

export function mapVendor(row) {
  if (!row) return null;

  return {
    id: row.id,
    ownerId: row.owner_id,

    name: row.name || "",
    tagline: row.tagline || "",

    category: row.category || "",

    rating: Number(row.rating || 0),
    reviewCount: Number(row.review_count || 0),

    prepTimeMins: Number(row.prep_time_mins || 0),

    coverImage: row.cover_image || "",
    logo: row.logo || "",

    building: row.building || "",
    status: row.status || "",

    featured: Boolean(row.featured),

    subscriptionTier:
      row.subscription_tier || "",

    contactNumber:
      row.contact_number || "",

    email:
      row.email || "",

    address:
      row.address || "",

    deliveryRadius:
      row.delivery_radius || "",

    operatingHours:
      row.operating_hours || null,

    joinedAt:
      row.created_at || null,
  };
}


export function mapMeal(row) {
  if (!row) return null;

  return {

    id: row.id,

    vendorId:
      row.vendor_id || null,

    vendorName:
      row.vendors?.name ||
      row.vendor_name ||
      "Unknown Vendor",

    name:
      row.name || "",

    description:
      row.description || "",

    price:
      Number(row.price || 0),

    image:
      row.image ||
      "/placeholder-food.png",

    category:
      row.category || "Meals",

    tags:
      Array.isArray(row.tags)
        ? row.tags
        : [],

    available:
      row.available ?? true,

    availableDays:
      Array.isArray(row.available_days) && row.available_days.length > 0
        ? row.available_days
        : null, // null = every day

    featured:
      row.featured ?? false,

    preparationTime:
      Number(row.preparation_time || 0),

    rating:
      Number(row.rating || 0),

    reviewCount:
      Number(row.review_count || 0),
  };
}



export function mapReview(row) {
  if (!row) return null;

  return {

    id: row.id,

    vendorId:
      row.vendor_id || null,

    mealId:
      row.meal_id || null,

    customerName:
      row.customer_name ||
      "Customer",

    rating:
      Number(row.rating || 0),

    comment:
      row.comment || "",

    createdAt:
      row.created_at || null,

  };
}



export function mapOrder(row) {
  if (!row) return null;


  const subOrders =
    Array.isArray(row.order_suborders)
      ? row.order_suborders.map((so)=>({

          vendorId:
            so.vendor_id,

          vendorName:
            so.vendors?.name || "",

          status:
            so.status || "",

          paymentStatus:
            so.payment_status || "",

          subtotal:
            Number(so.subtotal || 0),

          collectionTime:
            so.collection_time || "",

          notes:
            so.notes || "",


          items:
            Array.isArray(so.order_items)
            ? so.order_items.map((item)=>({

                mealId:
                  item.meal_id,

                name:
                  item.meal_name || "",

                qty:
                  Number(item.qty || 0),

                price:
                  Number(item.price || 0),

              }))
            : [],

        }))
      : [];



  return {

    id:
      row.id,

    ticketNumber:
      row.ticket_number || "",

    customerId:
      row.customer_id || null,

    customerName:
      row.profiles?.name ||
      row.guest_name ||
      "Guest",

    customerContact:
      row.guest_contact || null,

    guestEmail:
      row.guest_email || null,

    deliveryDate:
      row.delivery_date || null,

    deliveryLocation:
      row.delivery_location || null,

    status:
      row.status || "",

    createdAt:
      row.created_at || null,


    subOrders,


    total:
      Number(row.total || 0),


    paymentProof:
      row.payment_proof_url || null,

  };
}



export const ORDER_SELECT = `
id,
ticket_number,
customer_id,
guest_name,
guest_contact,
guest_email,
delivery_date,
delivery_location,
status,
total,
payment_proof_url,
created_at,
profiles ( name ),
order_suborders (
  id,
  vendor_id,
  status,
  payment_status,
  subtotal,
  collection_time,
  notes,
  vendors ( name ),
  order_items (
    meal_id,
    meal_name,
    qty,
    price
  )
)
`;
