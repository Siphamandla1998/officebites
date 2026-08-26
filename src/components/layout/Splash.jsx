import { useEffect, useState } from "react";

const MIN_DISPLAY_MS = 1800;
const FADE_OUT_MS = 350;

export default function Splash({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeaving(true);

      const finishTimer = setTimeout(() => {
        onDone();
      }, FADE_OUT_MS);

      return () => clearTimeout(finishTimer);
    }, MIN_DISPLAY_MS);

    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[999] flex items-center justify-center bg-ink transition-opacity duration-300 ${
        leaving
          ? "opacity-0 pointer-events-none"
          : "opacity-100"
      }`}
    >
      <div className="absolute -top-16 -right-16 h-64 w-64 rounded-full bg-nude-500/20 blur-3xl" />

      <div className="relative flex flex-col items-center gap-3">
        <div className="h-16 w-16 rounded-2xl bg-ink border border-nude-500/30 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full bg-nude-400 flex items-center justify-center">
            <span className="font-extrabold text-ink text-sm tracking-tight">
              OB
            </span>
          </div>
        </div>

        <div className="text-paper font-extrabold text-lg tracking-tight">
          Office<span className="text-nude-400">Bites</span>
        </div>
      </div>
    </div>
  );
}
