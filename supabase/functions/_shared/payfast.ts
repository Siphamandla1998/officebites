// supabase/functions/_shared/payfast.ts
//
// Centralizes everything environment-dependent (sandbox vs live) so neither
// Edge Function hardcodes a PayFast hostname. Switch environments with one
// secret: `supabase secrets set PAYFAST_MODE=live`.
//
// VERIFY BEFORE GOING LIVE: I could not load developers.payfast.co.za/docs
// directly (it's a JS-rendered SPA and returned no usable content from this
// environment) — the field names, endpoint paths, and signature process
// below are cross-checked against PayFast's own FAQ/support pages and
// several actively-maintained third-party integration libraries, all of
// which agree, but none of them *is* the primary source. Load
// https://developers.payfast.co.za/docs yourself and diff it against this
// file before a live transaction — especially the "Step 2: Signature"
// section and the exact ITN field list.

import { createHash } from "node:crypto";

export type PayfastMode = "sandbox" | "live";

export interface PayfastConfig {
  mode: PayfastMode;
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  processUrl: string;
  validateUrl: string;
  validHosts: string[];
}

export function getPayfastConfig(): PayfastConfig {
  const mode = (Deno.env.get("PAYFAST_MODE") || "sandbox") as PayfastMode;
  const merchantId = Deno.env.get("PAYFAST_MERCHANT_ID");
  const merchantKey = Deno.env.get("PAYFAST_MERCHANT_KEY");
  const passphrase = Deno.env.get("PAYFAST_PASSPHRASE") || "";

  if (!merchantId || !merchantKey) {
    throw new Error(
      "PayFast is not configured: set PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY " +
        "via `supabase secrets set`."
    );
  }

  // VERIFY: these are the hostnames PayFast's own docs/readmes list as
  // valid sources for payment processing and ITN traffic. Re-confirm this
  // list against current documentation — PayFast has changed these before.
  const host = mode === "live" ? "www.payfast.co.za" : "sandbox.payfast.co.za";
  const validHosts =
    mode === "live"
      ? ["www.payfast.co.za", "w1w.payfast.co.za", "w2w.payfast.co.za"]
      : ["sandbox.payfast.co.za"];

  return {
    mode,
    merchantId,
    merchantKey,
    passphrase,
    processUrl: `https://${host}/eng/process`,
    validateUrl: `https://${host}/eng/query/validate`,
    validHosts,
  };
}

/**
 * PayFast's signature is an MD5 hash of the URL-encoded parameter string,
 * fields in the order they're added (NOT alphabetical), spaces encoded as
 * '+', empty/undefined values excluded (but the string "0" is NOT empty —
 * keep it), with the passphrase appended last as its own field if one is
 * configured.
 *
 * Used two ways:
 *  - payfast-initiate: builds our own outbound field set, so the order here
 *    IS the order that matters — keep it identical every time.
 *  - payfast-notify: reconstructs the signature from the fields exactly as
 *    PayFast sent them in the notification body (see that function) —
 *    fields there come from the ORIGINAL request, not this helper's order.
 */
export function signatureFromEntries(entries: [string, string][], passphrase: string): string {
  const parts: string[] = [];
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${key}=${encodeURIComponent(value.toString().trim()).replace(/%20/g, "+")}`);
  }
  let paramString = parts.join("&");
  if (passphrase) {
    paramString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, "+")}`;
  }
  return createHash("md5").update(paramString).digest("hex");
}
