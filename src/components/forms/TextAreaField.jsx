import { useId } from 'react';

export default function TextAreaField({ label, error, className = "", rows = 4, id: providedId, ...props }) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="field-label">{label}</label>}
      <textarea id={id} className="textarea" rows={rows} {...props} />
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  );
}
