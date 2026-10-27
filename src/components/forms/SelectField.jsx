import { useId } from 'react';

export default function SelectField({ label, error, options = [], className = "", id: providedId, ...props }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="field-label">{label}</label>}
      <select id={id} className="input" {...props}>
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
