import { Link } from 'react-router-dom';
export default function LegalLinks({ commercial = false }) {
  return <footer className="px-4 py-6 text-xs text-ink-muted print:hidden" aria-label="Legal information">
    <nav className="flex flex-wrap justify-center gap-4" aria-label="Policies">
      <Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link>
      <Link to="/refund-policy">Refunds</Link>
      <Link to="/delivery">Delivery</Link><Link to="/cookies">Cookies</Link><Link to="/company-information">Company information</Link>
      {commercial && <><Link to="/vendor/agreement">Vendor agreement</Link><Link to="/vendor/agreement#current-vendor-fees">Vendor fees</Link></>}
    </nav>
  </footer>;
}
