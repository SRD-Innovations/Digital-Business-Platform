import { IconAlert, IconRefresh, IconWifi, IconWifiOff } from "@/components/Icons";
import type { SyncStatus } from "@/lib/offline/sync";

export type SyncUiState = "online" | "syncing" | "offline-queued" | "conflict";

export function syncUiState(sync: SyncStatus): SyncUiState {
  if (sync.lastError) return "conflict";
  if (sync.flushing) return "syncing";
  if (!sync.online) return "offline-queued";
  if (sync.pendingCount > 0) return "offline-queued";
  return "online";
}

const COPY: Record<SyncUiState, { label: string; Icon: typeof IconWifi }> = {
  online: { label: "Online", Icon: IconWifi },
  syncing: { label: "Syncing", Icon: IconRefresh },
  "offline-queued": { label: "Offline · queued", Icon: IconWifiOff },
  conflict: { label: "Sync conflict", Icon: IconAlert },
};

type Props = {
  sync: SyncStatus;
  fromCache?: boolean;
};

export function SyncIndicator({ sync, fromCache }: Props) {
  const state = syncUiState(sync);
  const { label, Icon } = COPY[state];
  const extra =
    sync.pendingCount > 0 && state !== "conflict"
      ? ` · ${sync.pendingCount}`
      : fromCache && state === "online"
        ? " · catalog cached"
        : "";

  return (
    <span className="sync-indicator" data-state={state} title={sync.lastError ?? label}>
      <Icon />
      {state === "offline-queued" && sync.online ? "Queued" : label}
      {extra}
    </span>
  );
}
