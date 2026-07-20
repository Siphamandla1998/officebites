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
