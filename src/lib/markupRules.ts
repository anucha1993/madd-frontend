import { apiClient } from "./apiClient";
import type { Agent, AgentAccount } from "./agentAccounts";
import type { ChargeCode } from "./chargeCodes";

export type MarkupRule = {
  id: number;
  agent_id: number;
  agent_account_id: number;
  charge_code_id: number;
  value: string | number;
  unit: "PERCENTAGE" | "BAHT";
  status: boolean;
  agent?: Agent;
  agent_account?: AgentAccount;
  charge_code?: ChargeCode;
};

export type MarkupRuleInput = {
  agent_id: number;
  agent_account_id: number;
  charge_code_id: number;
  value: number;
  unit: "PERCENTAGE" | "BAHT";
  status?: boolean;
};

export const listMarkupRules = (params: { agent_id?: number; agent_account_id?: number } = {}) => {
  const search = new URLSearchParams();
  if (params.agent_id) search.set("agent_id", String(params.agent_id));
  if (params.agent_account_id) search.set("agent_account_id", String(params.agent_account_id));

  return apiClient.get<MarkupRule[]>(`/markup-rules?${search.toString()}`);
};

export const createMarkupRule = (data: MarkupRuleInput) => apiClient.post<MarkupRule>("/markup-rules", data);

export const updateMarkupRule = (id: number, data: Partial<Pick<MarkupRuleInput, "value" | "unit" | "status">>) =>
  apiClient.put<MarkupRule>(`/markup-rules/${id}`, data);

export const deleteMarkupRule = (id: number) => apiClient.delete<{ message: string }>(`/markup-rules/${id}`);
