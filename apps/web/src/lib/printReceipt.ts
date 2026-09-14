import type { Sale, Tenant, User } from "@/lib/api";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export type ReceiptBusiness = Pick<
  Tenant,
  | "name"
  | "legal_name"
  | "address_line1"
  | "address_line2"
  | "city"
  | "phone"
  | "email"
  | "tin"
  | "vat_number"
>;

export function printReceipt(
  sale: Sale,
  business: ReceiptBusiness,
  options?: { cashierName?: string | null },
): void {
  const win = window.open("", "receipt", "width=360,height=640");
  if (!win) return;

  const displayName = business.legal_name?.trim() || business.name;
  const addressParts = [
    business.address_line1,
    business.address_line2,
    business.city,
  ].filter((part): part is string => Boolean(part?.trim()));

  const metaRows: string[] = [];
  if (business.tin?.trim()) metaRows.push(`TIN ${escapeHtml(business.tin.trim())}`);
  if (business.vat_number?.trim()) metaRows.push(`VAT ${escapeHtml(business.vat_number.trim())}`);
  if (business.phone?.trim()) metaRows.push(`Tel ${escapeHtml(business.phone.trim())}`);
  if (business.email?.trim()) metaRows.push(escapeHtml(business.email.trim()));

  const lines = sale.lines
    .map((line) => {
      const name = escapeHtml(line.product_name);
      return `<tr>
        <td>${name}</td>
        <td class="num">${escapeHtml(line.quantity)}</td>
        <td class="num">${escapeHtml(line.unit_price)}</td>
        <td class="num">${escapeHtml(line.line_total)}</td>
      </tr>`;
    })
    .join("");

  const pays = sale.payments
    .map((p) => `<div>${escapeHtml(p.method)}: Rs ${escapeHtml(p.amount)}</div>`)
    .join("");

  const cashier = options?.cashierName?.trim()
    ? `<div class="muted">Cashier: ${escapeHtml(options.cashierName.trim())}</div>`
    : "";

  win.document.write(`<!doctype html><html><head><title>${escapeHtml(sale.receipt_number)}</title>
    <style>
      @page { size: 80mm auto; margin: 4mm; }
      body {
        font: 12px/1.35 ui-monospace, "Cascadia Mono", Consolas, monospace;
        padding: 8px;
        color: #111;
        width: 72mm;
        margin: 0 auto;
      }
      h1 { font-size: 14px; margin: 0 0 4px; text-align: center; }
      .addr, .meta { text-align: center; color: #444; font-size: 11px; margin: 0 0 2px; }
      .rule { border-top: 1px dashed #999; margin: 8px 0; }
      table { width: 100%; border-collapse: collapse; margin: 6px 0; }
      th, td { padding: 2px 0; vertical-align: top; }
      th { font-weight: 600; border-bottom: 1px dashed #999; text-align: left; }
      td.num, th.num { text-align: right; }
      .totals { margin-top: 6px; }
      .totals div { display: flex; justify-content: space-between; gap: 8px; }
      .muted { color: #666; font-size: 11px; text-align: center; margin-top: 4px; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <h1>${escapeHtml(displayName)}</h1>
    ${addressParts.map((part) => `<div class="addr">${escapeHtml(part)}</div>`).join("")}
    ${metaRows.map((row) => `<div class="meta">${row}</div>`).join("")}
    <div class="rule"></div>
    <div class="muted">${escapeHtml(sale.receipt_number)} · ${escapeHtml(sale.status)}</div>
    <div class="muted">${escapeHtml(formatWhen(sale.created_at))}</div>
    ${cashier}
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="num">Qty</th>
          <th class="num">Price</th>
          <th class="num">Amt</th>
        </tr>
      </thead>
      <tbody>${lines}</tbody>
    </table>
    <div class="rule"></div>
    <div class="totals">
      <div><span>Subtotal</span><span>Rs ${escapeHtml(sale.subtotal)}</span></div>
      <div><span>Discount</span><span>Rs ${escapeHtml(sale.discount_total)}</span></div>
      <div><strong>Total</strong><strong>Rs ${escapeHtml(sale.total)}</strong></div>
    </div>
    <div class="rule"></div>
    ${pays}
    <div class="muted">Thank you</div>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`);
  win.document.close();
}

export function receiptBusinessFromUser(user: User): ReceiptBusiness {
  return user.tenant;
}
