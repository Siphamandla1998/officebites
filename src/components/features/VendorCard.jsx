import { Link } from "react-router-dom";
import { FiClock } from "react-icons/fi";
import Rating from "../ui/Rating";

export default function VendorCard({ vendor, layout = "grid" }) {
  if (layout === "row") {
    return (
      <Link to={`/vendors/${vendor.id}`} className="card flex gap-3 p-3 items-center">
        <img src={vendor.logo} alt={vendor.name} className="h-14 w-14 rounded-xl object-cover shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-ink truncate">{vendor.name}</h4>
          <p className="text-xs text-ink-muted truncate">{vendor.tagline}</p>
          <div className="flex items-center gap-3 mt-1">
            <Rating value={vendor.rating} count={vendor.reviewCount} />
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <FiClock size={12} /> {vendor.prepTimeMins} min
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/vendors/${vendor.id}`} className="card overflow-hidden shrink-0 w-64">
      <div className="relative h-28">
        <img src={vendor.coverImage} alt={vendor.name} className="h-full w-full object-cover" />
        <img
          src={vendor.logo}
          alt=""
          className="absolute -bottom-4 left-3 h-12 w-12 rounded-xl object-cover border-2 border-paper-raised shadow-card"
        />
        {vendor.featured && (
          <span className="absolute top-2 left-2 badge bg-ink text-paper">Featured</span>
        )}
      </div>
      <div className="pt-6 pb-3 px-3">
        <h4 className="text-sm font-semibold text-ink truncate">{vendor.name}</h4>
        <p className="text-xs text-ink-muted truncate">{vendor.tagline}</p>
        <div className="flex items-center gap-3 mt-2">
          <Rating value={vendor.rating} count={vendor.reviewCount} />
          <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
            <FiClock size={12} /> {vendor.prepTimeMins} min
          </span>
        </div>
      </div>
    </Link>
  );
}
