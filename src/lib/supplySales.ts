import { apiClient } from "./apiClient";
import { openApiPdf } from "./receipts";

// Over-the-counter box / Packing Supplies sale — no shipment, 80 mm thermal receipt, deducts the
// selling branch's stock (see SupplySaleController).
export type SupplySaleLine = {
  id: number;
  supply_id: number | null;
  name: string;
  quantity: number;
  unit_price: string;
  amount: string;
};

export type SupplySale = {
  id: number;
  branch_id: number;
  sale_no: string;
  sold_at: string;
  customer_name: string | null;
  customer_address: string | null;
  customer_phone: string | null;
  payment_method: string | null;
  total: string;
  status: "ISSUED" | "VOIDED";
  voided_at: string | null;
  void_note: string | null;
  branch?: { id: number; name: string; code?: string | null; nickname?: string | null } | null;
  created_by?: { id: number; name: string } | null;
  lines: SupplySaleLine[];
};

export type PaginatedSupplySales = {
  data: SupplySale[];
  current_page: number;
  last_page: number;
  total: number;
  // Sum of non-voided sales matching the filters, across every page.
  issued_total: number;
};

export type CreateSupplySaleInput = {
  branch_id: number;
  customer_name?: string | null;
  customer_address?: string | null;
  customer_phone?: string | null;
  payment_method?: string | null;
  // A line without supply_id is typed in by hand (name required) — no stock.
  lines: ({ supply_id: number; quantity: number; unit_price: number } | { name: string; quantity: number; unit_price: number })[];
};

export const listSupplySales = (params: { page?: number; search?: string; status?: string; branch_id?: number; date_from?: string; date_to?: string } = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && q.set(k, String(v)));
  const qs = q.toString();
  return apiClient.get<PaginatedSupplySales>(`/supply-sales${qs ? `?${qs}` : ""}`);
};

export const createSupplySale = (data: CreateSupplySaleInput) => apiClient.post<SupplySale>("/supply-sales", data);

export const voidSupplySale = (id: number, voidNote?: string) =>
  apiClient.post<SupplySale>(`/supply-sales/${id}/void`, { void_note: voidNote || null });

export const openSupplySalePdf = (id: number) => openApiPdf(`/supply-sales/${id}/pdf`, "Box Sale Receipt");
