import { apiClient } from "./apiClient";

export type ChargeCode = {
  id: number;
  provider: "UPS" | "DHL";
  code: string;
  label: string;
  description: string | null;
  category: string | null;
  // true only for codes hand-added via "+ Add Charge Code" on /config/markup — the carrier API
  // never actually returns these (e.g. a self-defined "VAT" line).
  is_custom: boolean;
  // Pinned codes show as quick-select chips on /config/markup and Fixed Charges instead of
  // needing to search every time — for the handful of charge codes used regularly.
  is_pinned: boolean;
};

export const listChargeCodes = (params: { provider?: "UPS" | "DHL"; q?: string } = {}) => {
  const search = new URLSearchParams();
  if (params.provider) search.set("provider", params.provider);
  if (params.q) search.set("q", params.q);

  return apiClient.get<ChargeCode[]>(`/charge-codes?${search.toString()}`);
};

export type ChargeCodeInput = {
  provider: string;
  code: string;
  label: string;
  description?: string;
  category?: string;
};

export const createChargeCode = (data: ChargeCodeInput) => apiClient.post<ChargeCode>("/charge-codes", data);

export const updateChargeCode = (id: number, data: Partial<Omit<ChargeCodeInput, "provider" | "code">> & { is_pinned?: boolean }) =>
  apiClient.put<ChargeCode>(`/charge-codes/${id}`, data);

export const previewChargeFormula = (formula: string, values: Record<string, number>) =>
  apiClient.post<{ result: number }>("/charge-formula/preview", { formula, values });

export const deleteChargeCode = (id: number) => apiClient.delete<{ message: string }>(`/charge-codes/${id}`);
