export default function Spinner({ size = 20, className = "" }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-nude-300 border-t-ink ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
