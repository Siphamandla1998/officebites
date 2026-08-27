export default function BrandMark({ size = "md", tagline = false, variant = "dark" }) {
  const sizes = {
    sm: { badge: "h-10 w-10", circle: "h-6 w-6", text: "text-sm" },
    md: { badge: "h-12 w-12", circle: "h-7 w-7", text: "text-xl" },
    lg: { badge: "h-16 w-16", circle: "h-10 w-10", text: "text-2xl" },
  };
  const s = sizes[size] || sizes.md;
  const isLight = variant === "light"; // for use on dark backgrounds, e.g. Splash

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex ${s.badge} rounded-2xl items-center justify-center shrink-0 ${
            isLight ? "bg-paper/10 border border-nude-500/30" : "bg-ink"
          }`}
        >
          <span className={`inline-flex ${s.circle} rounded-full bg-nude-400 items-center justify-center`}>
            <span className="font-extrabold text-ink text-[0.65em]">OB</span>
          </span>
        </span>
        <span className={`${s.text} font-extrabold tracking-tight ${isLight ? "text-paper" : "text-ink"}`}>
          Office<span className={isLight ? "text-nude-400" : "text-nude-600"}>Bites</span>
        </span>
      </div>
      {tagline && (
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
            isLight ? "text-paper/50" : "text-ink-muted"
          }`}
        >
          Office Food Marketplace
        </span>
      )}
    </div>
  );
}
