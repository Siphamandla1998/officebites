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
      "PayFast is not configured: set PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY via Supabase secrets.",
    );
  }

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

function payfastEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`
    )
    .replace(/%20/g, "+");
}

export function signatureFromEntries(
  entries: [string, string][],
  passphrase: string,
): string {
  const parts: string[] = [];

  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${key}=${payfastEncode(String(value).trim())}`);
  }

  if (passphrase) {
    parts.push(`passphrase=${payfastEncode(passphrase.trim())}`);
  }

  return createHash("md5").update(parts.join("&")).digest("hex");
}
