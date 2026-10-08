export default function RequestError({ error, onRetry }) {
  if (!error) return null;
  return <div role="alert" className="card p-4 space-y-3"><p className="text-sm text-danger">{error.message || 'Could not load this information.'}</p><button className="btn-outline" onClick={onRetry}>Retry</button></div>;
}
