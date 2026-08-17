import { useEffect, useState } from "react";
import { paymentService } from "../../services/paymentService";

/**
 * order.paymentProof is a private-bucket storage PATH, not a browser-ready
 * URL (the bucket is private since payment screenshots often contain
 * banking details). This resolves it to a temporary signed URL on mount.
 */
export default function PaymentProofImage({ path, alt, className }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);

    if (!path) return;

    paymentService
      .getProofUrl(path)
      .then((signedUrl) => {
        if (!cancelled) setUrl(signedUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!path) return null;

  if (failed) {
    return <p className="text-xs text-danger">Couldn't load proof of payment.</p>;
  }

  if (!url) {
    return <div className={`${className || ""} skeleton`} />;
  }

  return <img src={url} alt={alt || "Proof of payment"} className={className} />;
}
