import { Outlet } from "react-router-dom";
import LegalLinks from '../components/layout/LegalLinks';

export default function PublicLayout() {
  return (
    <div className="app-shell app-safe-top app-safe-bottom shadow-float">
      <Outlet />
      <LegalLinks />
    </div>
  );
}
