const DEVICE_KEY = "dbp_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(DEVICE_KEY, id);
  return id;
}

export function newClientOpId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
