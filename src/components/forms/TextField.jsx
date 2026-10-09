import { useId } from "react";

export default function TextField({ label, error, className = "", id: providedId, ...props }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="field-label">{label}</label>}
      <input id={id} className="input" {...props} />
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
