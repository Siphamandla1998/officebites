import { useAuth } from '../../context/AuthContext';
import VendorCompliancePanel from '../../components/features/VendorCompliancePanel';
export default function VendorCompliance() { const { user } = useAuth(); return user?.vendorId ? <VendorCompliancePanel vendorId={user.vendorId} /> : <p role="status">Your vendor profile is not yet available. Contact Support.</p>; }
