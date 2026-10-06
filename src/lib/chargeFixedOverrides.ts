import { apiClient } from "./apiClient";
import type { Agent, AgentAccount } from "./agentAccounts";
import type { ChargeCode } from "./chargeCodes";

export type ChargeFixedOverride = {
  id: number;
  agent_account_id: number;
  charge_code_id: number;
  override_type: "FIXED" | "FORMULA";
  // e.g. "({BASE} + {434}) * 35%" — {CODE} references another charge code's amount in the
  // same quote. Only meaningful when override_type === "FORMULA".
  formula: string | null;
  fixed_amount: string | number | null;
  // Only meaningful when override_type === "FIXED" — THB is a flat replacement amount,
  // PERCENTAGE replaces it with that % of the carrier's own original quoted amount.
  unit: "THB" | "PERCENTAGE";
  status: boolean;
  agent_account?: AgentAccount & { agent?: Agent };
  charge_code?: ChargeCode;
};

export type ChargeFixedOverrideInput = {
  agent_account_id: number;
  charge_code_id: number;
  override_type: "FIXED" | "FORMULA";
  formula?: string | null;
  fixed_amount?: number | null;
  unit?: "THB" | "PERCENTAGE";
  status?: boolean;
};

export const listChargeFixedOverrides = (params: { agent_account_id?: number } = {}) => {
  const search = new URLSearchParams();
  if (params.agent_account_id) search.set("agent_account_id", String(params.agent_account_id));

  return apiClient.get<ChargeFixedOverride[]>(`/charge-fixed-overrides?${search.toString()}`);
};

export const createChargeFixedOverride = (data: ChargeFixedOverrideInput) =>
  apiClient.post<ChargeFixedOverride>("/charge-fixed-overrides", data);

export const updateChargeFixedOverride = (
  id: number,
  data: Partial<Pick<ChargeFixedOverrideInput, "override_type" | "formula" | "fixed_amount" | "unit" | "status">>,
) => apiClient.put<ChargeFixedOverride>(`/charge-fixed-overrides/${id}`, data);

export const deleteChargeFixedOverride = (id: number) =>
  apiClient.delete<{ message: string }>(`/charge-fixed-overrides/${id}`);

export type CloneChargeFixedOverridesInput = {
  source_agent_account_id: number;
  target_agent_account_ids: number[];
  // Omit to clone every override of the source account.
  override_ids?: number[];
  // true = replace a code the target already has; false = skip it.
  overwrite?: boolean;
};

export const cloneChargeFixedOverrides = (data: CloneChargeFixedOverridesInput) =>
  apiClient.post<{ message: string; created: number; updated: number; skipped: number }>(
    "/charge-fixed-overrides/clone",
    data,
  );
