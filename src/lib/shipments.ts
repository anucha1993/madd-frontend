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

// One entry per physical piece/box the carrier actually booked (multi-piece shipment) — each
// has its own carrier tracking number; `label_storage_key` is null for DHL pieces that share
// the one combined label PDF (see ShipmentController::uploadShipmentLabel on the backend).
export type ShipmentPiece = {
  tracking_number: string | null;
  label_storage_key?: string | null;
};

export type Shipment = {
  id: number;
  agent_account_id: number;
  carrier: "UPS" | "DHL";
  service_code: string;
  service_label: string | null;
  tracking_number: string | null;
  pieces?: ShipmentPiece[] | null;
  status: "pending" | "booked" | "failed" | "voided";
  // Set when status becomes "voided". `void_note` explains HOW it was cancelled — a real UPS
  // Void Shipment API call, vs. DHL where it's only ever a local status flag (see voidShipment()).
  voided_at?: string | null;
  void_note?: string | null;
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
  // UPS's Shipper's Copy waybill/receipt (ControlLogReceipt) — proof of booking, kept separate
  // from the label(s) actually stuck on the boxes. Always null for DHL (no equivalent document).
  waybill_storage_key?: string | null;
  // Commercial Invoice for customs — only present when the carrier actually returned one (DHL
  // auto-generates it for customs-declarable shipments; UPS only if forms were requested).
  commercial_invoice_storage_key?: string | null;
  // Full raw booking response from the carrier (UPS/DHL) — kept as evidence of what was
  // actually returned when the shipment was created.
  raw_response?: Record<string, unknown> | null;
  // Active (status="requested") Pickups this shipment is already attached to — non-empty means
  // it can't be added to ANOTHER Pickup until the existing one is cancelled (see
  // PickupController's matching server-side guard). Only ever loaded from `listShipments()`.
  pickups?: { id: number; carrier_reference: string | null }[];
  // The carrier's REAL delivery progress (separate from `status`, which is only our own booking
  // lifecycle) — synced periodically by the shipments:sync-tracking command. `null` until the
  // first sync runs for this shipment.
  tracking_status?: "not_picked_up" | "in_transit" | "delivered" | null;
  tracking_raw_status?: string | null;
  tracking_synced_at?: string | null;
  delivered_at?: string | null;
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

export const listShipments = (params?: {
  search?: string;
  carrier?: "UPS" | "DHL";
  status?: string;
  page?: number;
  date_from?: string;
  date_to?: string;
}) => {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.carrier) query.set("carrier", params.carrier);
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  if (params?.date_from) query.set("date_from", params.date_from);
  if (params?.date_to) query.set("date_to", params.date_to);
  const qs = query.toString();
  return apiClient.get<PaginatedShipments>(`/shipments${qs ? `?${qs}` : ""}`);
};

// KPI summary for the "My Shipments" page header (merged former /dashboard page) — always
// reflects today/this-month regardless of whatever list filters are currently applied.
export type ShipmentStats = {
  today_count: number;
  month_count: number;
  month_revenue: number;
  in_transit_count: number;
  cancelled_count: number;
};

export const getShipmentStats = () => apiClient.get<ShipmentStats>("/shipments/stats");

export const bookShipment = (data: BookShipmentInput) => apiClient.post<Shipment>("/shipments", data);

export const getShipment = (id: number) => apiClient.get<Shipment>(`/shipments/${id}`);

// Pieces come back from the carrier as a flat list expanded in package/quantity order (see
// ShipmentController) — rebuild the same expansion here so each tracking number can be labeled
// with the box it actually belongs to (e.g. "Package 2 · Box 1/3"). Shared by /shipment/create's
// booking-success modal and /shipment/view/[id]'s Tracking Numbers table.
export function describeShipmentPieces(shipment: Shipment) {
  const packages = shipment.packages ?? [];
  const descriptors: string[] = [];
  packages.forEach((pkg, packageIndex) => {
    const qty = pkg.quantity ?? 1;
    const kind = pkg.is_document ? "Document" : "Box";
    const type = pkg.product_type === "OTHER" ? pkg.product_type_other : pkg.product_type;
    for (let i = 0; i < qty; i++) {
      const boxNo = qty > 1 ? ` ${i + 1}/${qty}` : "";
      descriptors.push(`Package ${packageIndex + 1} · ${kind}${boxNo}${type ? ` · ${type}` : ""} · ${pkg.weight}kg`);
    }
  });
  return (shipment.pieces ?? []).map((piece, i) => ({ ...piece, description: descriptors[i] ?? `Piece ${i + 1}` }));
}

