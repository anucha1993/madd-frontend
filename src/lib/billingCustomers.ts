import { apiClient } from "./apiClient";

export type BillingCustomer = {
  id: number;
  customer_id: number | null;
  name: string;
  tax_id: string | null;
  is_head_office: boolean;
  branch_no: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  city: string | null;
  state_code: string | null;
  postcode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export type BillingCustomerInput = {
  customer_id?: number | null;
  name: string;
  tax_id?: string | null;
  is_head_office?: boolean;
  branch_no?: string | null;
  address1?: string | null;
  address2?: string | null;
  address3?: string | null;
  city?: string | null;
  state_code?: string | null;
  postcode?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

export type PaginatedBillingCustomers = {
  data: BillingCustomer[];
  current_page: number;
  last_page: number;
  total: number;
};

export const listBillingCustomers = (params?: { q?: string; page?: number }) => {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiClient.get<PaginatedBillingCustomers>(`/billing-customers${qs ? `?${qs}` : ""}`);
};

export const createBillingCustomer = (data: BillingCustomerInput) =>
  apiClient.post<BillingCustomer>("/billing-customers", data);

export const updateBillingCustomer = (id: number, data: Partial<BillingCustomerInput>) =>
  apiClient.put<BillingCustomer>(`/billing-customers/${id}`, data);

export const deleteBillingCustomer = (id: number) =>
  apiClient.delete<{ message: string }>(`/billing-customers/${id}`);

/** Builds the single-line address string a Receipt/Tax Invoice needs for `buyer_address`. */
export function formatBillingCustomerAddress(c: BillingCustomer): string {
  return [c.address1, c.address2, c.address3, c.city, c.postcode, c.country].filter(Boolean).join(", ");
}
