import { useNavigate } from "react-router-dom";
import { FiMinus, FiPlus, FiTrash2, FiShoppingBag } from "react-icons/fi";
import { useCart } from "../../context/CartContext";
import { formatCurrency } from "../../utils/formatters";
import Modal from "../ui/Modal";
import EmptyState from "../ui/EmptyState";
import { splitCartByVendor } from "../../utils/orderRules";

export default function CartDrawer() {
  const { items, isCartOpen, setCartOpen, updateQty, removeItem, subtotal, vendorCount } = useCart();
  const navigate = useNavigate();
  const grouped = splitCartByVendor(items);

  return (
    <Modal
      open={isCartOpen}
      onClose={() => setCartOpen(false)}
      title="Your cart"
      footer={
        items.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">Subtotal</span>
              <span className="font-semibold text-ink">{formatCurrency(subtotal)}</span>
            </div>
            <button
              className="btn-primary w-full"
              onClick={() => {
                setCartOpen(false);
                navigate("/checkout");
              }}
            >
              Checkout · {formatCurrency(subtotal)}
            </button>
          </div>
        )
      }
    >
      {items.length === 0 ? (
        <EmptyState
          icon={<FiShoppingBag size={22} />}
          title="Your cart is empty"
          description="Browse vendors and add meals to get started."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {vendorCount > 1 && (
            <p className="text-xs text-ink-muted bg-nude-50 rounded-lg px-3 py-2">
              You're ordering from {vendorCount} vendors — one checkout, split automatically into
              separate vendor tickets.
            </p>
          )}
          {grouped.map((group) => (
            <div key={group.vendorId} className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-nude-700 uppercase tracking-wide">
                {group.vendorName}
              </p>
              {group.items.map((item) => (
                <div key={item.mealId} className="flex gap-3 items-center">
                  <img src={item.image} alt={item.name} className="h-14 w-14 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{item.name}</p>
                    <p className="text-xs text-ink-muted">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateQty(item.mealId, item.qty - 1)}
                      className="btn-icon !h-7 !w-7"
                    >
                      <FiMinus size={12} />
                    </button>
                    <span className="text-sm font-medium w-4 text-center">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.mealId, item.qty + 1)}
                      className="btn-icon !h-7 !w-7"
                    >
                      <FiPlus size={12} />
                    </button>
                    <button
                      onClick={() => removeItem(item.mealId)}
                      className="text-ink-muted hover:text-danger ml-1"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
