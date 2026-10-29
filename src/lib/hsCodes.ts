import { apiClient } from "./apiClient";

// HS / HTS code list (/config/hs-codes) — also the Commercial Invoice HS Code lookup.
export type HsCode = {
  id: number;
  code: string; // digits only, e.g. "8703210110"
  code_formatted: string; // e.g. "8703.21.0110"
  description: string;
  chapter: string | null;
  source: string | null;
  status: boolean;
};

export type HsCodeInput = { code: string; description: string; chapter?: string | null; status?: boolean };

export type PaginatedHsCodes = { data: HsCode[]; current_page: number; last_page: number; total: number };

export const listHsCodes = (params: { q?: string; page?: number; status?: string } = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && q.set(k, String(v)));
  const qs = q.toString();
  return apiClient.get<PaginatedHsCodes>(`/hs-codes${qs ? `?${qs}` : ""}`);
};

/** Active codes matching a code prefix or description — top 20, for the HS Code dropdown. */
export const lookupHsCodes = (q: string) => apiClient.get<HsCode[]>(`/hs-codes?lookup=1&q=${encodeURIComponent(q)}`);

export const createHsCode = (data: HsCodeInput) => apiClient.post<HsCode>("/hs-codes", data);

export const updateHsCode = (id: number, data: HsCodeInput) => apiClient.put<HsCode>(`/hs-codes/${id}`, data);

export const deleteHsCode = (id: number) => apiClient.delete<{ message: string }>(`/hs-codes/${id}`);

export const importHsCodes = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.upload<{ created: number; updated: number; skipped: number }>("/hs-codes/import", formData);
};
