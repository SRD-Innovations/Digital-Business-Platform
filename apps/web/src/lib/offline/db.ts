"use client";

const DB_NAME = "dbp-offline";
const DB_VERSION = 1;

export type CachedProduct = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit_price: string;
  stock_on_hand: string;
  is_active: boolean;
  tenant_id: string;
};

export type PendingCheckoutOp = {
  id: string;
  tenant_id: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
  payload: {
    client_op_id: string;
    device_id: string;
    discount_total: string;
    note?: string | null;
    parked_bill_id?: string | null;
    lines: { product_id: string; quantity: string }[];
    payments: { method: string; amount: string }[];
  };
};

export type SyncMeta = {
  key: string;
  last_synced_at: string | null;
  tenant_id: string | null;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("products")) {
        const products = db.createObjectStore("products", { keyPath: "id" });
        products.createIndex("tenant_id", "tenant_id", { unique: false });
      }
      if (!db.objectStoreNames.contains("pending_ops")) {
        const ops = db.createObjectStore("pending_ops", { keyPath: "id" });
        ops.createIndex("tenant_id", "tenant_id", { unique: false });
        ops.createIndex("created_at", "created_at", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function cacheProducts(tenantId: string, products: CachedProduct[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("products", "readwrite");
  const store = tx.objectStore("products");
  const existing = await req(store.index("tenant_id").getAll(tenantId));
  for (const row of existing) {
    store.delete(row.id);
  }
  for (const product of products) {
    store.put({ ...product, tenant_id: tenantId });
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("cacheProducts failed"));
  });
  db.close();
}

export async function readCachedProducts(tenantId: string): Promise<CachedProduct[]> {
  const db = await openDb();
  const tx = db.transaction("products", "readonly");
  const rows = await req(tx.objectStore("products").index("tenant_id").getAll(tenantId));
  db.close();
  return rows;
}

export async function adjustCachedStock(
  productId: string,
  delta: number,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("products", "readwrite");
  const store = tx.objectStore("products");
  const row = await req(store.get(productId));
  if (row) {
    const next = Math.max(0, Number(row.stock_on_hand) + delta);
    store.put({ ...row, stock_on_hand: String(next) });
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("adjustCachedStock failed"));
  });
  db.close();
}

export async function enqueueCheckout(op: PendingCheckoutOp): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("pending_ops", "readwrite");
  tx.objectStore("pending_ops").put(op);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("enqueueCheckout failed"));
  });
  db.close();
}

export async function listPendingCheckouts(tenantId: string): Promise<PendingCheckoutOp[]> {
  const db = await openDb();
  const tx = db.transaction("pending_ops", "readonly");
  const rows = await req(tx.objectStore("pending_ops").index("tenant_id").getAll(tenantId));
  db.close();
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function removePendingCheckout(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("pending_ops", "readwrite");
  tx.objectStore("pending_ops").delete(id);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("removePendingCheckout failed"));
  });
  db.close();
}

export async function markPendingError(id: string, message: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("pending_ops", "readwrite");
  const store = tx.objectStore("pending_ops");
  const row = await req(store.get(id));
  if (row) {
    store.put({ ...row, attempts: row.attempts + 1, last_error: message });
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("markPendingError failed"));
  });
  db.close();
}

export async function getSyncMeta(): Promise<SyncMeta> {
  const db = await openDb();
  const tx = db.transaction("meta", "readonly");
  const row = await req(tx.objectStore("meta").get("sync"));
  db.close();
  return row ?? { key: "sync", last_synced_at: null, tenant_id: null };
}

export async function setLastSynced(tenantId: string, iso: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("meta", "readwrite");
  tx.objectStore("meta").put({ key: "sync", last_synced_at: iso, tenant_id: tenantId });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("setLastSynced failed"));
  });
  db.close();
}
