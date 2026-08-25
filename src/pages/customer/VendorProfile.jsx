import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiMapPin, FiMessageCircle } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import FoodCard from "../../components/features/FoodCard";
import Rating from "../../components/ui/Rating";
import Avatar from "../../components/ui/Avatar";
import { useAsync } from "../../hooks/useAsync";
import { vendorService } from "../../services/vendorService";
import { useCart } from "../../context/CartContext";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { chatService } from "../../services/chatService";
import { formatRelativeTime } from "../../utils/formatters";
import { nextOrderableDate } from "../../utils/orderRules";

const TABS = ["Menu", "Reviews", "About"];

export default function VendorProfile() {
  const { id } = useParams();
  const [tab, setTab] = useState("Menu");
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const { data: vendor, loading: vendorLoading } = useAsync(() => vendorService.getVendorById(id), [id]);
  const { data: menu, loading: menuLoading } = useAsync(
    () => vendorService.getVendorMenu(id, { forDate: nextOrderableDate() }),
    [id]
  );
  const { data: reviews, loading: reviewsLoading } = useAsync(
    () => vendorService.getVendorReviews(id),
    [id]
  );

  const handleAdd = (meal) => {
    addItem(meal);
    showToast(`Added ${meal.name} to cart`, { type: "success" });
  };

  const handleChat = async () => {
    if (!vendor) return;
    if (!isAuthenticated) {
      showToast("Sign in to message vendors", { type: "info" });
      navigate("/login", { state: { from: { pathname: `/vendors/${vendor.id}` } } });
      return;
    }
    const convo = await chatService.startConversation({
      vendorId: vendor.id,
      vendorName: vendor.name,
      customerId: user.id,
    });
    navigate(`/chat/${convo.id}`);
  };

  if (vendorLoading || !vendor) {
    return (
      <div>
        <Navbar showBack />
        <div className="ob-container pt-4"><div className="skeleton h-40" /></div>
      </div>
    );
  }

  return (
    <div>
      <Navbar showBack transparent />
      <div className="-mt-16">
        <img src={vendor.coverImage} alt={vendor.name} className="h-44 w-full object-cover" />
      </div>

      <div className="ob-container -mt-8 relative">
        <div className="card p-4">
          <div className="flex items-start gap-3">
            <Avatar src={vendor.logo} name={vendor.name} size={56} className="rounded-xl !rounded-xl" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-ink truncate">{vendor.name}</h1>
              <p className="text-xs text-ink-muted">{vendor.tagline}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <Rating value={vendor.rating} count={vendor.reviewCount} />
              </div>
            </div>
            <button onClick={handleChat} className="btn-icon" aria-label="Message vendor">
              <FiMessageCircle size={16} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-ink-muted mt-3 pt-3 border-t border-line">
            <FiMapPin size={12} /> {vendor.building}
          </div>
        </div>
      </div>

      <div className="ob-container mt-5 flex gap-2 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-1 pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? "border-ink text-ink" : "border-transparent text-ink-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="ob-container mt-4 pb-8">
        {tab === "Menu" && (
          <div className="flex flex-col gap-3">
            {menuLoading
              ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24" />)
              : menu.map((m) => <FoodCard key={m.id} meal={m} onAdd={handleAdd} layout="row" />)}
          </div>
        )}

        {tab === "Reviews" && (
          <div className="flex flex-col gap-4">
            {reviewsLoading ? (
              <div className="skeleton h-20" />
            ) : reviews.length === 0 ? (
              <p className="text-sm text-ink-muted text-center py-8">No reviews yet.</p>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink">{r.customerName}</span>
                    <Rating value={r.rating} />
                  </div>
                  <p className="text-sm text-ink-soft mt-1.5">{r.comment}</p>
                  <p className="text-xs text-ink-muted mt-1.5">{formatRelativeTime(r.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "About" && (
          <div className="card p-4 flex flex-col gap-3 text-sm text-ink-soft">
            <p>{vendor.name} serves {vendor.category.toLowerCase()} from {vendor.building}.</p>
            <div className="flex justify-between border-t border-line pt-3">
              <span className="text-ink-muted">Location</span>
              <span className="text-ink font-medium">{vendor.building}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">On OfficeBites since</span>
              <span className="text-ink font-medium">{new Date(vendor.joinedAt).toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
