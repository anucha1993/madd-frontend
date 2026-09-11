import { apiClient } from "./apiClient";

export type InsuranceCountryCap = {
  id: number;
  country_name: string;
  country_code: string | null;
  ups_max_value: string | number | null;
  dhl_max_value: string | number | null;
  ups_max_declared: string | number | null;
  dhl_max_declared: string | number | null;
  note: string | null;
};

export type InsuranceCountryCapInput = {
  country_name: string;
  country_code?: string;
  ups_max_value?: number;
  dhl_max_value?: number;
  ups_max_declared?: number;
  dhl_max_declared?: number;
  note?: string;
};

export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export const listInsuranceCountryCaps = (params: { q?: string; page?: number; per_page?: number } = {}) => {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.page) search.set("page", String(params.page));
  search.set("per_page", String(params.per_page ?? 20));

  return apiClient.get<Paginated<InsuranceCountryCap>>(`/insurance-country-caps?${search.toString()}`);
};

export const createInsuranceCountryCap = (data: InsuranceCountryCapInput) =>
  apiClient.post<InsuranceCountryCap>("/insurance-country-caps", data);

export const updateInsuranceCountryCap = (id: number, data: Partial<InsuranceCountryCapInput>) =>
  apiClient.put<InsuranceCountryCap>(`/insurance-country-caps/${id}`, data);

export const deleteInsuranceCountryCap = (id: number) =>
  apiClient.delete<{ message: string }>(`/insurance-country-caps/${id}`);

export const importInsuranceCountryCaps = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  return apiClient.upload<{ message: string; imported: number }>("/insurance-country-caps/import", formData);
};
