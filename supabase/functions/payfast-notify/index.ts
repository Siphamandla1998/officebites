// supabase/functions/payfast-notify/index.ts
//
// Authoritative OfficeBites PayFast payment confirmation endpoint.
//
// A browser redirect from PayFast never confirms an order. An order is
// confirmed only after this server-side notification passes the required
// validation checks and confirm_payfast_payment() accepts it.
//
// Validation:
//   1. PayFast signature
//   2. PayFast source IP
//   3. Server-to-server PayFast validation
//   4. Required transaction fields
//   5. Authoritative order/payment checks inside confirm_payfast_payment()
//
// Any failed security check fails closed.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { createHash } from "node:crypto";
import {
  getPayfastConfig,
} from "../_shared/payfast.ts";

function textResponse(
  body: string,
  status = 200,
) {
  return new Response(
    body,
    { status },
  );
}

function payfastUrlencode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (ch) =>
      "%" + ch.charCodeAt(0).toString(16).toUpperCase()
    )
    .replace(/%20/g, "+");
}

function ipv4ToInt(ip: string): number | null {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return null;
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [network, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const ipInt = ipv4ToInt(ip);
  const netInt = ipv4ToInt(network);
  if (ipInt === null || netInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

async function isFromPayfast(req: Request, validHosts: string[]): Promise<boolean> {
  const sourceIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim();

  if (!sourceIp) {
    console.error("payfast-notify: source IP unavailable");
    return false;
  }

  // Existing deployment allowlist; verify proxy source headers and ranges
  // against a real PayFast ITN before declaring end-to-end readiness.
  const publishedCidrs = [
    "197.97.145.144/28",
    "41.74.179.192/27",
    "102.216.36.0/28",
    "102.216.36.128/28",
    "144.126.193.139/32",
  ];

  if (publishedCidrs.some((cidr) => ipInCidr(sourceIp, cidr))) return true;

  try {
    for (const host of validHosts) {
      const addresses = await Deno.resolveDns(host, "A");
      if (addresses.includes(sourceIp)) return true;
    }
  } catch (error) {
    console.error("payfast-notify: DNS source validation failed", error);
  }
  return false;
}

Deno.serve(async (req) => {
  console.log("payfast-notify: request received", {
    method: req.method,
    contentType: req.headers.get("content-type"),
  });
  if (req.method !== "POST") {
    return textResponse(
      "Method not allowed",
      405,
    );
  }

  try {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    return textResponse("Unsupported content type", 415);
  }
  const rawBody = await req.text();
  if (rawBody.length > 65536) return textResponse("Payload too large", 413);

  const params =
    new URLSearchParams(
      rawBody,
    );

  const seen = new Set<string>();
  for (const [key] of params) {
    if (seen.has(key)) return textResponse("Duplicate field", 400);
    seen.add(key);
  }

  const receivedSignature =
    params.get(
      "signature",
    );

  if (!receivedSignature) {
    return textResponse(
      "Missing signature",
      400,
    );
  }

  const config = getPayfastConfig();
  if (params.get("merchant_id") !== config.merchantId) {
    return textResponse("Merchant mismatch", 400);
  }
  if (!/^[a-f0-9]{32}$/.test(receivedSignature)) {
    return textResponse("Invalid signature format", 400);
  }

  /*
   * URLSearchParams preserves the submitted field order.
   * Exclude PayFast's signature itself when rebuilding the signed payload.
   */
  const entries:
    [string, string][] = [];

  for (
    const [
      key,
      value,
    ] of params.entries()
  ) {
    if (
      key === "signature"
    ) {
      break;
    }

    entries.push([
      key,
      value,
    ]);
  }

  const pfParamString = entries
    .map(([key, value]) => `${key}=${payfastUrlencode(value)}`)
    .join("&");

  const signedParamString = config.passphrase
    ? `${pfParamString}&passphrase=${payfastUrlencode(config.passphrase)}`
    : pfParamString;

  const expectedSignature = createHash("md5")
    .update(signedParamString)
    .digest("hex");

  const validationParamString = pfParamString;

  if (
    expectedSignature !==
    receivedSignature
  ) {
    console.error(
      "payfast-notify: signature mismatch",
    );

    return textResponse(
      "Invalid signature",
      400,
    );
  }

  const sourceOk =
    await isFromPayfast(
      req,
      config.validHosts,
    );

  if (!sourceOk) {
    console.error(
      "payfast-notify: request did not pass PayFast source validation",
    );

    return textResponse(
      "Invalid source",
      400,
    );
  }

  /*
   * Confirm the notification directly with PayFast before applying any
   * payment state change locally.
   */
  let validateOk = false;

  try {
    const response =
      await fetch(
        config.validateUrl,
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(15000),

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body: validationParamString,
        },
      );

    if (!response.ok) {
      console.error("payfast-notify: validation HTTP failure", response.status);
      return textResponse("Validation temporarily unavailable", 503);
    }
    const validationResult =
      (
        await response.text()
      ).trim();

    validateOk =
      validationResult ===
      "VALID";

    if (!validateOk) {
      console.error(
        "payfast-notify: server confirmation rejected",
        validationResult,
      );
    }
  } catch (error) {
    console.error(
      "payfast-notify: server confirmation request failed",
      error,
    );
    return textResponse("Validation temporarily unavailable", 503);
  }

  if (!validateOk) {
    return textResponse(
      "Server confirmation failed",
      400,
    );
  }

  const orderId =
    params.get(
      "custom_str1",
    );

  const mPaymentId =
    params.get(
      "m_payment_id",
    );

  const pfPaymentId =
    params.get(
      "pf_payment_id",
    );

  const amountGrossRaw =
    params.get(
      "amount_gross",
    );

  const paymentStatus =
    params.get(
      "payment_status",
    );

  if (
    !pfPaymentId ||
    !amountGrossRaw ||
    !paymentStatus ||
    (!orderId &&
      !mPaymentId)
  ) {
    console.error(
      "payfast-notify: missing required ITN fields",
    );

    return textResponse(
      "Missing required fields",
      400,
    );
  }

  if (!/^\d+(\.\d{1,2})?$/.test(amountGrossRaw)) {
    return textResponse("Invalid amount", 400);
  }
  const amountGross = Number(amountGrossRaw);

  if (
    !Number.isFinite(
      amountGross,
    )
  ) {
    return textResponse(
      "Invalid amount",
      400,
    );
  }

  const supabaseUrl =
    Deno.env.get(
      "SUPABASE_URL",
    );

  const serviceRoleKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    console.error(
      "payfast-notify: missing Supabase environment configuration",
    );

    return textResponse(
      "Server configuration error",
      500,
    );
  }

  const admin =
    createClient(
      supabaseUrl,
      serviceRoleKey,
    );

  let resolvedOrderId =
    orderId;

  if (!resolvedOrderId) {
    const {
      data: byTicket,
      error: lookupError,
    } = await admin
      .from("orders")
      .select("id")
      .eq(
        "ticket_number",
        mPaymentId,
      )
      .maybeSingle();

    if (lookupError) {
      console.error("payfast-notify: ticket lookup failed", lookupError.code);
      return textResponse("Order lookup temporarily unavailable", 503);
    }

    resolvedOrderId =
      byTicket?.id || null;
  }

  if (!resolvedOrderId) {
    console.error(
      "payfast-notify: could not resolve order",
      {
        orderId,
        mPaymentId,
      },
    );

    return textResponse(
      "Unknown order",
      400,
    );
  }

  // Bind both submitted identifiers to the same authoritative order.
  const { data: paymentOrder, error: paymentLookupError } = await admin
    .from("orders").select("id,ticket_number").eq("id", resolvedOrderId).maybeSingle();
  if (paymentLookupError) return textResponse("Order lookup temporarily unavailable", 503);
  if (!paymentOrder || (mPaymentId && paymentOrder.ticket_number !== mPaymentId)) {
    return textResponse("Order reference mismatch", 400);
  }

  const {
    data: result,
    error,
  } = await admin.rpc(
    "confirm_payfast_payment",
    {
      p_order_id:
        resolvedOrderId,

      p_pf_payment_id:
        pfPaymentId,

      p_m_payment_id:
        mPaymentId,

      p_amount_gross:
        amountGross,

      p_payment_status:
        paymentStatus,

      p_raw_payload:
        Object.fromEntries(
          params.entries(),
        ),
    },
  );

  if (error) {
    console.error(
      "payfast-notify: payment confirmation rejected",
      error,
    );

    return textResponse(
      "Payment confirmation failed",
      500,
    );
  }

  console.log(
    "payfast-notify: processed",
    {
      orderId:
        resolvedOrderId,

      pfPaymentId,

      applied: result?.applied ?? null,
      duplicate: result?.duplicate ?? null,
      status: result?.order?.status ?? null,
    },
  );

  /*
   * A successful response tells PayFast the ITN was processed. Duplicate
   * notifications are handled by the database confirmation function's
   * idempotency controls.
   */
  return textResponse(
    "OK",
    200,
  );
  } catch (error) {
    console.error("payfast-notify: unexpected failure", error instanceof Error ? error.name : "unknown");
    return textResponse("Notification temporarily unavailable", 500);
  }
});
