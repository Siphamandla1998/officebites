import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <p className="text-5xl font-bold text-nude-300">404</p>
      <h1 className="text-lg font-semibold text-ink mt-3">Page not found</h1>
      <p className="text-sm text-ink-muted mt-1.5 max-w-xs">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link to="/home" className="btn-primary mt-6">
        Back to home
      </Link>
    </div>
  );
}
