import { apiClient } from "./apiClient";
import { API_URL } from "./apiUrl";
import { getToken } from "./auth";

export type ReceiptType = "CASH_RECEIPT" | "TAX_INVOICE";

export type ReceiptLine = {
  id: number;
  receipt_id: number;
  sort_order: number;
  description: string;
  // "ใบแจ้งหนี้เลขที่ / INVOICE No." column on the Tax Invoice template — optional external
  // reference, never used on the Cash Receipt's single-amount-column layout.
  invoice_no?: string | null;
  is_non_vat: boolean;
  amount: string | number;
};

export type Receipt = {
  id: number;
  type: ReceiptType;
  // Links a Cash Receipt <-> Tax Invoice issued together as one inseparable pair — null for
  // legacy documents issued before paired-issuance was introduced.
  receipt_group_id: string | null;
  branch_id: number;
  vol_no: string;
  no: string;
  issued_date: string;
  billing_customer_id: number | null;
  buyer_name: string;
  buyer_tax_id: string | null;
  buyer_address: string | null;
  buyer_is_head_office: boolean;
  buyer_branch_no: string | null;
  subtotal_non_vat: string | number;
  subtotal_vat: string | number;
  vat_rate: string | number;
  vat_amount: string | number;
  grand_total: string | number;
  grand_total_words: string | null;
  // Sum of the selected shipments' order_total at issue time — null for documents issued before
  // this was tracked. variance_amount = grand_total - shipment_total_snapshot (positive = buyer
  // was billed more than the shipment cost, negative = less), also null in that same case.
  shipment_total_snapshot: string | number | null;
  // Free-text tracking/shipment numbers for shipments booked with other carriers that are never
  // tracked as a real Shipment row in this system (2026-09-25) — null/empty when every shipment
  // on this document is a real system one.
  manual_shipment_refs?: string[] | null;
  variance_amount: string | number | null;
  payment_method: string | null;
  payment_reference: string | null;
  status: "ISSUED" | "VOIDED";
  voided_at: string | null;
  void_note: string | null;
  created_at: string;
  branch?: { id: number; name: string; code: string } | null;
  lines?: ReceiptLine[];
  shipments?: {
    id: number;
    tracking_number: string | null;
    order_total?: string | number | null;
    cost_amount?: string | number | null;
    cost_currency?: string | null;
  }[];
  // True only when EVERY shipment on this document was booked via a Test-mode Agent Account —
  // only these documents can be permanently deleted (see deleteReceipt()); real documents can
  // only ever be Voided.
  is_test?: boolean;
};

export type PaginatedReceipts = {
  data: Receipt[];
  current_page: number;
  last_page: number;
  total: number;
};

// Every issuance now always creates BOTH documents together, sharing the same buyer info and
// line items but with independent vol_no/no numbering and independent PDF downloads.
export type ReceiptPair = {
  cash_receipt: Receipt;
  tax_invoice: Receipt;
};

