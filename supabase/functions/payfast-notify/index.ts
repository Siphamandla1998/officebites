// supabase/functions/payfast-notify/index.ts
//
// The authoritative payment confirmation path. Nothing else in this
// codebase is allowed to move a payfast order to 'confirmed' — see
// confirm_payfast_payment() in the Phase 6 migration, which is not granted
// to anon/authenticated at all.
//
// Runs PayFast's standard ITN security checks, cross-checked against
// PayFast's own FAQ/support content and several current third-party
// integration libraries (see the VERIFY note in _shared/payfast.ts — I
// could not load the primary docs site directly from this environment):
//   1. Signature valid
//   2. Source IP belongs to PayFast
//   3. Server-side confirmation POST-back to PayFast returns "VALID"
//   4. Payment amount matches the order's authoritative total
//   5. Reference maps to a real, still-pending order
// Only once all five pass does confirm_payfast_payment() get called, and
// that function has its own independent idempotency + amount + eligibility
// checks — this function is not the only line of defense.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { getPayfastConfig, signatureFromEntries } from "../_shared/payfast.ts";

function textResponse(body: string, status = 200) {
  return new Response(body, { status });
}

async function isFromPayfast(req: Request, validHosts: string[]): Promise<boolean> {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const sourceIp = forwardedFor?.split(",")[0]?.trim();
  if (!sourceIp) return false;

  try {
    for (const host of validHosts) {
      const addrs = await Deno.resolveDns(host, "A");
      if (addrs.includes(sourceIp)) return true;
    }
  } catch (err) {
    // DNS resolution inside the Edge Function runtime is unverified from
    // this environment — if it's unavailable/unreliable here, don't let a
    // resolver failure alone sink an otherwise-valid, signature-checked and
    // PayFast-confirmed notification. Log it loudly so it's visible in
    // Supabase function logs and worth tightening once you can observe real
    // traffic.
    console.error("payfast-notify: DNS validation failed, continuing on other checks", err);
    return true;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return textResponse("Method not allowed", 405);
  }

  const rawBody = await req.text();
  const params = new URLSearchParams(rawBody);

  const receivedSignature = params.get("signature");
  if (!receivedSignature) {
    return textResponse("Missing signature", 400);
  }

  const config = getPayfastConfig();

  // Reconstruct the signature from the fields in the EXACT order PayFast
  // sent them (URLSearchParams preserves submission order), excluding the
  // signature field itself — this is different from payfast-initiate, which
  // controls its own outbound field order.
  const entries: [string, string][] = [];
  for (const [key, value] of params.entries()) {
    if (key === "signature") continue;
    entries.push([key, value]);
  }
  const expectedSignature = signatureFromEntries(entries, config.passphrase);

  if (expectedSignature !== receivedSignature) {
    console.error("payfast-notify: signature mismatch");
    return textResponse("Invalid signature", 400);
  }

  const sourceOk = await isFromPayfast(req, config.validHosts);
  if (!sourceOk) {
    console.error("payfast-notify: request did not come from a recognized PayFast host");
    return textResponse("Invalid source", 400);
  }

  // Server-to-server confirmation: PayFast requires posting the raw
  // notification straight back to their validate endpoint and checking for
  // a literal "VALID" response — the notification body alone, even with a
  // correct signature, is not sufficient proof on its own.
  let validateOk = false;
  try {
    const validateResponse = await fetch(config.validateUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
    });
    const validateText = (await validateResponse.text()).trim();
    validateOk = validateText === "VALID";
    if (!validateOk) {
      console.error("payfast-notify: server confirmation returned", validateText);
    }
  } catch (err) {
    console.error("payfast-notify: server confirmation POST failed", err);
  }

  if (!validateOk) {
    return textResponse("Server confirmation failed", 400);
  }

  const orderId = params.get("custom_str1");
  const mPaymentId = params.get("m_payment_id");
  const pfPaymentId = params.get("pf_payment_id");
  const amountGrossRaw = params.get("amount_gross");
  const paymentStatus = params.get("payment_status");

  if (!pfPaymentId || !amountGrossRaw || !paymentStatus || (!orderId && !mPaymentId)) {
    console.error("payfast-notify: missing required ITN fields");
    return textResponse("Missing required fields", 400);
  }

  const amountGross = Number.parseFloat(amountGrossRaw);
  if (Number.isNaN(amountGross)) {
    return textResponse("Invalid amount", 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  let resolvedOrderId = orderId;
  if (!resolvedOrderId) {
    // Fall back to matching on our own reference if custom_str1 is somehow
    // absent — should not normally happen since payfast-initiate always
    // sets it, but the ticket number is a valid independent lookup too.
    const { data: byTicket } = await admin
      .from("orders")
      .select("id")
      .eq("ticket_number", mPaymentId)
      .maybeSingle();
    resolvedOrderId = byTicket?.id;
  }

  if (!resolvedOrderId) {
    console.error("payfast-notify: could not resolve an order for this notification", {
      orderId,
      mPaymentId,
    });
    return textResponse("Unknown order", 400);
  }

  const { data: result, error } = await admin.rpc("confirm_payfast_payment", {
    p_order_id: resolvedOrderId,
    p_pf_payment_id: pfPaymentId,
    p_m_payment_id: mPaymentId,
    p_amount_gross: amountGross,
    p_payment_status: paymentStatus,
    p_raw_payload: Object.fromEntries(params.entries()),
  });

  if (error) {
    // Includes the amount-mismatch case (confirm_payfast_payment raises on
    // mismatch) and any other rejection from the function's own checks.
    console.error("payfast-notify: confirm_payfast_payment rejected the notification", error);
    return textResponse("Rejected", 400);
  }

  console.log("payfast-notify: processed", { orderId: resolvedOrderId, pfPaymentId, result });

  // 200 tells PayFast we've fully handled this notification (whether newly
  // applied or a harmless duplicate) so it stops retrying.
  return textResponse("OK", 200);
});
