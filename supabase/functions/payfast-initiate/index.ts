// supabase/functions/payfast-initiate/index.ts
//
// Given an OfficeBites order id, returns the exact signed field set the
// browser should POST to PayFast. Never trusts anything from the client
// except the order id itself — the amount, item name, and buyer details are
// all read fresh from the database.
//
// Auth: this function is called by both signed-in customers and guests
// (guest checkout must work without an account, per the guest-order-security
// design in migration 0005). It uses the SERVICE ROLE key to read the order,
// which bypasses RLS entirely — so it does its OWN authorization check
// below rather than relying on RLS to scope the read. A signed-in caller
// must own the order; a guest can only act on an order that has no
// customer_id (same trust model as the rest of the guest-order design: the
// order id itself, a 122-bit random UUID, is the capability).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getPayfastConfig, signatureFromEntries } from "../_shared/payfast.ts";

const SITE_URL = Deno.env.get("SITE_URL") || "https://officebites.example";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let orderId: string | undefined;
  try {
    const body = await req.json();
    orderId = body?.orderId;
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  if (!orderId) {
    return jsonResponse({ error: "orderId is required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Identify the caller (if any) from their own JWT, forwarded as-is by the
  // browser — we use this only to check order ownership below, never to
  // elevate this function's own DB access (that's what the service role is
  // for, deliberately, so a guest with no JWT at all can still pay).
  const authHeader = req.headers.get("Authorization");
  let callerId: string | null = null;
  if (authHeader) {
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data } = await anonClient.auth.getUser();
    callerId = data?.user?.id || null;
  }

  const { data: order, error } = await admin
    .from("orders")
    .select("id, ticket_number, customer_id, guest_name, guest_contact, status, total, delivery_location")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return jsonResponse({ error: "Order not found" }, 404);
  }

  // Authorization: signed-in caller must own the order; otherwise it must
  // be an unowned (guest) order. Never let caller A pay for (and thus learn
  // the existence/amount of) caller B's order.
  const isOwner = order.customer_id ? order.customer_id === callerId : true;
  if (!isOwner) {
    return jsonResponse({ error: "Not authorized for this order" }, 403);
  }

  if (order.status !== "pending_payment") {
    return jsonResponse(
      { error: `This order is not awaiting payment (current status: ${order.status})` },
      409
    );
  }

  // Same order, same ticket, reused on every retry — never create a new
  // order or a new ticket number here. m_payment_id is OUR reference to
  // PayFast; using the ticket number keeps it stable and human-traceable.
  const { error: updateError } = await admin
    .from("orders")
    .update({ payment_method: "payfast" })
    .eq("id", orderId);

  if (updateError) {
    return jsonResponse({ error: "Could not prepare order for payment" }, 500);
  }

  const config = getPayfastConfig();

  let nameFirst = "Guest";
  let nameLast = "Customer";
  let email: string | undefined;

  if (order.customer_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("name, email")
      .eq("id", order.customer_id)
      .maybeSingle();
    if (profile?.name) {
      const [first, ...rest] = profile.name.split(" ");
      nameFirst = first || nameFirst;
      nameLast = rest.join(" ") || nameLast;
    }
    email = profile?.email;
  } else if (order.guest_name) {
    const [first, ...rest] = order.guest_name.split(" ");
    nameFirst = first || nameFirst;
    nameLast = rest.join(" ") || nameLast;
    if (order.guest_contact?.includes("@")) {
      email = order.guest_contact;
    }
  }

  // Field order here is deliberate and must stay stable — it's part of what
  // gets signed. This mirrors the field order PayFast's own docs use in
  // their examples; re-verify against developers.payfast.co.za/docs before
  // going live (see the VERIFY note in _shared/payfast.ts).
  const fieldEntries: [string, string][] = [
    ["merchant_id", config.merchantId],
    ["merchant_key", config.merchantKey],
    ["return_url", `${SITE_URL}/orders/${order.id}?payfast=return`],
    ["cancel_url", `${SITE_URL}/orders/${order.id}?payfast=cancel`],
    ["notify_url", `${supabaseUrl}/functions/v1/payfast-notify`],
    ["name_first", nameFirst],
    ["name_last", nameLast],
    ...(email ? ([["email_address", email]] as [string, string][]) : []),
    ["m_payment_id", order.ticket_number],
    ["amount", order.total.toFixed(2)],
    ["item_name", `OfficeBites order ${order.ticket_number}`],
    ["custom_str1", order.id],
  ];

  const signature = signatureFromEntries(fieldEntries, config.passphrase);

  return jsonResponse({
    processUrl: config.processUrl,
    fields: Object.fromEntries([...fieldEntries, ["signature", signature]]),
  });
});
