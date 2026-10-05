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

// Free-form Commercial Invoice product line — NOT tied 1:1 to physical packages, a real invoice
// usually lists products, not boxes. Used to build DHL's mandatory exportDeclaration.lineItems.
// `weight` is per-item net weight in kg (matches DHL's own MyDHL+ portal — every manually-typed
// invoice line item there is REQUIRED to have a weight, not just quantity + unit value).
export type BookShipmentInvoiceLine = {
  description: string;
  quantity: number;
  unit_value: number;
  weight?: number;
  country_of_origin?: string;
  hs_code?: string;
};

export type BookShipmentAddonLine = {
  name: string;
  category?: string;
  quantity: number;
  unit_price: number;
};


export type BookShipmentInput = {
  agent_account_id: number;
  // Required for users who can book for several branches; single-branch users are bound to theirs.
  branch_id?: number;
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
    // Required by UPS's real booking API for US/CA ship-to addresses.
    state?: string;
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
  // Commercial Invoice step — invoice_lines is ALWAYS sent (min 1 row) to build the carrier's
  // mandatory customs declaration (DHL's own MyDHL+ portal proves this is required regardless of
  // any file attachment). commercial_invoice_upload_key is a SEPARATE, optional supplementary
  // PDF/image attachment (documentImages typeCode CIN on DHL), not a replacement for the lines.
  // `invoice_mode` is kept only for backward compatibility with saved shipment records — always
  // defaults to "FORM" now (the previous "UPLOAD" mode was the wrong mental model, see
  // buildExportDeclaration in DhlShipmentService).
  invoice_mode?: "FORM" | "UPLOAD";
  invoice_lines?: BookShipmentInvoiceLine[];
  commercial_invoice_upload_key?: string | null;
  // DHL Optional Services (live-verified serviceCodes) — same list sent at Check Rate, kept
  // consistent through to the real booking. Defaults to ["SF"] (Direct Signature) server-side.
  dhl_optional_services?: string[];
  // UPS Optional Services (SATURDAY, DCIS1/2/3 signature options, ADDRESSEE_ONLY, DIRECT_ONLY) —
  // same pattern as dhl_optional_services; defaults to none if omitted.
  ups_optional_services?: string[];
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
  // Required whenever billing isn't to our own Shipper account — the OTHER party's own carrier
  // account number (UPS BillReceiver/BillThirdParty, DHL payer/duties-taxes typeCode).
  bill_transportation_account_number?: string;
  bill_transportation_third_party_country?: string;
  bill_transportation_third_party_postal_code?: string;
  bill_duty_tax_account_number?: string;
  bill_duty_tax_third_party_country?: string;
  bill_duty_tax_third_party_postal_code?: string;
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
  branch_id?: number | null;
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
  // Who voided it and why. For DHL (no cancel API) carrier_cancel_status tracks whether DHL has
  // actually been told: "pending" (voided in MADD only) -> "confirmed" (DHL confirmed, with ref).
  voided_by?: { id: number; name: string } | number | null;
  void_reason?: string | null;
  carrier_cancel_status?: "pending" | "confirmed" | null;
  // When staff told the carrier to cancel, and whom / through which channel.
  carrier_cancel_requested_at?: string | null;
  carrier_cancel_requested_to?: string | null;
  carrier_cancel_confirmed_at?: string | null;
  carrier_cancel_confirmed_by?: { id: number; name: string } | number | null;
  carrier_cancel_reference?: string | null;
  origin?: ShipmentAddress | null;
  destination?: ShipmentAddress | null;
  packages?: ShipmentPackageRecord[];
  addon_lines?: ShipmentAddonLine[];
  freight_amount: number;
  addon_total: number;
  order_total: number;
  currency: string;
  // The carrier's own pre-markup quoted total (negotiated rate, or published if no negotiated
  // rate applies) — the real cost reference, independent of freight_amount/order_total above
  // which already have markup baked in as the customer-facing sell price. Null for shipments
  // booked before this was tracked (2026-09-24).
  cost_amount?: number | null;
  cost_currency?: string | null;
  customer_type?: string | null;
  entity_type?: string | null;
  payment_method?: string | null;
  bill_transportation_to?: string | null;
  bill_duty_tax_to?: string | null;
  bill_transportation_account_number?: string | null;
  bill_transportation_third_party_country?: string | null;
  bill_transportation_third_party_postal_code?: string | null;
  bill_duty_tax_account_number?: string | null;
  bill_duty_tax_third_party_country?: string | null;
  bill_duty_tax_third_party_postal_code?: string | null;
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
  // The exact request body we sent to the carrier — kept alongside raw_response as dispute
  // evidence (e.g. proving we requested BillReceiver but the carrier billed it wrong).
  raw_request?: Record<string, unknown> | null;
  // HTTP status code the carrier returned for the booking request itself (e.g. 200) — explicit
  // confirmation the request was actually received/accepted, without digging through raw_response.
  carrier_http_status?: number | null;
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
  // When the courier actually collected it — from the carrier's own tracking scan, or set
  // by staff ("ยืนยันรถรับแล้ว") until that scan arrives. An on-call Pickup alone never sets it.
  picked_up_at?: string | null;
  picked_up_source?: "carrier" | "manual" | null;
  error_message: string | null;
  created_at: string;
  agent_account?: { id: number; username_acc: string; mode?: "test" | "production" | null; agent?: { agent_code: string; name?: string; logo_url?: string } } | null;
  branch?: { id: number; name: string; code: string; nickname?: string | null } | null;
  // Count of Receipts/Tax Invoices this shipment is already attached to (any status, including
  // VOIDED — the global lock is permanent, see receipt_shipment). >0 means it can never be
  // selected for a new Receipt/Tax Invoice again. Only ever loaded from `listShipments()`.
  receipts_count?: number;
  // True when booked against a Test-mode Agent Account (sandbox UPS/DHL credentials) — only
  // these shipments can be permanently deleted (see deleteShipment()); real bookings can only
  // ever be Voided.
  is_test?: boolean;
};

