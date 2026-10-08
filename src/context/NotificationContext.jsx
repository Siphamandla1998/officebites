import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

  const [notificationState, setNotificationState] = useState({ uid: null, items: [] });
  const [failure, setFailure] = useState(null);
  const notifications = useMemo(() => notificationState.uid === user?.id ? notificationState.items : [], [notificationState, user?.id]);
  const setNotifications = useCallback(value => setNotificationState(current => ({
    uid: user?.id,
    items: typeof value === 'function' ? value(current.uid === user?.id ? current.items : []) : value,
  })), [user?.id]);
  const [loading, setLoading] = useState(false);
  const currentUser = useRef(user?.id);
  const request = useRef(0);
  const inFlight = useRef(new Map());
  if (currentUser.current !== user?.id) request.current++;
  currentUser.current = user?.id;

  const refresh = useCallback(async () => {
    const uid = user?.id;
    if (inFlight.current.get(uid) === request.current) return;
    const attempt = ++request.current;
    if (!isAuthenticated || !user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    inFlight.current.set(uid, attempt);
    setFailure(null);
    setLoading(true);

    try {
      const data = await notificationService.getNotifications();
      if (currentUser.current === uid && request.current === attempt) setNotifications(data);
    } catch (error) {
      console.error("Failed to load notifications:", error);
      if (currentUser.current === uid && request.current === attempt) setFailure({ uid, error });
    } finally {
      if (inFlight.current.get(uid) === attempt) inFlight.current.delete(uid);
      if (currentUser.current === uid && request.current === attempt) setLoading(false);
    }
  }, [isAuthenticated, user?.id, setNotifications]);

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
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (currentUser.current !== user.id) return;
          if (payload.eventType === "DELETE") {
            setNotifications((current) => current.filter((item) => item.id !== payload.old.id));
            return;
          }
          const incoming = mapNotification(payload.new);

          if (payload.eventType !== "INSERT") {
            setNotifications((current) => incoming.dismissed
              ? current.filter((item) => item.id !== incoming.id)
              : current.map((item) => item.id === incoming.id ? incoming : item));
            return;
          }

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
        if (status === "SUBSCRIBED") refresh();
        if (import.meta.env.DEV) {
          console.debug("Notification realtime:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, showToast, refresh, setNotifications]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return undefined;
    const update = () => { if (document.visibilityState !== "hidden") refresh(); };
    const timer = setInterval(update, 30000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [isAuthenticated, user?.id, refresh]);

  const markAsRead = useCallback(async (id) => {
    const uid = user?.id;
    await notificationService.markAsRead(id);
    if (currentUser.current !== uid) return false;

    setNotifications((current) =>
      current.map((item) =>
        item.id === id ? { ...item, read: true } : item
      )
    );
    return true;
  }, [user?.id, setNotifications]);

  const dismiss = useCallback(async (id) => {
    const uid = user?.id;
    await notificationService.dismiss(id);
    if (currentUser.current !== uid) return;

    setNotifications((current) =>
      current.filter((item) => item.id !== id)
    );
  }, [user?.id, setNotifications]);

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
      error: failure?.uid === user?.id ? failure.error : null,
      unreadCount,
      loading,
      refresh,
      markAsRead,
      dismiss,
    }),
    [
      notifications,
      failure,
      user?.id,
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
