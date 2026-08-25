import { Link } from "react-router-dom";
import Rating from "../ui/Rating";

const PLACEHOLDER_IMAGE = "/placeholder-food.png";

export default function VendorCard({
  vendor,
  layout = "grid",
}) {
  if (!vendor) return null;


  if (layout === "row") {
    return (
      <Link
        to={`/vendors/${vendor.id}`}
        className="card flex gap-3 p-3 items-center"
      >

        <img
          src={vendor.logo || PLACEHOLDER_IMAGE}
          alt={vendor.name}
          className="h-16 w-16 rounded-xl object-cover"
        />


        <div className="flex-1">

          <h4 className="text-sm font-semibold text-ink">
            {vendor.name}
          </h4>


          <p className="text-xs text-ink-muted">
            {vendor.tagline}
          </p>

        </div>

      </Link>
    );
  }


  return (
    <Link
      to={`/vendors/${vendor.id}`}
      className="card overflow-hidden shrink-0 w-64"
    >

      <div className="relative">

        <img
          src={vendor.coverImage || vendor.logo || PLACEHOLDER_IMAGE}
          alt={vendor.name}
          className="h-32 w-full object-cover"
          loading="lazy"
        />


        {vendor.featured && (
          <span className="absolute top-2 left-2 badge">
            Featured
          </span>
        )}

      </div>



      <div className="p-3.5">

        <h4 className="text-sm font-semibold text-ink truncate">
          {vendor.name}
        </h4>


        <p className="text-xs text-ink-muted mt-1 truncate">
          {vendor.tagline}
        </p>



        {vendor.rating > 0 && (
          <div className="mt-2">
            <Rating value={vendor.rating} />
          </div>
        )}

      </div>


    </Link>
  );
}
