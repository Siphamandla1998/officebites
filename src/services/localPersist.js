// Generic localStorage-backed persistence for the mock service layer.
// Each service that needs to survive a refresh (orders, notifications,
// chat) calls loadState() once at module init to seed its in-memory store,
// then saveState() after every mutation. This is intentionally simple
// (synchronous, JSON-serialized) — a real backend replaces all of this
// wholesale, so it isn't worth more machinery than that.

const PREFIX = "ob_store_";

export function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveState(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable (private browsing) — fail silently,
    // the app still works for the current session either way.
  }
}
