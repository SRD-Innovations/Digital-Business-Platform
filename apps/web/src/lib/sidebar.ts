const SIDEBAR_KEY = "dbp_sidebar_collapsed";

type Listener = (collapsed: boolean) => void;

let collapsed = false;
let hydrated = false;
const listeners = new Set<Listener>();

function readStored(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStored(value: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function notify() {
  for (const listener of listeners) listener(collapsed);
}

/** Call once on the client before reading; keeps header + shell in sync. */
export function hydrateSidebar(): boolean {
  if (typeof window === "undefined") return false;
  if (!hydrated) {
    collapsed = readStored();
    hydrated = true;
  }
  return collapsed;
}

export function getSidebarCollapsed(): boolean {
  if (typeof window !== "undefined" && !hydrated) hydrateSidebar();
  return collapsed;
}

export function setSidebarCollapsed(value: boolean): void {
  if (typeof window !== "undefined" && !hydrated) hydrateSidebar();
  if (collapsed === value) return;
  collapsed = value;
  if (typeof window !== "undefined") writeStored(value);
  notify();
}

export function toggleSidebar(): void {
  setSidebarCollapsed(!getSidebarCollapsed());
}

export function subscribeSidebar(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
