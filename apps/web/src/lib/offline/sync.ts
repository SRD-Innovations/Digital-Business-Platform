import { ApiError, apiFetch, type Product, type Sale } from "@/lib/api";
import {
  adjustCachedStock,
  cacheProducts,
  enqueueCheckout,
  getSyncMeta,
  listPendingCheckouts,
  markPendingError,
  readCachedProducts,
  removePendingCheckout,
  setLastSynced,
  type PendingCheckoutOp,
} from "@/lib/offline/db";
import { getDeviceId, newClientOpId } from "@/lib/offline/ids";

export type SyncStatus = {
  online: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  flushing: boolean;
  lastError: string | null;
};

export function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export async function loadProductsForPos(
  token: string,
  tenantId: string,
): Promise<{ products: Product[]; fromCache: boolean }> {
  try {
    const products = await apiFetch<Product[]>("/v1/products", { token });
    await cacheProducts(
      tenantId,
      products.map((product) => ({ ...product, tenant_id: tenantId })),
    );
    await setLastSynced(tenantId, new Date().toISOString());
    return { products, fromCache: false };
  } catch (err) {
    const cached = await readCachedProducts(tenantId);
    if (cached.length) {
      return {
        products: cached.map(({ tenant_id: _t, ...product }) => product),
        fromCache: true,
      };
    }
    throw err;
  }
}

export async function enqueueOfflineCheckout(input: {
  tenantId: string;
  discountTotal: string;
  lines: { product_id: string; quantity: string }[];
  payments: { method: string; amount: string }[];
  parkedBillId?: string | null;
}): Promise<PendingCheckoutOp> {
  const clientOpId = newClientOpId();
  const op: PendingCheckoutOp = {
    id: clientOpId,
    tenant_id: input.tenantId,
    created_at: new Date().toISOString(),
    attempts: 0,
    last_error: null,
    payload: {
      client_op_id: clientOpId,
      device_id: getDeviceId(),
      discount_total: input.discountTotal,
      parked_bill_id: input.parkedBillId ?? null,
      lines: input.lines,
      payments: input.payments,
    },
  };
  await enqueueCheckout(op);
  for (const line of input.lines) {
    await adjustCachedStock(line.product_id, -Number(line.quantity));
  }
  return op;
}

export async function checkoutOnlineOrQueue(input: {
  token: string;
  tenantId: string;
  discountTotal: string;
  lines: { product_id: string; quantity: string }[];
  payments: { method: string; amount: string }[];
  parkedBillId?: string | null;
}): Promise<{ sale: Sale | null; queued: boolean }> {
  const clientOpId = newClientOpId();
  const deviceId = getDeviceId();
  const body = {
    discount_total: input.discountTotal,
    parked_bill_id: input.parkedBillId ?? null,
    client_op_id: clientOpId,
    device_id: deviceId,
    lines: input.lines,
    payments: input.payments,
  };

  if (!isBrowserOnline()) {
    await enqueueOfflineCheckout({
      tenantId: input.tenantId,
      discountTotal: input.discountTotal,
      lines: input.lines,
      payments: input.payments,
      parkedBillId: input.parkedBillId,
    });
    return { sale: null, queued: true };
  }

  try {
    const sale = await apiFetch<Sale>("/v1/pos/checkout", {
      method: "POST",
      token: input.token,
      body: JSON.stringify(body),
    });
    await setLastSynced(input.tenantId, new Date().toISOString());
    return { sale, queued: false };
  } catch (err) {
    const networkish =
      err instanceof ApiError && (err.status === 0 || err.status >= 500);
    if (networkish || !isBrowserOnline()) {
      await enqueueCheckout({
        id: clientOpId,
        tenant_id: input.tenantId,
        created_at: new Date().toISOString(),
        attempts: 0,
        last_error: err instanceof Error ? err.message : "Network error",
        payload: {
          client_op_id: clientOpId,
          device_id: deviceId,
          discount_total: input.discountTotal,
          parked_bill_id: input.parkedBillId ?? null,
          lines: input.lines,
          payments: input.payments,
        },
      });
      for (const line of input.lines) {
        await adjustCachedStock(line.product_id, -Number(line.quantity));
      }
      return { sale: null, queued: true };
    }
    throw err;
  }
}

let flushLock = false;

export async function flushPendingCheckouts(
  token: string,
  tenantId: string,
): Promise<{ synced: number; error: string | null }> {
  if (flushLock || !isBrowserOnline()) {
    return { synced: 0, error: null };
  }
  flushLock = true;
  let synced = 0;
  let error: string | null = null;
  try {
    const pending = await listPendingCheckouts(tenantId);
    for (const op of pending) {
      try {
        await apiFetch<Sale>("/v1/pos/checkout", {
          method: "POST",
          token,
          body: JSON.stringify(op.payload),
        });
        await removePendingCheckout(op.id);
        synced += 1;
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Sync failed";
        await markPendingError(op.id, message);
        error = message;
        break;
      }
    }
    if (synced > 0) {
      await setLastSynced(tenantId, new Date().toISOString());
    }
  } finally {
    flushLock = false;
  }
  return { synced, error };
}

export async function readSyncStatus(tenantId: string): Promise<SyncStatus> {
  const meta = await getSyncMeta();
  const pending = await listPendingCheckouts(tenantId);
  return {
    online: isBrowserOnline(),
    pendingCount: pending.length,
    lastSyncedAt: meta.last_synced_at,
    flushing: flushLock,
    lastError: pending.find((op) => op.last_error)?.last_error ?? null,
  };
}
