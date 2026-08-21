import { Outlet } from "react-router-dom";
import { APP_NAME } from "../utils/constants";

export default function AuthLayout() {
  return (
    <div className="app-shell flex flex-col justify-center px-6 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,env(safe-area-inset-bottom))] min-h-screen shadow-float">
      <div className="mb-10 text-center">
        <span className="inline-flex h-14 w-14 rounded-2xl bg-ink text-paper items-center justify-center text-xl font-bold mb-4">
          OB
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-ink">{APP_NAME}</h1>
        <p className="text-sm text-ink-muted mt-1">Office food, sorted.</p>
      </div>
      <Outlet />
    </div>
  );
}
