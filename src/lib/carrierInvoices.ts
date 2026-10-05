import { apiClient } from "./apiClient";

export type CarrierInvoiceStatus = "uploaded" | "parsing" | "parsed" | "failed";

export type CarrierInvoiceLineShipment = {
  id: number;
  tracking_number: string | null;
  carrier: string;
  cost_amount: string | null;
  cost_currency: string | null;
  rate_quote: Record<string, unknown> | null;
  branch_id: number | null;
};

export type CarrierInvoiceLine = {
  id: number;
  carrier_invoice_id: number;
  sort_order: number;
  tracking_number: string | null;
  reference_text: string | null;
  description: string | null;
  charges: string | null;
  discount: string | null;
  amount: string | null;
  shipment_id: number | null;
  is_matched: boolean;
  override_amount: string | null;
  override_note: string | null;
  effective_amount: string | null;
  shipment?: CarrierInvoiceLineShipment | null;
};

export type CarrierInvoice = {
  id: number;
  carrier: "UPS" | "DHL";
  agent_account_id: number | null;
  invoice_no: string | null;
  invoice_date: string | null;
  total_amount: string | null;
  currency: string;
  storage_key: string;
  original_filename: string | null;
  status: CarrierInvoiceStatus;
  error_message: string | null;
  created_by: number | null;
  created_at: string;
  lines_count?: number;
  lines?: CarrierInvoiceLine[];
};

export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
};

export type CarrierInvoiceFilters = {
  carrier?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
};

function buildQuery(filters: CarrierInvoiceFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const listCarrierInvoices = (filters: CarrierInvoiceFilters = {}) =>
  apiClient.get<Paginated<CarrierInvoice>>(`/carrier-invoices${buildQuery(filters)}`);

export const getCarrierInvoice = (id: number) => apiClient.get<CarrierInvoice>(`/carrier-invoices/${id}`);

export const uploadCarrierInvoice = (data: { file: File; carrier: "UPS" | "DHL"; invoice_no?: string; invoice_date?: string }) => {
  const formData = new FormData();
  formData.append("file", data.file);
  formData.append("carrier", data.carrier);
  if (data.invoice_no) formData.append("invoice_no", data.invoice_no);
  if (data.invoice_date) formData.append("invoice_date", data.invoice_date);
  return apiClient.upload<CarrierInvoice>("/carrier-invoices", formData);
};

export const reparseCarrierInvoice = (id: number) =>
  apiClient.post<{ message: string; status: string }>(`/carrier-invoices/${id}/reparse`, {});

export const deleteCarrierInvoice = (id: number) => apiClient.delete<{ message: string }>(`/carrier-invoices/${id}`);

export const updateCarrierInvoice = (id: number, data: Partial<Pick<CarrierInvoice, "invoice_no" | "invoice_date">>) =>
  apiClient.put<CarrierInvoice>(`/carrier-invoices/${id}`, data);

export const updateCarrierInvoiceLine = (
  id: number,
  data: Partial<Pick<CarrierInvoiceLine, "tracking_number" | "reference_text" | "description" | "amount" | "override_amount" | "override_note">>,
) => apiClient.put<CarrierInvoiceLine>(`/carrier-invoice-lines/${id}`, data);

export const deleteCarrierInvoiceLine = (id: number) => apiClient.delete<{ message: string }>(`/carrier-invoice-lines/${id}`);
