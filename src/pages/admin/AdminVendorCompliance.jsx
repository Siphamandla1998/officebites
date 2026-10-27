import { useParams } from 'react-router-dom';
import VendorCompliancePanel from '../../components/features/VendorCompliancePanel';
export default function AdminVendorCompliance() { const { vendorId } = useParams(); return <VendorCompliancePanel vendorId={vendorId} />; }
