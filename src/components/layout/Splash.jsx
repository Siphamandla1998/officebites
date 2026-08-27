import { useEffect, useState } from "react";
import BrandMark from "./BrandMark";

const MIN_DISPLAY_MS = 900;

export default function Splash({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeaving(true);
      setTimeout(onDone, 280);
    }, MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[999] flex items-center justify-center bg-ink transition-opacity duration-300 ${
        leaving ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-nude-500/20 blur-3xl" />
      <div className="relative">
        <BrandMark size="lg" tagline variant="light" />
      </div>
    </div>
  );
}
