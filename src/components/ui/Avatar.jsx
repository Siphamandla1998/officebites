import { initials } from "../../utils/formatters";

export default function Avatar({ src, name, size = 40, className = "" }) {
  return src ? (
    <img
      src={src}
      alt={name}
      className={`rounded-full object-cover shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className={`rounded-full bg-nude-200 text-nude-800 font-semibold flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}
