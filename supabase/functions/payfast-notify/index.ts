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
import {
  getPayfastConfig,
  signatureFromEntries,
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

async function isFromPayfast(
  req: Request,
  validHosts: string[],
): Promise<boolean> {
  const forwardedFor =
    req.headers.get(
      "x-forwarded-for",
    );

  const sourceIp =
    forwardedFor
      ?.split(",")[0]
      ?.trim();

  if (!sourceIp) {
    console.error(
      "payfast-notify: source IP unavailable",
    );

    return false;
  }

  try {
    for (
      const host of validHosts
    ) {
      const addresses =
        await Deno.resolveDns(
          host,
          "A",
        );

      if (
        addresses.includes(
          sourceIp,
        )
      ) {
        return true;
      }
    }
  } catch (error) {
    /*
     * Fail closed.
     *
     * PayFast source validation is a security check. A DNS/runtime failure
     * must not turn that check into an automatic success.
     */
    console.error(
      "payfast-notify: DNS validation failed",
      error,
    );

    return false;
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return textResponse(
      "Method not allowed",
      405,
    );
  }

  const rawBody =
    await req.text();

  const params =
    new URLSearchParams(
      rawBody,
    );

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

  const config =
    getPayfastConfig();

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
      continue;
    }

    entries.push([
      key,
      value,
    ]);
  }

  const expectedSignature =
    signatureFromEntries(
      entries,
      config.passphrase,
    );

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

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body: rawBody,
        },
      );

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

  const amountGross =
    Number.parseFloat(
      amountGrossRaw,
    );

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
      console.error(
        "payfast-notify: ticket lookup failed",
        lookupError,
      );
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
      "Rejected",
      400,
    );
  }

  console.log(
    "payfast-notify: processed",
    {
      orderId:
        resolvedOrderId,

      pfPaymentId,

      result,
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
});