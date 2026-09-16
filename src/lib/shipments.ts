import { apiClient } from "./apiClient";
import { API_URL } from "./apiUrl";
import { getToken } from "./auth";

export type BookShipmentPackageInput = {
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  quantity?: number;
  description?: string;
  is_document?: boolean;
  declared_value?: number;
  insured?: boolean;
  product_type?: string | null;
  product_type_other?: string;
  // Which Insurance Add-on (if any) was sold for this package — lets the backend decide whether
  // to declare this value to the carrier as ITS OWN insurance service (never for UPSC).
  insurance_addon_item_id?: number | null;
};

export type BookShipmentAddonLine = {
  name: string;
  category?: string;
  quantity: number;
  unit_price: number;
};

export type BookShipmentInput = {
  agent_account_id: number;
  carrier: "UPS" | "DHL";
  service_code: string;
  service_label?: string;
  origin: {
    contact_name?: string;
    company?: string;
    tax_id?: string;
    postcode: string;
    city: string;
    address: string;
    address2?: string;
    address3?: string;
    phone?: string;
    notes?: string;
  };
  destination: {
    contact_name?: string;
    company?: string;
    tax_id?: string;
    country: string;
    city: string;
    postcode?: string;
    address?: string;
    address2?: string;
    address3?: string;
    phone?: string;
    email?: string;
    notes?: string;
  };
  packages: BookShipmentPackageInput[];
  declared_value_currency?: string;
  addon_lines?: BookShipmentAddonLine[];
  freight_amount: number;
  addon_total: number;
  order_total: number;
  currency?: string;
  // Everything else filled in at /shipment/create Step 1 (Customer Type / Individual Category)
  // and Step 4 (Payment Info) — not used by any carrier API, but saved for the record regardless.
  customer_type?: string;
  entity_type?: "INDIVIDUAL" | "COMPANY";
  payment_method?: string;
  bill_transportation_to?: string;
  bill_duty_tax_to?: string;
  ref_invoice_no?: string;
  ref_insurance_no?: string;
  ref_purchase_no?: string;
  // The full Rate Quote card that was selected (zone/transit/chargeBreakdown/raw carrier data) —
  // service_code/service_label alone don't capture everything shown/picked at Check Rate.
  rate_quote?: unknown;
};

export type ShipmentAddress = {
  contact_name?: string;
  company?: string;
  tax_id?: string;
  postcode?: string;
  city?: string;
  country?: string;
  address?: string;
  address2?: string;
  address3?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export type ShipmentPackageRecord = {
  weight: number;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  quantity?: number;
  description?: string | null;
  is_document?: boolean;
  declared_value?: number | null;
  insured?: boolean;
  product_type?: string | null;
  product_type_other?: string | null;
  insurance_addon_item_id?: number | null;
};

export type ShipmentAddonLine = {
  name: string;
  category?: string | null;
  quantity: number;
  unit_price: number;
};

export type Shipment = {
  id: number;
  agent_account_id: number;
  carrier: "UPS" | "DHL";
  service_code: string;
  service_label: string | null;
  tracking_number: string | null;
  status: "pending" | "booked" | "failed";
  origin?: ShipmentAddress | null;
  destination?: ShipmentAddress | null;
  packages?: ShipmentPackageRecord[];
  addon_lines?: ShipmentAddonLine[];
  freight_amount: number;
  addon_total: number;
  order_total: number;
  currency: string;
  customer_type?: string | null;
  entity_type?: string | null;
  payment_method?: string | null;
  bill_transportation_to?: string | null;
  bill_duty_tax_to?: string | null;
  ref_invoice_no?: string | null;
  ref_insurance_no?: string | null;
  ref_purchase_no?: string | null;
  rate_quote?: Record<string, unknown> | null;
  label_storage_key: string | null;
  error_message: string | null;
  created_at: string;
  agent_account?: { id: number; username_acc: string; agent?: { agent_code: string; name?: string; logo_url?: string } } | null;
};

export type PaginatedShipments = {
  data: Shipment[];
  current_page: number;
  last_page: number;
  total: number;
};

export const listShipments = (params?: { search?: string; carrier?: "UPS" | "DHL"; status?: string; page?: number }) => {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.carrier) query.set("carrier", params.carrier);
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiClient.get<PaginatedShipments>(`/shipments${qs ? `?${qs}` : ""}`);
};

export const bookShipment = (data: BookShipmentInput) => apiClient.post<Shipment>("/shipments", data);

export const getShipment = (id: number) => apiClient.get<Shipment>(`/shipments/${id}`);

// A booked Shipment is otherwise fully immutable — only these 3 reference numbers can still be
// edited afterwards (see /shipment/view/[id]).
export const updateShipmentRefs = (
  id: number,
  data: { ref_invoice_no?: string; ref_insurance_no?: string; ref_purchase_no?: string },
) => apiClient.put<Shipment>(`/shipments/${id}/refs`, data);

