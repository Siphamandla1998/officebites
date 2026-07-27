export default function TextAreaField({ label, error, className = "", rows = 4, ...props }) {
  return (
    <div className={className}>
      {label && <label className="field-label">{label}</label>}
      <textarea className="textarea" rows={rows} {...props} />
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
