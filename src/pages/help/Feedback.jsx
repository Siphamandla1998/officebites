import { useState } from "react";
import { FiStar, FiThumbsUp, FiCheckCircle } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import TextAreaField from "../../components/forms/TextAreaField";
import Spinner from "../../components/ui/Spinner";
import { supportService } from "../../services/supportService";
import { useToast } from "../../context/ToastContext";

export default function Feedback() {
  const { showToast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [recommend, setRecommend] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      showToast("Please choose a star rating", { type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      await supportService.submitFeedback({ rating, comment, recommend });
      setSubmitted(true);
    } catch (err) {
      showToast(err.message || "Couldn't submit feedback", { type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-8">
      <Navbar showBack title="Feedback" showCart={false} />
      <div className="ob-container pt-4">
        {submitted ? (
          <div className="card p-6 flex flex-col items-center text-center gap-2">
            <div className="h-12 w-12 rounded-full bg-success/10 text-success flex items-center justify-center">
              <FiCheckCircle size={22} />
            </div>
            <h3 className="text-base font-semibold text-ink">Thanks for your feedback!</h3>
            <p className="text-sm text-ink-muted">It helps us make OfficeBites support better.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="card p-5 flex flex-col items-center gap-3">
              <p className="text-sm font-medium text-ink">How was your support experience?</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} stars`}>
                    <FiStar size={28} className={rating >= star ? "fill-nude-500 text-nude-500" : "text-nude-200"} />
                  </button>
                ))}
              </div>
            </div>

            <TextAreaField
              label="Comments (optional)"
              placeholder="Tell us more..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />

            <div>
              <p className="field-label">Would you recommend OfficeBites?</p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setRecommend(true)}
                  className={recommend === true ? "btn-primary flex-1" : "btn-outline flex-1"}
                >
                  <FiThumbsUp size={14} /> Yes
                </button>
                <button
                  type="button"
                  onClick={() => setRecommend(false)}
                  className={recommend === false ? "btn-primary flex-1" : "btn-outline flex-1"}
                >
                  Not yet
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? <Spinner size={16} className="!border-paper/30 !border-t-paper" /> : "Submit feedback"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
