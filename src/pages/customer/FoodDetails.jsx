import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FiMinus, FiPlus, FiHeart } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import Rating from "../../components/ui/Rating";
import { useAsync } from "../../hooks/useAsync";
import { foodService } from "../../services/foodService";
import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";
import { formatCurrency } from "../../utils/formatters";

export default function FoodDetails() {
  const { id } = useParams();
  const [qty, setQty] = useState(1);
  const [fav, setFav] = useState(false);
  const { addItem } = useCart();
  const { showToast } = useToast();

  const { data: meal, loading } = useAsync(() => foodService.getMealById(id), [id]);

  if (loading || !meal) {
    return (
      <div>
        <Navbar showBack />
        <div className="ob-container pt-4"><div className="skeleton h-64" /></div>
      </div>
    );
  }

  const handleAdd = () => {
    addItem(meal, qty);
    showToast(`Added ${qty} × ${meal.name} to cart`, { type: "success" });
  };

  return (
    <div className="pb-28">
      <Navbar showBack transparent />
      <div className="-mt-16 relative">
        <img src={meal.image} alt={meal.name} className="h-64 w-full object-cover" />
        <button
          onClick={() => setFav((f) => !f)}
          className="absolute top-20 right-5 h-10 w-10 rounded-full bg-paper-raised/90 backdrop-blur flex items-center justify-center shadow-card"
        >
          <FiHeart size={17} className={fav ? "fill-danger text-danger" : "text-ink-soft"} />
        </button>
      </div>

      <div className="ob-container pt-5">
        <Link to={`/vendors/${meal.vendorId}`} className="text-xs font-medium text-nude-600">
          {meal.vendorName}
        </Link>
        <h1 className="text-xl font-bold text-ink mt-1">{meal.name}</h1>
        <div className="flex items-center gap-3 mt-2">
          <Rating value={meal.rating} count={meal.reviewCount} />
          <span className="text-lg font-bold text-ink">{formatCurrency(meal.price)}</span>
        </div>

        {meal.tags?.length > 0 && (
          <div className="flex gap-2 mt-3">
            {meal.tags.map((t) => (
              <span key={t} className="badge bg-nude-100 text-nude-700">
                {t}
              </span>
            ))}
          </div>
        )}

        <p className="text-sm text-ink-soft leading-relaxed mt-4">{meal.description}</p>

        <div className="flex items-center gap-4 mt-6">
          <span className="text-sm font-medium text-ink-soft">Quantity</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="btn-icon">
              <FiMinus size={14} />
            </button>
            <span className="text-base font-semibold w-5 text-center">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="btn-icon">
              <FiPlus size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-app bg-paper-raised border-t border-line p-4 shadow-nav">
        <button onClick={handleAdd} className="btn-primary w-full">
          Add to cart · {formatCurrency(meal.price * qty)}
        </button>
      </div>
    </div>
  );
}