export type PaginatedShipments = {
  data: Shipment[];
  current_page: number;
  last_page: number;
  total: number;
};

export type TrackingGroup = "not_picked_up" | "awaiting_pickup" | "in_transit" | "delivered";

export const TRACKING_GROUP_LABEL: Record<TrackingGroup, string> = {
  not_picked_up: "ยังไม่นัดรับ",
  awaiting_pickup: "รอรถรับตามนัด",
  in_transit: "รับแล้ว / กำลังขนส่ง",
  delivered: "ส่งถึงแล้ว",
};

/** Staff saw the courier take this shipment (before the carrier's own scan arrives). */
export const markShipmentPickedUp = (id: number) => apiClient.post<Shipment>(`/shipments/${id}/mark-picked-up`, {});

export const listShipments = (params?: {
  search?: string;
  carrier?: "UPS" | "DHL";
  status?: string;
  customer_type?: string;
  page?: number;
  date_from?: string;
  date_to?: string;
  // Only shipments never attached to any Receipt/Tax Invoice yet — used by the Issue
  // Receipt picker (see receipt_shipment's global lock).
  unbilled?: boolean;
  // Collection progress group (see ShipmentController::index).
  tracking?: TrackingGroup;
  // "pending" = voided DHL waybills DHL hasn't confirmed cancelling yet.
  cancel?: "pending";
}) => {
  const query = new URLSearchParams();
  if (params?.cancel) query.set("cancel", params.cancel);
  if (params?.tracking) query.set("tracking", params.tracking);
  if (params?.search) query.set("search", params.search);
  if (params?.carrier) query.set("carrier", params.carrier);
  if (params?.status) query.set("status", params.status);
  if (params?.customer_type) query.set("customer_type", params.customer_type);
  if (params?.page) query.set("page", String(params.page));
  if (params?.date_from) query.set("date_from", params.date_from);
  if (params?.date_to) query.set("date_to", params.date_to);
  if (params?.unbilled) query.set("unbilled", "1");
  const qs = query.toString();
  return apiClient.get<PaginatedShipments>(`/shipments${qs ? `?${qs}` : ""}`);
};

