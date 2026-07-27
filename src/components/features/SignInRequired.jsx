import { useNavigate } from "react-router-dom";
import { FiLogIn } from "react-icons/fi";

/**
 * Shown in place of a page's content when that feature needs an account —
 * used for messaging and notifications, which need a stable identity to
 * attach conversations/alerts to. Ordering itself never uses this.
 */
export default function SignInRequired({ title, description }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="h-14 w-14 rounded-2xl bg-nude-100 flex items-center justify-center text-nude-600 mb-4">
        <FiLogIn size={22} />
      </div>
      <h4 className="text-sm font-semibold text-ink mb-1">{title}</h4>
      <p className="text-xs text-ink-muted max-w-[240px]">{description}</p>
      <button onClick={() => navigate("/login")} className="btn-primary mt-4">
        Sign in / Create account
      </button>
    </div>
  );
}