export const listReceipts = (params?: {
  type?: ReceiptType;
  status?: string;
  branch_id?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
  payment_method?: string;
  min_total?: number;
  max_total?: number;
  page?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.type) query.set("type", params.type);
  if (params?.status) query.set("status", params.status);
  if (params?.branch_id) query.set("branch_id", String(params.branch_id));
  if (params?.search) query.set("search", params.search);
  if (params?.date_from) query.set("date_from", params.date_from);
  if (params?.date_to) query.set("date_to", params.date_to);
  if (params?.payment_method) query.set("payment_method", params.payment_method);
  if (params?.min_total != null) query.set("min_total", String(params.min_total));
  if (params?.max_total != null) query.set("max_total", String(params.max_total));
  if (params?.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiClient.get<PaginatedReceipts>(`/receipts${qs ? `?${qs}` : ""}`);
};

export const getReceipt = (id: number) => apiClient.get<Receipt>(`/receipts/${id}`);

export type PreviewLinesResult = {
  branch_id: number;
  target_total: number;
  lines: { description: string; is_non_vat: boolean; amount: number }[];
  buyer_suggestion: { name: string; tax_id: string | null; address: string };
};

export const previewReceiptLines = (shipmentIds: number[]) =>
  apiClient.post<PreviewLinesResult>("/receipts/preview-lines", { shipment_ids: shipmentIds });

export type ReceiptLineInput = { description: string; invoice_no?: string | null; is_non_vat?: boolean; amount: number };

export type CreateReceiptInput = {
  shipment_ids: number[];
  manual_shipment_refs?: string[];
  // Defaults to the selected shipments' own branch on the backend when omitted — only required
  // when issuing a manual-only receipt with no real shipment to infer it from.
  branch_id?: number | null;
  billing_customer_id?: number | null;
  buyer_name: string;
  buyer_tax_id?: string | null;
  buyer_address?: string | null;
  buyer_is_head_office?: boolean;
  buyer_branch_no?: string | null;
  lines: ReceiptLineInput[];
  vat_rate?: number;
  payment_method?: string | null;
  payment_reference?: string | null;
};

export const createReceipt = (data: CreateReceiptInput) => apiClient.post<ReceiptPair>("/receipts", data);

export type UpdateReceiptInput = {
  billing_customer_id?: number | null;
  buyer_name: string;
  buyer_tax_id?: string | null;
  buyer_address?: string | null;
  buyer_is_head_office?: boolean;
  buyer_branch_no?: string | null;
  lines: ReceiptLineInput[];
  vat_rate?: number;
  payment_method?: string | null;
  payment_reference?: string | null;
};

export const updateReceipt = (id: number, data: UpdateReceiptInput) => apiClient.put<ReceiptPair>(`/receipts/${id}`, data);

export const voidReceipt = (id: number, voidNote?: string) =>
  apiClient.post<ReceiptPair>(`/receipts/${id}/void`, { void_note: voidNote });

// Permanently deletes a Receipt/Tax Invoice — only allowed by the backend when `is_test` is true.
// Unlike voidReceipt(), this also releases the shipment(s) so they can be billed again fresh.
export const deleteReceipt = (id: number) => apiClient.delete<void>(`/receipts/${id}`);

/** Opens the generated PDF (each document type is a standalone 1-page PDF) in a new tab. */
export async function openReceiptPdf(id: number) {
  // Must open synchronously within the click handler, before the async fetch, or popup blockers
  // will silently swallow it (leaving a frozen-looking blank about:blank tab instead).
  let printWindow = window.open("", "_blank");
  try {
    if (printWindow) {
      printWindow.document.write(
        `<!DOCTYPE html><html><head><title>Loading...</title><style>
          html,body{margin:0;height:100%;background:#525659;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;}
          .spinner{width:36px;height:36px;border:4px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;}
          p{position:absolute;margin-top:64px;color:#fff;font-size:14px;}
          @keyframes spin{to{transform:rotate(360deg);}}
        </style></head><body><div class="spinner"></div><p>กำลังโหลด PDF...</p></body></html>`,
      );
      printWindow.document.close();
    }
  } catch {
    // Popup became script-inaccessible (e.g. a browser extension or process-isolation
    // change re-homes it into another origin/process) — fall back to a plain tab below.
    printWindow = null;
  }

  const res = await fetch(`${API_URL}/receipts/${id}/pdf`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    try {
      printWindow?.close();
    } catch {
      // already inaccessible — nothing to clean up
    }
    alert("ไม่สามารถโหลด PDF ได้");
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (!printWindow) {
    // Popup blocked — fall back to a plain new tab.
    window.open(url, "_blank");
    return;
  }

  try {
    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>Receipt</title><style>
        html,body,iframe{margin:0;padding:0;width:100%;height:100%;border:0;}
      </style></head><body><iframe src="${url}"></iframe></body></html>`,
    );
    printWindow.document.close();
  } catch {
    try {
      printWindow.close();
    } catch {
      // already inaccessible/closed — nothing to clean up
    }
    window.open(url, "_blank");
  }
}

/** Mass Print — same open-a-tab technique as openReceiptPdf(), but ONE combined PDF covering
 * every selected Receipt/Tax Invoice id (see ReceiptController::printBatch/ReceiptPdfService::
 * renderBatch), so staff get one print job instead of a tab per document. */
export async function printReceiptsBatch(ids: number[]) {
  let printWindow = window.open("", "_blank");
  try {
    if (printWindow) {
      printWindow.document.write(
        `<!DOCTYPE html><html><head><title>Loading...</title><style>
          html,body{margin:0;height:100%;background:#525659;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;}
          .spinner{width:36px;height:36px;border:4px solid rgba(255,255,255,.25);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;}
          p{position:absolute;margin-top:64px;color:#fff;font-size:14px;}
          @keyframes spin{to{transform:rotate(360deg);}}
        </style></head><body><div class="spinner"></div><p>กำลังรวม PDF...</p></body></html>`,
      );
      printWindow.document.close();
    }
  } catch {
    printWindow = null;
  }

  const res = await fetch(`${API_URL}/receipts/print-batch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ receipt_ids: ids }),
  });
  if (!res.ok) {
    try {
      printWindow?.close();
    } catch {
      // already inaccessible — nothing to clean up
    }
    alert("ไม่สามารถรวม PDF ได้");
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (!printWindow) {
    window.open(url, "_blank");
    return;
  }

  try {
    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>Receipts</title><style>
        html,body,iframe{margin:0;padding:0;width:100%;height:100%;border:0;}
      </style></head><body><iframe src="${url}"></iframe></body></html>`,
    );
    printWindow.document.close();
  } catch {
    try {
      printWindow.close();
    } catch {
      // already inaccessible/closed — nothing to clean up
    }
    window.open(url, "_blank");
  }
}
