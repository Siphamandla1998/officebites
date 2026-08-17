import { Link } from "react-router-dom";
import { FiMessageCircle } from "react-icons/fi";
import Navbar from "../../components/layout/Navbar";
import Avatar from "../../components/ui/Avatar";
import EmptyState from "../../components/ui/EmptyState";
import SignInRequired from "../../components/features/SignInRequired";
import { useAsync } from "../../hooks/useAsync";
import { chatService } from "../../services/chatService";
import { useAuth } from "../../context/AuthContext";
import { formatRelativeTime } from "../../utils/formatters";

export default function ChatList() {
  const { user, isAuthenticated } = useAuth();
  const { data: conversations, loading } = useAsync(
    () => (isAuthenticated ? chatService.getConversations(user.id) : Promise.resolve([])),
    [isAuthenticated, user?.id]
  );

  if (!isAuthenticated) {
    return (
      <div>
        <Navbar showBack title="Messages" showCart={false} />
        <SignInRequired
          title="Sign in to message vendors"
          description="Messaging keeps a history tied to your account, so it needs you to be signed in."
        />
      </div>
    );
  }

  return (
    <div>
      <Navbar showBack title="Messages" showCart={false} />
      <div className="ob-container pt-4 pb-8 flex flex-col gap-2.5">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-16" />)
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={<FiMessageCircle size={20} />}
            title="No conversations yet"
            description="Message a vendor from their profile page."
          />
        ) : (
          conversations.map((c) => {
            const last = c.messages[c.messages.length - 1];
            const unread = c.messages.filter((m) => m.senderId !== user?.id && !m.read).length;
            return (
              <Link key={c.id} to={`/chat/${c.id}`} className="card p-3.5 flex items-center gap-3">
                <Avatar name={c.vendorName} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink truncate">{c.vendorName}</p>
                  <p className="text-xs text-ink-muted truncate">{last?.text || "Start the conversation"}</p>
                </div>
                {unread > 0 && (
                  <span className="h-5 min-w-[20px] px-1 rounded-full bg-nude-500 text-[10px] text-paper flex items-center justify-center font-semibold shrink-0">
                    {unread}
                  </span>
                )}
                {last && <span className="text-[11px] text-ink-muted shrink-0">{formatRelativeTime(last.time)}</span>}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