// KPI summary for the "My Shipments" page header (merged former /dashboard page) — always
// reflects today/this-month regardless of whatever list filters are currently applied.
// Each value is null when the Role lacks that card's permission (shipment_kpi.*).
export type ShipmentStats = {
  today_count: number | null;
  month_count: number | null;
  month_revenue: number | null;
  in_transit_count: number | null;
  cancelled_count: number | null;
};

export const getShipmentStats = () => apiClient.get<ShipmentStats>("/shipments/stats");

// idempotencyKey: one per booking attempt — a retried / double-sent request returns the same
// Shipment instead of creating a second real waybill (see ShipmentController::store).
export const bookShipment = (data: BookShipmentInput, idempotencyKey?: string) =>
  apiClient.post<Shipment>("/shipments", data, idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined);

// Sets the booking branch of a shipment that has none yet (needed before issuing a receipt).
export const assignShipmentBranch = (id: number, branchId: number) => apiClient.put<Shipment>(`/shipments/${id}/branch`, { branch_id: branchId });

// Uploads a staff-provided Commercial Invoice file BEFORE booking (Commercial Invoice step's
// Upload option) — the returned storage key is then passed as `commercial_invoice_upload_key`
// in the main bookShipment() call.
export const uploadCommercialInvoiceFile = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.upload<{ storage_key: string }>("/shipments/upload-commercial-invoice", formData);
};

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
// `pickup_notice` says what happened to any active pickup the shipment was on (cancelled with the
// carrier, or left alone because other shipments on it still need collecting).
export const voidShipment = (id: number, reason?: string) =>
  apiClient.post<Shipment & { pickup_notice?: string | null }>(`/shipments/${id}/void`, { reason: reason || undefined });

/** DHL only, before DHL confirmed the cancellation — nothing was cancelled at DHL yet. */
export const unvoidShipment = (id: number) => apiClient.post<Shipment>(`/shipments/${id}/unvoid`, {});

/** Staff told DHL (phone / in person / their own email) — `notifiedTo` = whom or which channel. */
export const markCarrierCancelNotified = (id: number, notifiedTo?: string) =>
  apiClient.post<Shipment>(`/shipments/${id}/carrier-cancel-notified`, { notified_to: notifiedTo || undefined });

/** Record that DHL confirmed the waybill cancellation (their case/reference number). */
export const confirmCarrierCancel = (id: number, reference?: string) =>
  apiClient.post<Shipment>(`/shipments/${id}/confirm-carrier-cancel`, { reference: reference || undefined });

