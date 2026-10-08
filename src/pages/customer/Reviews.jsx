import { useNavigate } from "react-router-dom";
import { FiStar } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import EmptyState from "../../components/ui/EmptyState";

// TODO(ratings): re-enable once there's a real reviews table + submission
// path. This page used to render a star-rating + comment form per vendor,
// but "submit" never wrote anything anywhere — it just showed a fake
// "Thanks for your feedback!" toast and navigated away. That's actively
// misleading (customers believe they left real feedback that vendors will
// see; nothing is stored), so the flow is disabled here rather than
// deleted. The original form UI is preserved below, commented out, so
// reactivating this is a matter of restoring it once a reviews table
// migration + orderService.submitReview()-style write actually exists.
export default function Reviews() {
  const navigate = useNavigate();

  return (
    <div className="pb-8">
      <Navbar showBack title="Reviews" showCart={false} />
      <div className="ob-container pt-4">
        <EmptyState
          icon={<FiStar size={20} />}
          title="Reviews aren't open yet"
          description="We're not collecting reviews on OfficeBites just yet — check back soon."
          action={
            <button onClick={() => navigate("/orders")} className="btn-primary">
              Back to orders
            </button>
          }
        />
      </div>
    </div>
  );
}

/* ORIGINAL FORM — restore once real submission is wired up.

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FiStar } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import TextAreaField from "../../components/forms/TextAreaField";
import { useAsync } from "../../hooks/useAsync";
import { orderService } from "../../services/orderService";
import { useToast } from "../../context/ToastContext";

export default function Reviews() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: order, loading } = useAsync(() => orderService.getOrderById(orderId), [orderId]);
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState({});

  const submit = () => {
    // TODO: actually persist ratings/comments before re-enabling.
    showToast("Thanks for your feedback!", { type: "success" });
    navigate("/orders");
  };

  if (loading || !order) {
    return (
      <div>
        <Navbar showBack title="Leave a review" showCart={false} />
        <div className="ob-container pt-4"><div className="skeleton h-40" /></div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <Navbar showBack title="Leave a review" showCart={false} />
      <div className="ob-container pt-4 flex flex-col gap-5">
        {order.subOrders.map((so) => (
          <div key={so.vendorId} className="card p-4">
            <p className="text-sm font-semibold text-ink mb-2.5">{so.vendorName}</p>
            <div className="flex gap-1.5 mb-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRatings((r) => ({ ...r, [so.vendorId]: star }))}
                >
                  <FiStar
                    size={22}
                    className={
                      (ratings[so.vendorId] || 0) >= star
                        ? "fill-nude-500 text-nude-500"
                        : "text-nude-200"
                    }
                  />
                </button>
              ))}
            </div>
            <TextAreaField
              placeholder={`How was your order from ${so.vendorName}?`}
              rows={3}
              value={comments[so.vendorId] || ""}
              onChange={(e) => setComments((c) => ({ ...c, [so.vendorId]: e.target.value }))}
            />
          </div>
        ))}
        <button onClick={submit} className="btn-primary w-full">
          Submit review
        </button>
      </div>
    </div>
  );
}

*/
