import { apiClient } from "./apiClient";
import type { Agent, AgentAccount } from "./agentAccounts";
import type { ChargeCode } from "./chargeCodes";

export type MarkupRule = {
  id: number;
  agent_id: number;
  agent_account_id: number;
  charge_code_id: number;
  rule_type: "SIMPLE" | "FORMULA";
  // e.g. "({BASE} + {FF}) * 7%" — {CODE} references another charge code's amount in the same
  // quote. Only meaningful when rule_type === "FORMULA".
  formula: string | null;
  value: string | number | null;
  unit: "PERCENTAGE" | "BAHT" | null;
  status: boolean;
  agent?: Agent;
  agent_account?: AgentAccount;
  charge_code?: ChargeCode;
};

export type MarkupRuleInput = {
  agent_id: number;
  agent_account_id: number;
  charge_code_id: number;
  rule_type: "SIMPLE" | "FORMULA";
  formula?: string | null;
  value?: number | null;
  unit?: "PERCENTAGE" | "BAHT" | null;
  status?: boolean;
};

export const listMarkupRules = (params: { agent_id?: number; agent_account_id?: number } = {}) => {
  const search = new URLSearchParams();
  if (params.agent_id) search.set("agent_id", String(params.agent_id));
  if (params.agent_account_id) search.set("agent_account_id", String(params.agent_account_id));

  return apiClient.get<MarkupRule[]>(`/markup-rules?${search.toString()}`);
};

export const createMarkupRule = (data: MarkupRuleInput) => apiClient.post<MarkupRule>("/markup-rules", data);

export const updateMarkupRule = (
  id: number,
  data: Partial<Pick<MarkupRuleInput, "rule_type" | "formula" | "value" | "unit" | "status">>,
) => apiClient.put<MarkupRule>(`/markup-rules/${id}`, data);

export const deleteMarkupRule = (id: number) => apiClient.delete<{ message: string }>(`/markup-rules/${id}`);
