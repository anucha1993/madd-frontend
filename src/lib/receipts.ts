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
  payment_method: string | null;
  payment_reference: string | null;
  status: "ISSUED" | "VOIDED";
  voided_at: string | null;
  void_note: string | null;
  created_at: string;
  branch?: { id: number; name: string; code: string } | null;
  lines?: ReceiptLine[];
  shipments?: { id: number; tracking_number: string | null }[];
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

export const listReceipts = (params?: {
  type?: ReceiptType;
  status?: string;
  branch_id?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
}) => {
  const query = new URLSearchParams();
  if (params?.type) query.set("type", params.type);
  if (params?.status) query.set("status", params.status);
  if (params?.branch_id) query.set("branch_id", String(params.branch_id));
  if (params?.search) query.set("search", params.search);
  if (params?.date_from) query.set("date_from", params.date_from);
  if (params?.date_to) query.set("date_to", params.date_to);
  if (params?.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiClient.get<PaginatedReceipts>(`/receipts${qs ? `?${qs}` : ""}`);
};

export const getReceipt = (id: number) => apiClient.get<Receipt>(`/receipts/${id}`);

export type PreviewLinesResult = {
  branch_id: number;
  target_total: number;
  lines: { description: string; is_non_vat: boolean; amount: number }[];
  cash_receipt_buyer_suggestion: { name: string; tax_id: string | null; address: string };
};

export const previewReceiptLines = (shipmentIds: number[]) =>
  apiClient.post<PreviewLinesResult>("/receipts/preview-lines", { shipment_ids: shipmentIds });

export type ReceiptLineInput = { description: string; invoice_no?: string | null; is_non_vat?: boolean; amount: number };

export type CreateReceiptInput = {
  type: ReceiptType;
  shipment_ids: number[];
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

export const createReceipt = (data: CreateReceiptInput) => apiClient.post<Receipt>("/receipts", data);

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

export const updateReceipt = (id: number, data: UpdateReceiptInput) => apiClient.put<Receipt>(`/receipts/${id}`, data);

export const voidReceipt = (id: number, voidNote?: string) =>
  apiClient.post<Receipt>(`/receipts/${id}/void`, { void_note: voidNote });

// Permanently deletes a Receipt/Tax Invoice — only allowed by the backend when `is_test` is true.
// Unlike voidReceipt(), this also releases the shipment(s) so they can be billed again fresh.
export const deleteReceipt = (id: number) => apiClient.delete<void>(`/receipts/${id}`);

/** Opens the generated PDF (Tax Invoice = 2 pages, Cash Receipt = 1 page) in a new tab. */
export async function openReceiptPdf(id: number) {
  const res = await fetch(`${API_URL}/receipts/${id}/pdf`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    alert("ไม่สามารถโหลด PDF ได้");
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}
