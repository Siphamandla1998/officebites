import { Component } from "react";
import { FiAlertTriangle } from "react-icons/fi";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Swap for a real error-reporting service (Sentry, etc.) before launch —
    // this is the one place in the app guaranteed to see every render crash.
    // eslint-disable-next-line no-console
    console.error("Unhandled render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 gap-3">
          <div className="h-14 w-14 rounded-2xl bg-nude-100 flex items-center justify-center text-nude-600">
            <FiAlertTriangle size={22} />
          </div>
          <h1 className="text-lg font-semibold text-ink">Something went wrong</h1>
          <p className="text-sm text-ink-muted max-w-xs">
            This screen hit an unexpected error. Reloading usually fixes it — if it keeps happening,
            let us know via Help &amp; Support.
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary mt-2">
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
