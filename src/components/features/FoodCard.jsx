import { FiPlus, FiHeart } from "react-icons/fi";
import { Link } from "react-router-dom";
import { formatCurrency } from "../../utils/formatters";
import Rating from "../ui/Rating";

export default function FoodCard({ meal, onAdd, isFavourite, onToggleFavourite, layout = "grid" }) {
  if (layout === "row") {
    return (
      <div className="card flex gap-3 p-3">
        <Link to={`/food/${meal.id}`} className="shrink-0">
          <img src={meal.image} alt={meal.name} className="h-20 w-20 rounded-xl object-cover" />
        </Link>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <Link to={`/food/${meal.id}`}>
              <h4 className="text-sm font-semibold text-ink truncate">{meal.name}</h4>
            </Link>
            <p className="text-xs text-ink-muted truncate">{meal.vendorName}</p>
            <Rating value={meal.rating} count={meal.reviewCount} className="mt-1" />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-semibold text-ink">{formatCurrency(meal.price)}</span>
            <button onClick={() => onAdd?.(meal)} className="btn-icon !h-8 !w-8 !bg-ink !text-paper !border-ink">
              <FiPlus size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="relative">
        <Link to={`/food/${meal.id}`}>
          <img src={meal.image} alt={meal.name} className="h-32 w-full object-cover" />
        </Link>
        {onToggleFavourite && (
          <button
            onClick={() => onToggleFavourite(meal)}
            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-paper-raised/90 backdrop-blur flex items-center justify-center shadow-card"
            aria-label="Toggle favourite"
          >
            <FiHeart
              size={15}
              className={isFavourite ? "fill-danger text-danger" : "text-ink-soft"}
            />
          </button>
        )}
        {meal.tags?.[0] && (
          <span className="absolute bottom-2 left-2 badge bg-paper-raised/90 backdrop-blur text-ink-soft">
            {meal.tags[0]}
          </span>
        )}
      </div>
      <div className="p-3 flex flex-col gap-1 flex-1">
        <Link to={`/food/${meal.id}`}>
          <h4 className="text-sm font-semibold text-ink leading-snug line-clamp-1">{meal.name}</h4>
        </Link>
        <p className="text-xs text-ink-muted truncate">{meal.vendorName}</p>
        <Rating value={meal.rating} count={meal.reviewCount} />
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-sm font-semibold text-ink">{formatCurrency(meal.price)}</span>
          <button
            onClick={() => onAdd?.(meal)}
            className="btn-icon !h-8 !w-8 !bg-ink !text-paper !border-ink"
            aria-label="Add to cart"
          >
            <FiPlus size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
