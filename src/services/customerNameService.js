import { supabase } from "./api/supabaseClient";

// Only names for authorized orders; never fetch other customers' full profiles.
export async function getOrderCustomerNames(orderIds) {
  const ids = [...new Set(orderIds.filter(Boolean))];
  const names = new Map();
  for (let start = 0; start < ids.length; start += 200) {
    const { data, error } = await supabase.rpc("get_order_customer_names", {
      p_order_ids: ids.slice(start, start + 200),
    });
    if (error) {
      // A display-name failure must not hide the customer's order or messages.
      console.error("Could not load order customer names:", error.code);
      continue;
    }
    for (const row of data || []) names.set(row.order_id, row.customer_name);
  }
  return names;
}
