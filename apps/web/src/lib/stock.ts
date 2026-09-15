export type StockTone = "in-stock" | "low-stock" | "out-of-stock";

const LOW_STOCK = 5;

export function stockTone(quantity: number | string): StockTone {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) return "out-of-stock";
  if (qty <= LOW_STOCK) return "low-stock";
  return "in-stock";
}

export function stockBadgeClass(tone: StockTone): string {
  if (tone === "out-of-stock") return "badge badge-danger";
  if (tone === "low-stock") return "badge badge-warning";
  return "badge badge-success";
}

export function stockLabel(tone: StockTone): string {
  if (tone === "out-of-stock") return "Out";
  if (tone === "low-stock") return "Low";
  return "In stock";
}

export type ExpiryTone = "ok" | "warning" | "danger";

export function expiryTone(date: string | null | undefined): ExpiryTone {
  if (!date) return "ok";
  const days = (new Date(date).getTime() - Date.now()) / 86_400_000;
  if (Number.isNaN(days) || days < 0) return "danger";
  if (days <= 30) return "warning";
  return "ok";
}

export function expiryBadgeClass(tone: ExpiryTone): string {
  if (tone === "danger") return "badge badge-danger";
  if (tone === "warning") return "badge badge-warning";
  return "badge badge-neutral";
}

export function expiryLabel(date: string, tone: ExpiryTone): string {
  if (tone === "danger") return `Expired ${date}`;
  if (tone === "warning") return `Exp ${date}`;
  return `Exp ${date}`;
}
