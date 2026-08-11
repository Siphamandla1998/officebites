export default function SelectField({ label, error, options = [], className = "", ...props }) {
  return (
    <div className={className}>
      {label && <label className="field-label">{label}</label>}
      <select className="input" {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
