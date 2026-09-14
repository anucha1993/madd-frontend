import { apiClient } from "./apiClient";

export type Customer = {
  id: number;
  name: string;
  company_name: string | null;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  addresses_count?: number;
};

export type CustomerInput = {
  name: string;
  company_name?: string;
  tax_id?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

// A customer's saved address can be reused as a Ship From (their pickup locations), a Ship To
// (their regular recipients), or both — see CustomerAddress::type in the backend.
export type CustomerAddressType = "ship_from" | "ship_to" | "both";

export type CustomerAddress = {
  id: number;
  customer_id: number;
  type: CustomerAddressType;
  label: string | null;
  contact_name: string;
  company_name: string | null;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  state_code: string | null;
  postcode: string | null;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  notes: string | null;
  is_default: boolean;
};

export type CustomerWithAddresses = Customer & { addresses: CustomerAddress[] };

// Returned by the cross-customer address search (GET /customer-addresses) — includes the
// owning customer's name so the picker can show "contact name — customer name".
export type CustomerAddressWithCustomer = CustomerAddress & { customer: { id: number; name: string } | null };

export type CustomerAddressInput = {
  type?: CustomerAddressType;
  label?: string;
  contact_name: string;
  company_name?: string;
  tax_id?: string;
  phone?: string;
  email?: string;
  country?: string;
  city?: string;
  state_code?: string;
  postcode?: string;
  address1?: string;
  address2?: string;
  address3?: string;
  notes?: string;
  is_default?: boolean;
};

export const listCustomers = (search?: string) =>
  apiClient.get<Customer[]>(`/customers${search ? `?q=${encodeURIComponent(search)}` : ""}`);

export const getCustomer = (id: number) => apiClient.get<CustomerWithAddresses>(`/customers/${id}`);

export const createCustomer = (data: CustomerInput) => apiClient.post<Customer>("/customers", data);

export const updateCustomer = (id: number, data: Partial<CustomerInput>) =>
  apiClient.put<Customer>(`/customers/${id}`, data);

export const deleteCustomer = (id: number) => apiClient.delete<{ message: string }>(`/customers/${id}`);

export const listCustomerAddresses = (customerId: number, type?: CustomerAddressType) =>
  apiClient.get<CustomerAddress[]>(`/customers/${customerId}/addresses${type ? `?type=${type}` : ""}`);

// Search saved addresses across ALL customers — powers the Ship From/Ship To "pick a saved
// address" combobox, so staff can search by name/phone/tax_id without opening a customer first.
export const searchCustomerAddresses = (search: string, type?: CustomerAddressType) => {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (type) params.set("type", type);
  const qs = params.toString();
  return apiClient.get<CustomerAddressWithCustomer[]>(`/customer-addresses${qs ? `?${qs}` : ""}`);
};

export const createCustomerAddress = (customerId: number, data: CustomerAddressInput) =>
  apiClient.post<CustomerAddress>(`/customers/${customerId}/addresses`, data);

export const updateCustomerAddress = (id: number, data: Partial<CustomerAddressInput>) =>
  apiClient.put<CustomerAddress>(`/customer-addresses/${id}`, data);

export const deleteCustomerAddress = (id: number) =>
  apiClient.delete<{ message: string }>(`/customer-addresses/${id}`);
