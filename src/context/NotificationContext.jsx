import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../services/api/supabaseClient";
import { notificationService } from "../services/notificationService";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

const NotificationContext = createContext(null);

const mapNotification = (notification) => ({
  id: notification.id,
  type: notification.type || "general",
  title: notification.title,
  body: notification.body,
  read: notification.read ?? false,
  dismissed: notification.dismissed ?? false,
  actionUrl: notification.action_url || null,
  metadata: notification.metadata || {},
  createdAt: notification.created_at,
});

function shouldVibrate(type) {
  return [
    "message",
    "order_status",
    "support",
    "payment",
    "payment_confirmed",
    "new_order",
  ].includes(type);
}

function vibrationPattern(type) {
  switch (type) {
    case "new_order":
    case "payment_confirmed":
      return [150, 80, 150];

    case "message":
      return [100];

    case "order_status":
    case "support":
    case "payment":
      return [120];

    default:
      return [];
  }
}

export function NotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setNotifications([]);
      return;
    }

    setLoading(true);

    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      return undefined;
    }

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const incoming = mapNotification(payload.new);

          if (incoming.dismissed) {
            return;
          }

          setNotifications((current) => {
            if (current.some((item) => item.id === incoming.id)) {
              return current;
            }

            return [incoming, ...current];
          });

          showToast(
            incoming.body
              ? `${incoming.title}: ${incoming.body}`
              : incoming.title || "You have a new notification",
            { type: "info" }
          );

          if (
            shouldVibrate(incoming.type) &&
            typeof navigator !== "undefined" &&
            "vibrate" in navigator
          ) {
            navigator.vibrate(vibrationPattern(incoming.type));
          }
        }
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.debug("Notification realtime:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, showToast]);

  const markAsRead = useCallback(async (id) => {
    await notificationService.markAsRead(id);

    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, read: true } : item
      )
    );
  }, []);

  const dismiss = useCallback(async (id) => {
    await notificationService.dismiss(id);

    setNotifications((current) =>
      current.filter((item) => item.id !== id)
    );
  }, []);

  const unreadCount = useMemo(
    () =>
      notifications.filter(
        (notification) =>
          !notification.read && !notification.dismissed
      ).length,
    [notifications]
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refresh,
      markAsRead,
      dismiss,
    }),
    [
      notifications,
      unreadCount,
      loading,
      refresh,
      markAsRead,
      dismiss,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider"
    );
  }

  return context;
}