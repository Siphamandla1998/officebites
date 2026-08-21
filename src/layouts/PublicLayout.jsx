import { Outlet } from "react-router-dom";

export default function PublicLayout() {
  return (
    <div className="app-shell shadow-float">
      <Outlet />
    </div>
  );
}
