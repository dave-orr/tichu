// Persistent client session identity + room memory, stored in localStorage so a
// player can reconnect to the same seat after a refresh, crash, or dropped
// connection. Works for guests and authenticated users alike.

const SESSION_KEY = 'tichu:sessionId';
const ROOM_KEY = 'tichu:room';

/** A stable random id for this browser, created once and reused. */
export function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back to a per-load id.
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

/** Remember the room we're currently in so a reload can attempt to rejoin. */
export function saveRoom(code: string): void {
  try {
    localStorage.setItem(ROOM_KEY, code);
  } catch { /* ignore */ }
}

export function loadRoom(): string | null {
  try {
    return localStorage.getItem(ROOM_KEY);
  } catch {
    return null;
  }
}

export function clearRoom(): void {
  try {
    localStorage.removeItem(ROOM_KEY);
  } catch { /* ignore */ }
}
