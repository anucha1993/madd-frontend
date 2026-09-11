import { apiClient } from "./apiClient";

export type ChargeCode = {
  id: number;
  provider: "UPS" | "DHL";
  code: string;
  label: string;
  description: string | null;
  category: string | null;
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

export const updateChargeCode = (id: number, data: Partial<Omit<ChargeCodeInput, "provider" | "code">>) =>
  apiClient.put<ChargeCode>(`/charge-codes/${id}`, data);

export const deleteChargeCode = (id: number) => apiClient.delete<{ message: string }>(`/charge-codes/${id}`);