// Cancels a booked shipment. UPS: a REAL cancellation with UPS (Void Shipment API). DHL: DHL has
// no shipment-cancel API at all — this only flips our own local status, staff must still contact
// DHL directly to actually stop the shipment (see backend ShipmentController::void() for detail).
export const voidShipment = (id: number) => apiClient.post<Shipment>(`/shipments/${id}/void`, {});

// The label route returns a raw binary file (not JSON) and needs the Bearer token — apiClient
// can't be reused as-is, so this fetches the blob and opens a dedicated print-preview window
// (UPS GIF labels come back rotated 90° — rotated back here for a normal upright read/print;
// PDF labels from DHL are already upright, just shown full-page and print() is triggered too).

// Shown immediately in a just-opened popup so it isn't a frozen-looking blank about:blank tab
// while the label fetch is in flight — document.write() again once the real content is ready
// implicitly clears this (standard browser behavior for writing to an already-loaded document).
function writeLoadingPlaceholder(win: Window) {
  win.document.write(
    `<!DOCTYPE html><html><head><title>Loading...</title><style>
      html,body{margin:0;height:100%;background:#525659;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;}
      .spinner{width:36px;height:36px;border:4px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;}
      p{position:absolute;margin-top:64px;color:#fff;font-size:14px;}
      @keyframes spin{to{transform:rotate(360deg);}}
    </style></head><body><div class="spinner"></div><p>กำลังโหลด Label...</p></body></html>`,
  );
  win.document.close();
}

