import { apiClient } from "./apiClient";

export type ChargeCode = {
  id: number;
  provider: "UPS" | "DHL";
  code: string;
  label: string;
  // Staff's own name for this charge (/config/charge-names), shown instead of the carrier's
  // description everywhere and on new Receipts / Tax Invoices — null = use the carrier's own.
  display_name: string | null;
  // Optional conditional name — IF {code} op value on the SAME quote → name, else display_name.
  display_rule: ChargeDisplayRule | null;
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

// packageWeights (one per box) feeds BOX_OVER(kg); omitted = {BOX} boxes of {W}/{BOX} kg each.
export const previewChargeFormula = (formula: string, values: Record<string, number>, packageWeights?: number[]) =>
  apiClient.post<{ result: number }>("/charge-formula/preview", { formula, values, package_weights: packageWeights });

export const deleteChargeCode = (id: number) => apiClient.delete<{ message: string }>(`/charge-codes/${id}`);

export const CHARGE_DISPLAY_RULE_OPERATORS = [">", ">=", "<", "<=", "=", "!="] as const;

export type ChargeDisplayRule = { code: string; op: (typeof CHARGE_DISPLAY_RULE_OPERATORS)[number]; value: number; name: string };

export type ChargeDisplayName = { provider: string; code: string; display_name: string | null; display_rule: ChargeDisplayRule | null };

export const listChargeDisplayNames = () => apiClient.get<ChargeDisplayName[]>("/charge-display-names");

export const updateChargeDisplayName = (id: number, data: { display_name: string | null; display_rule?: ChargeDisplayRule | null }) =>
  apiClient.put<ChargeCode>(`/charge-codes/${id}/display-name`, data);

export const addChargeDisplayName = (data: { provider: "UPS" | "DHL"; code: string; label?: string; display_name: string | null; display_rule?: ChargeDisplayRule | null }) =>
  apiClient.post<ChargeCode>("/charge-display-names", data);
