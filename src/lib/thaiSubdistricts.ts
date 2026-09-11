import { apiClient } from "./apiClient";

export type ThaiSubdistrict = {
  id: number;
  tambon_id: number;
  name_th: string;
  name_en: string | null;
  district_id: number;
  district_name_th: string;
  district_name_en: string | null;
  province_id: number;
  province_name_th: string;
  province_name_en: string | null;
  region: string | null;
  zip_code: string;
  zip_code_all: string | null;
};

export type ThaiSubdistrictInput = {
  tambon_id?: number;
  name_th: string;
  name_en?: string;
  district_id?: number;
  district_name_th: string;
  district_name_en?: string;
  province_id?: number;
  province_name_th: string;
  province_name_en?: string;
  region?: string;
  zip_code: string;
  zip_code_all?: string;
};

export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export const listThaiSubdistricts = (params: {
  zip_code?: string;
  q?: string;
  region?: string;
  page?: number;
  per_page?: number;
}) => {
  const search = new URLSearchParams();
  if (params.zip_code) search.set("zip_code", params.zip_code);
  if (params.q) search.set("q", params.q);
  if (params.region) search.set("region", params.region);
  if (params.page) search.set("page", String(params.page));
  search.set("per_page", String(params.per_page ?? 20));

  return apiClient.get<Paginated<ThaiSubdistrict>>(`/thai-subdistricts?${search.toString()}`);
};

export const listThaiRegions = () => apiClient.get<string[]>("/thai-subdistricts/regions");

export const getThaiSubdistrictsByZipCode = (zipCode: string) =>
  apiClient.get<ThaiSubdistrict[]>(`/thai-subdistricts/by-zipcode/${zipCode}`);

export const createThaiSubdistrict = (data: ThaiSubdistrictInput) =>
  apiClient.post<ThaiSubdistrict>("/thai-subdistricts", data);

export const updateThaiSubdistrict = (id: number, data: Partial<ThaiSubdistrictInput>) =>
  apiClient.put<ThaiSubdistrict>(`/thai-subdistricts/${id}`, data);

export const deleteThaiSubdistrict = (id: number) =>
  apiClient.delete<{ message: string }>(`/thai-subdistricts/${id}`);
