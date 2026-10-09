import { createClient } from "jsr:@supabase/supabase-js@2";
import { getPayfastConfig, signatureFromEntries } from "../_shared/payfast.ts";

function normalizeOrigin(value: string | null | undefined) {
  return String(value || "").trim().replace(/\/+$/, "");
}

const SITE_URL = normalizeOrigin(
  Deno.env.get("SITE_URL") || "https://officebites.co.za",
);

const ALLOWED_ORIGINS = (
  Deno.env.get("ALLOWED_ORIGINS") || "https://officebites.co.za"
)
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

function corsHeadersFor(req: Request) {
  const requestOrigin = normalizeOrigin(req.headers.get("Origin"));
  const allowedOrigin =
    requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
      ? requestOrigin
      : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeadersFor(req),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeadersFor(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  let orderId: string | undefined;
  let guestContact: string | undefined;

  try {
    const body = await req.json();
    orderId = typeof body?.orderId === "string" ? body.orderId.trim() : undefined;
    guestContact =
      typeof body?.guestContact === "string" ? body.guestContact.trim() : undefined;
  } catch {
    return jsonResponse(req, { error: "Invalid request body" }, 400);
  }

  if (!orderId) {
    return jsonResponse(req, { error: "orderId is required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("payfast-initiate: missing Supabase environment configuration");
    return jsonResponse(req, { error: "Payment service is not configured" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const authHeader = req.headers.get("Authorization");
  let callerId: string | null = null;

  if (authHeader) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (anonKey) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data, error } = await authClient.auth.getUser();
      if (!error) callerId = data?.user?.id || null;
      else if (authHeader !== `Bearer ${anonKey}` && !authHeader.startsWith('Bearer sb_publishable_')) {
        return jsonResponse(req, { error: 'Please sign in again or verify your guest order without an expired session.' }, 401);
      }
    }
  }

  if (callerId) {
    const { data: profile, error: profileError } = await admin.from('profiles')
      .select('id,suspended,deleted_at').eq('id', callerId).maybeSingle();
    if (profileError) return jsonResponse(req, { error: 'Could not verify account status' }, 503);
    if (!profile || profile.suspended || profile.deleted_at) return jsonResponse(req, { error: 'Active account required' }, 403);
  }

  let { data: order, error: orderError } = await admin
    .from("orders")
    .select(
      "id,ticket_number,customer_id,guest_name,guest_contact,guest_email,status,total,delivery_location",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    return jsonResponse(req, { error: "Order not found" }, 404);
  }

  if (order.customer_id) {
    if (!callerId || callerId !== order.customer_id) {
      return jsonResponse(req, { error: "Not authorized for this order" }, 403);
    }
  } else {
    const storedContact = String(order.guest_contact || "").trim();
    if (!guestContact || !storedContact || guestContact !== storedContact) {
      return jsonResponse(req, { error: "Guest order verification failed" }, 403);
    }
  }

  if (order.status !== "pending_payment") {
    return jsonResponse(
      req,
      { error: `This order is not awaiting payment (current status: ${order.status})` },
      409,
    );
  }

  // This RPC rechecks authority and vendor/customer lifecycle under DB locks.
  const { data: preparedOrder, error: prepareError } = await admin.rpc('prepare_payfast_order', {
    p_order_id: order.id, p_caller_id: callerId, p_guest_contact: guestContact || null,
  });
  if (prepareError) return jsonResponse(req, { error: prepareError.message || 'Could not prepare payment' }, prepareError.code === '42501' ? 403 : 409);

  order = preparedOrder; // Sign the authoritative transaction snapshot.
  if (!order) return jsonResponse(req, { error: 'Could not prepare payment' }, 503);
  const config = getPayfastConfig();
  const requestOrigin = normalizeOrigin(req.headers.get("Origin"));
  const returnOrigin =
    requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
      ? requestOrigin
      : SITE_URL;

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
      const [first, ...rest] = profile.name.trim().split(/\s+/);
      nameFirst = first || nameFirst;
      nameLast = rest.join(" ") || nameLast;
    }
    if (profile?.email) email = profile.email;
  } else {
    if (order.guest_name) {
      const [first, ...rest] = order.guest_name.trim().split(/\s+/);
      nameFirst = first || nameFirst;
      nameLast = rest.join(" ") || nameLast;
    }
    if (order.guest_email) email = order.guest_email;
  }

  const fieldEntries: [string, string][] = [
    ["merchant_id", config.merchantId],
    ["merchant_key", config.merchantKey],
    ["return_url", `${returnOrigin}/orders/${order.id}?payfast=return`],
    ["cancel_url", `${returnOrigin}/orders/${order.id}?payfast=cancel`],
    ["notify_url", `${supabaseUrl}/functions/v1/payfast-notify`],
    ["name_first", nameFirst],
    ["name_last", nameLast],
    ...(email ? [["email_address", email]] as [string, string][] : []),
    ["m_payment_id", order.ticket_number],
    ["amount", Number(order.total).toFixed(2)],
    ["item_name", `OfficeBites order ${order.ticket_number}`],
    ["custom_str1", order.id],
  ];

  const signature = signatureFromEntries(fieldEntries, config.passphrase);

  return jsonResponse(req, {
    processUrl: config.processUrl,
    fields: Object.fromEntries([...fieldEntries, ["signature", signature]]),
  });
});