// The label route returns a raw binary file (not JSON) and needs the Bearer token — apiClient
// can't be reused as-is, so this fetches the blob and opens a dedicated print-preview window
// (UPS GIF labels come back rotated 90° — rotated back here for a normal upright read/print;
// PDF labels from DHL are already upright, just shown full-page and print() is triggered too).
export async function openShipmentLabel(shipmentId: number) {
  // Must open synchronously within the click handler, before the async fetch, or popup blockers
  // will silently swallow it.
  const printWindow = window.open("", "_blank");

  const token = getToken();
  const res = await fetch(`${API_URL}/shipments/${shipmentId}/label`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    printWindow?.close();
    throw new Error("เปิด Label ไม่สำเร็จ");
  }

  const contentType = res.headers.get("Content-Type") || "application/octet-stream";
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (!printWindow) {
    // Popup blocked — fall back to a plain new tab (no auto-rotate/auto-print).
    window.open(url, "_blank");
    return;
  }

  if (contentType.startsWith("image/")) {
    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>Shipping Label</title><style>
        html,body{margin:0;height:100%;background:#525659;display:flex;align-items:center;justify-content:center;}
        img{transform:rotate(90deg);max-width:90vh;max-height:90vw;}
        @media print{html,body{background:#fff;}}
      </style></head><body><img id="label-img" src="${url}" /></body></html>`,
    );
    printWindow.document.close();
    const img = printWindow.document.getElementById("label-img") as HTMLImageElement | null;
    if (img) img.onload = () => printWindow.print();
  } else {
    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>Shipping Label</title><style>
        html,body,iframe{margin:0;padding:0;width:100%;height:100%;border:0;}
      </style></head><body><iframe id="label-frame" src="${url}"></iframe></body></html>`,
    );
    printWindow.document.close();
    const frame = printWindow.document.getElementById("label-frame") as HTMLIFrameElement | null;
    if (frame) {
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      };
    }
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function formatAddress(addr?: ShipmentAddress | null): string {
  if (!addr) return "-";
  return [
    addr.contact_name,
    addr.company,
    [addr.address, addr.address2, addr.address3].filter(Boolean).join(" "),
    [addr.city, addr.country].filter(Boolean).join(", "),
    addr.postcode,
    addr.phone,
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br/>");
}

// Builds a printable receipt entirely client-side from an already-booked Shipment (all the
// data it needs — origin/destination/packages/addon_lines/amounts — is already on the record,
// no extra backend endpoint needed) and opens it in a new tab ready to print/save as PDF.
// Styled as a narrow 80mm continuous/thermal receipt slip (POS-style), not an A4 invoice.
export function printShipmentReceipt(shipment: Shipment) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("กรุณาอนุญาต Popup เพื่อพิมพ์ใบเสร็จ");
    return;
  }

  const packageRows = (shipment.packages ?? [])
    .map((p) => {
      const dims = !p.is_document && p.length ? ` / ${escapeHtml(p.length)}x${escapeHtml(p.width)}x${escapeHtml(p.height)}cm` : "";
      const label = `${p.is_document ? "Document" : "Box"} (${escapeHtml(p.weight)}kg${dims}) x${p.quantity ?? 1}`;
      return `<tr><td colspan="2">${label}</td></tr>${
        p.description ? `<tr><td colspan="2" class="muted">${escapeHtml(p.description)}</td></tr>` : ""
      }`;
    })
    .join("");

  const addonRows = (shipment.addon_lines ?? [])
    .map(
      (l) =>
        `<tr><td>${escapeHtml(l.name)} x${l.quantity}</td><td class="right">${(l.quantity * Number(l.unit_price)).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })}</td></tr>`,
    )
    .join("");

  const currency = shipment.currency ?? "THB";
  const fmt = (n: number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Receipt ${escapeHtml(shipment.tracking_number ?? shipment.id)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: 80mm; margin: 0 auto; padding: 4mm; font-family: 'Courier New', monospace; font-size: 12px; color: #000; }
  h1 { font-size: 14px; margin: 0 0 2px; text-align: center; }
  .center { text-align: center; }
  .muted { color: #555; font-size: 11px; }
  .divider { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 1.5px 0; vertical-align: top; }
  .right { text-align: right; }
  .grand td { font-weight: bold; font-size: 13px; }
  @media print { body { padding: 0 4mm; } }
</style>
</head>
<body>
  <h1>ใบเสร็จรับเงิน / Receipt</h1>
  <p class="center muted">${new Date(shipment.created_at).toLocaleString()}</p>
  <hr class="divider" />
  <table>
    <tr><td>Tracking No.</td><td class="right">${escapeHtml(shipment.tracking_number ?? "-")}</td></tr>
    <tr><td>Carrier / Service</td><td class="right">${escapeHtml(shipment.carrier)} - ${escapeHtml(shipment.service_label ?? shipment.service_code)}</td></tr>
  </table>
  <hr class="divider" />
  <div class="muted">ผู้ส่ง / Ship From</div>
  <div>${formatAddress(shipment.origin)}</div>
  <hr class="divider" />
  <div class="muted">ผู้รับ / Ship To</div>
  <div>${formatAddress(shipment.destination)}</div>
  <hr class="divider" />
  <table>${packageRows}</table>
  ${addonRows ? `<hr class="divider" /><table>${addonRows}</table>` : ""}
  <hr class="divider" />
  <table>
    <tr><td>ค่าขนส่ง / Freight</td><td class="right">${fmt(shipment.freight_amount)}</td></tr>
    <tr><td>บริการเพิ่มเติม / Add-ons</td><td class="right">${fmt(shipment.addon_total)}</td></tr>
    <tr class="grand"><td>รวมสุทธิ / Total (${currency})</td><td class="right">${fmt(shipment.order_total)}</td></tr>
  </table>
  <hr class="divider" />
  <p class="center muted">ขอบคุณที่ใช้บริการ / Thank you</p>
</body>
</html>`;

  // `document.write()` on a window.open("", ...) target is unreliable in modern Chrome (renders
  // as a blank about:blank tab) — navigate to a real Blob URL instead, same technique used for
  // the actual label FILE in openShipmentLabel above, and wait for the real `load` event before
  // printing. MUST include charset=utf-8 on the Blob's MIME type itself (not just the <meta> tag)
  // or Thai text renders as mojibake — the browser sniffs a Blob's own declared charset before
  // ever parsing the document to find the <meta> tag.
  const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  printWindow.location.href = blobUrl;
  printWindow.onload = () => {
    printWindow.print();
    URL.revokeObjectURL(blobUrl);
  };
}