// Permanently deletes a Shipment — only allowed by the backend when `is_test` is true (booked via
// a sandbox/Test-mode Agent Account). Real production bookings must use voidShipment() instead.
export const deleteShipment = (id: number) => apiClient.delete<void>(`/shipments/${id}`);

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

  // The popup can become script-inaccessible during the fetch above (e.g. a browser
  // extension or process-isolation change re-homes it into another origin/process) — any
  // access to it then throws a SecurityError even though we opened it ourselves. Fall back
  // to a plain tab rather than surface that as an app error.
  try {
    if (contentType.startsWith("image/")) {
      // No auto-print here — window.print() opens a native dialog that's modal to the WHOLE
      // browser window (not just this tab), silently blocking clicks on the main app page until
      // dismissed. Give the user their own on-screen button so printing only happens if they ask.
      printWindow.document.write(
        `<!DOCTYPE html><html><head><title>Shipping Label</title><style>
          html,body{margin:0;height:100%;background:#525659;display:flex;align-items:center;justify-content:center;}
          img{transform:rotate(90deg);max-width:90vh;max-height:90vw;}
          .print-btn{position:fixed;top:12px;right:12px;padding:8px 16px;border:0;border-radius:6px;background:#fff;font-family:system-ui,sans-serif;font-size:14px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3);}
          @media print{.print-btn{display:none;}html,body{background:#fff;}}
        </style></head><body><button class="print-btn" onclick="window.print()">Print</button><img id="label-img" src="${url}" /></body></html>`,
      );
      printWindow.document.close();
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
          // Chrome's built-in PDF viewer renders in a non-scriptable context and already has its
          // own print button in its toolbar — don't auto-print, just try to focus the tab (this
          // itself throws a SecurityError for the built-in viewer, which is fine to ignore).
          try {
            frame.contentWindow?.focus();
          } catch {
            // ignore — expected for the built-in PDF viewer
          }
        };
      }
    }
  } catch {
    try {
      printWindow.close();
    } catch {
      // already inaccessible/closed — nothing to clean up
    }
    window.open(url, "_blank");
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

  // The popup can become script-inaccessible during the fetch above (e.g. a browser
  // extension or process-isolation change re-homes it into another origin/process) — any
  // access to it then throws a SecurityError even though we opened it ourselves. Fall back
  // to a plain tab rather than surface that as an app error.
  try {
    if (contentType.startsWith("image/")) {
      // No auto-print here — window.print() opens a native dialog that's modal to the WHOLE
      // browser window (not just this tab), silently blocking clicks on the main app page until
      // dismissed. Give the user their own on-screen button so printing only happens if they ask.
      printWindow.document.write(
        `<!DOCTYPE html><html><head><title>${title}</title><style>
          html,body{margin:0;height:100%;background:#525659;display:flex;align-items:center;justify-content:center;}
          img{max-width:95vw;max-height:95vh;}
          .print-btn{position:fixed;top:12px;right:12px;padding:8px 16px;border:0;border-radius:6px;background:#fff;font-family:system-ui,sans-serif;font-size:14px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.3);}
          @media print{.print-btn{display:none;}html,body{background:#fff;}}
        </style></head><body><button class="print-btn" onclick="window.print()">Print</button><img id="doc-img" src="${url}" /></body></html>`,
      );
      printWindow.document.close();
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
          // Chrome's built-in PDF viewer renders in a non-scriptable context and already has its
          // own print button in its toolbar — don't auto-print, just try to focus the tab (this
          // itself throws a SecurityError for the built-in viewer, which is fine to ignore).
          try {
            frame.contentWindow?.focus();
          } catch {
            // ignore — expected for the built-in PDF viewer
          }
        };
      }
    }
  } catch {
    try {
      printWindow.close();
    } catch {
      // already inaccessible/closed — nothing to clean up
    }
    window.open(url, "_blank");
  }
}

export const openShipmentWaybill = (shipmentId: number) =>
  openShipmentDocument(`/shipments/${shipmentId}/waybill`, "UPS Waybill", "เปิด Waybill ไม่สำเร็จ");

// DHL's own Waybill Doc exactly as returned at booking (no MADD payment block) — downloaded as a
// file rather than opened, since it's what DHL / customs ask to be sent.
export async function downloadDhlOriginalWaybill(shipment: Pick<Shipment, "id" | "tracking_number">) {
  const token = getToken();
  const res = await fetch(`${API_URL}/shipments/${shipment.id}/waybill/original`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("ดาวน์โหลด Waybill ต้นฉบับจาก DHL ไม่สำเร็จ");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `DHL-waybill-${shipment.tracking_number ?? shipment.id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const openShipmentCommercialInvoice = (shipmentId: number) =>
  openShipmentDocument(`/shipments/${shipmentId}/commercial-invoice`, "Commercial Invoice", "เปิด Commercial Invoice ไม่สำเร็จ");

// Opens every piece's label as ONE merged multi-page PDF in a single tab (server-side merge —
// see ShipmentController::allLabels()) — avoids stacking a separate mini PDF-viewer iframe per
// piece (looked broken: repeated toolbars, inconsistent print() across iframes).
export const printAllShipmentLabels = (shipmentId: number) =>
  openShipmentDocument(`/shipments/${shipmentId}/labels/all`, "Shipping Labels", "เปิด Label ทั้งหมดไม่สำเร็จ");
