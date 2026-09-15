import { apiClient } from "./apiClient";
import type { Agent, AgentAccount } from "./agentAccounts";
import type { ChargeCode } from "./chargeCodes";

export type ChargeFixedOverride = {
  id: number;
  agent_account_id: number;
  charge_code_id: number;
  fixed_amount: string | number;
  status: boolean;
  agent_account?: AgentAccount & { agent?: Agent };
  charge_code?: ChargeCode;
};

export type ChargeFixedOverrideInput = {
  agent_account_id: number;
  charge_code_id: number;
  fixed_amount: number;
  status?: boolean;
};

export const listChargeFixedOverrides = (params: { agent_account_id?: number } = {}) => {
  const search = new URLSearchParams();
  if (params.agent_account_id) search.set("agent_account_id", String(params.agent_account_id));

  return apiClient.get<ChargeFixedOverride[]>(`/charge-fixed-overrides?${search.toString()}`);
};

export const createChargeFixedOverride = (data: ChargeFixedOverrideInput) =>
  apiClient.post<ChargeFixedOverride>("/charge-fixed-overrides", data);

export const updateChargeFixedOverride = (id: number, data: Partial<Pick<ChargeFixedOverrideInput, "fixed_amount" | "status">>) =>
  apiClient.put<ChargeFixedOverride>(`/charge-fixed-overrides/${id}`, data);

export const deleteChargeFixedOverride = (id: number) =>
  apiClient.delete<{ message: string }>(`/charge-fixed-overrides/${id}`);