export async function openShipmentLabel(shipmentId: number, trackingNumber?: string) {
  // Must open synchronously within the click handler, before the async fetch, or popup blockers
  // will silently swallow it.
  const printWindow = window.open("", "_blank");
  if (printWindow) writeLoadingPlaceholder(printWindow);

  const token = getToken();
  const qs = trackingNumber ? `?tracking_number=${encodeURIComponent(trackingNumber)}` : "";
  const res = await fetch(`${API_URL}/shipments/${shipmentId}/label${qs}`, {
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

// Shared by openShipmentWaybill/openShipmentCommercialInvoice — same fetch-blob-then-print-preview
// pattern as openShipmentLabel, but without the label's 90°-rotate-for-GIF quirk (these are
// full-page documents, not small label GIFs).
async function openShipmentDocument(path: string, title: string, notFoundMessage: string) {
  // Must open synchronously within the click handler, before the async fetch, or popup blockers
  // will silently swallow it.
  const printWindow = window.open("", "_blank");
  if (printWindow) writeLoadingPlaceholder(printWindow);

  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    printWindow?.close();
    throw new Error(notFoundMessage);
  }

  const contentType = res.headers.get("Content-Type") || "application/octet-stream";
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (!printWindow) {
    window.open(url, "_blank");
    return;
  }

  if (contentType.startsWith("image/")) {
    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>${title}</title><style>
        html,body{margin:0;height:100%;background:#525659;display:flex;align-items:center;justify-content:center;}
        img{max-width:95vw;max-height:95vh;}
        @media print{html,body{background:#fff;}}
      </style></head><body><img id="doc-img" src="${url}" /></body></html>`,
    );
    printWindow.document.close();
    const img = printWindow.document.getElementById("doc-img") as HTMLImageElement | null;
    if (img) img.onload = () => printWindow.print();
  } else {
    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>${title}</title><style>
        html,body,iframe{margin:0;padding:0;width:100%;height:100%;border:0;}
      </style></head><body><iframe id="doc-frame" src="${url}"></iframe></body></html>`,
    );
    printWindow.document.close();
    const frame = printWindow.document.getElementById("doc-frame") as HTMLIFrameElement | null;
    if (frame) {
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      };
    }
  }
}

export const openShipmentWaybill = (shipmentId: number) =>
  openShipmentDocument(`/shipments/${shipmentId}/waybill`, "UPS Waybill", "เปิด Waybill ไม่สำเร็จ");

export const openShipmentCommercialInvoice = (shipmentId: number) =>
  openShipmentDocument(`/shipments/${shipmentId}/commercial-invoice`, "Commercial Invoice", "เปิด Commercial Invoice ไม่สำเร็จ");

// Prints every piece's label as ONE combined job in a SINGLE tab (page-break between each) instead
// of opening a separate tab per piece — caller should already dedupe tracking numbers that share
// the same label file (e.g. DHL pieces all point at one combined multi-page PDF).
export async function printAllShipmentLabels(shipmentId: number, trackingNumbers: string[]) {
  if (trackingNumbers.length === 0) return;

  // Must open synchronously within the click handler, before the async fetches, or popup
  // blockers will silently swallow it.
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("กรุณาอนุญาต Popup เพื่อเปิด Label");
    return;
  }
  writeLoadingPlaceholder(printWindow);

  const token = getToken();
  const fetched = await Promise.all(
    trackingNumbers.map(async (trackingNumber) => {
      const res = await fetch(`${API_URL}/shipments/${shipmentId}/label?tracking_number=${encodeURIComponent(trackingNumber)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return null;
      const contentType = res.headers.get("Content-Type") || "application/octet-stream";
      const blob = await res.blob();
      return { contentType, url: URL.createObjectURL(blob) };
    }),
  );
  const labels = fetched.filter((l): l is { contentType: string; url: string } => l !== null);

  if (labels.length === 0) {
    printWindow.close();
    alert("ไม่พบไฟล์ Label");
    return;
  }

  const pages = labels
    .map((l) =>
      l.contentType.startsWith("image/")
        ? `<div class="page"><img src="${l.url}" /></div>`
        : `<div class="page"><iframe src="${l.url}"></iframe></div>`,
    )
    .join("");

  printWindow.document.write(
    `<!DOCTYPE html><html><head><title>Shipping Labels</title><style>
      html,body{margin:0;background:#525659;}
      .page{page-break-after:always;display:flex;align-items:center;justify-content:center;height:100vh;box-sizing:border-box;}
      .page:last-child{page-break-after:auto;}
      .page img{transform:rotate(90deg);max-width:90vh;max-height:90vw;}
      .page iframe{border:0;width:100%;height:100%;}
      @media print{html,body{background:#fff;}}
    </style></head><body>${pages}</body></html>`,
  );
  printWindow.document.close();

  // Wait for every image/iframe to actually load before printing once — otherwise blank pages
  // print, since print() would fire before the async blob URLs finish rendering.
  const loadables = Array.from(printWindow.document.querySelectorAll("img, iframe"));
  await Promise.all(
    loadables.map(
      (el) =>
        new Promise<void>((resolve) => {
          if ((el as HTMLImageElement).complete) {
            resolve();
            return;
          }
          el.addEventListener("load", () => resolve(), { once: true });
          el.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
  printWindow.print();
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

  // A multi-piece shipment (several boxes booked in one carrier request) has its own tracking
  // number per box — list them all here, tagged with which package/box each belongs to, instead
  // of only ever printing the single master tracking number above.
  const pieces = describeShipmentPieces(shipment);
  const pieceRows =
    pieces.length > 1
      ? pieces
          .map(
            (p, i) =>
              `<tr><td>${i + 1}. ${escapeHtml(p.description)}</td><td class="right">${escapeHtml(p.tracking_number ?? "-")}</td></tr>`,
          )
          .join("")
      : "";

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
  ${pieceRows ? `<hr class="divider" /><div class="muted">Tracking Numbers (${pieces.length})</div><table>${pieceRows}</table>` : ""}
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
