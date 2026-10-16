import { Link } from 'react-router-dom';
export default function LegalLinks({ commercial = false }) {
  return <footer className="px-4 py-6 text-xs text-ink-muted print:hidden" aria-label="Legal information">
    <nav className="flex flex-wrap justify-center gap-4" aria-label="Policies">
      <Link to="/terms">Terms</Link><Link to="/privacy">Privacy / POPIA</Link>
      <Link to="/refund-policy">Refunds</Link>
      {commercial && <><Link to="/vendor-agreement">Vendor agreement</Link><Link to="/vendor-fees">Vendor fees</Link></>}
    </nav>
  </footer>;
}
