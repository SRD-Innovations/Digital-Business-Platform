import type { AuthResponse, User } from "@/lib/api";

const TOKEN_KEY = "dbp_token";
const USER_KEY = "dbp_user";
export const SESSION_EVENT = "dbp-session";

function notifySession() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function saveSession(auth: AuthResponse): void {
  window.localStorage.setItem(TOKEN_KEY, auth.access_token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
  notifySession();
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  notifySession();
}

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifySession();
}
