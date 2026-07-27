export default function TextField({ label, error, className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="field-label">{label}</label>}
      <input className="input" {...props} />
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
