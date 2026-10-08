import { Outlet } from "react-router-dom";

export default function PublicLayout() {
  return (
    <div className="app-shell app-safe-top app-safe-bottom shadow-float">
      <Outlet />
    </div>
  );
}
