import { apiClient } from "./apiClient";

export type Agent = {
  id: number;
  agent_name: string;
  agent_code: string;
  logo_url: string | null;
  status: boolean;
  accounts_count?: number;
};

export type AgentAccount = {
  id: number;
  agent_id: number;
  agent?: Agent;
  username_acc: string;
  api_key: string | null;
  client_id: string | null;
  basic_auth_username: string | null;
  has_client_secret: boolean;
  has_basic_auth_password: boolean;
  status: boolean;
  mode: "test" | "production";
  // false = a carrier with no real API integration (e.g. Kerry, Flash) \u2014 excluded from
  // rate-checking/booking on Shipment creation, but still selectable when issuing a Receipt.
  is_api_enabled: boolean;
  // Check Rate only asks this account when the shipment's billed weight is in this range (kg);
  // null = no limit on that side.
  rate_min_weight: number | null;
  rate_max_weight: number | null;
  // Per-service range (e.g. UPS 08 Expedited 10.01–70); a service not listed uses the range above.
  service_weight_ranges: ServiceWeightRange[] | null;
};

// min_charge: under `min` still sold, priced at this weight (null = not sold under the range).
export type ServiceWeightRange = { service_code: string; min: number | null; max: number | null; min_charge?: number | null };

export type AgentAccountInput = {
  agent_id: number;
  username_acc: string;
  api_key?: string;
  client_id?: string;
  client_secret?: string;
  basic_auth_username?: string;
  basic_auth_password?: string;
  status?: boolean;
  mode?: "test" | "production";
  is_api_enabled?: boolean;
  rate_min_weight?: number | null;
  rate_max_weight?: number | null;
  service_weight_ranges?: ServiceWeightRange[];
};

// "0–10 kg", "10.01 kg ขึ้นไป", "ถึง 10 kg" — null when there's no limit.
export const weightRangeText = (min: number | null | undefined, max: number | null | undefined) =>
  min == null && max == null ? null : max == null ? `${min} kg ขึ้นไป` : min == null ? `ถึง ${max} kg` : `${min}–${max} kg`;

export const rateWeightRangeLabel = (a: Pick<AgentAccount, "rate_min_weight" | "rate_max_weight">) =>
  weightRangeText(a.rate_min_weight, a.rate_max_weight);

export const listAgents = () => apiClient.get<Agent[]>("/agents");

export const createAgent = (data: { agent_name: string; agent_code: string; logo_url?: string | null }) =>
  apiClient.post<Agent>("/agents", data);

export const updateAgent = (id: number, data: { logo_url?: string | null }) =>
  apiClient.put<Agent>(`/agents/${id}`, data);


export const listAgentAccounts = () => apiClient.get<AgentAccount[]>("/agent-accounts");

export const createAgentAccount = (data: AgentAccountInput) =>
  apiClient.post<AgentAccount>("/agent-accounts", data);

export const updateAgentAccount = (id: number, data: Partial<AgentAccountInput>) =>
  apiClient.put<AgentAccount>(`/agent-accounts/${id}`, data);

export const deleteAgentAccount = (id: number) => apiClient.delete<{ message: string }>(`/agent-accounts/${id}`);

export type TestResult = {
  success: boolean;
  message: string;
  detail?: string;
};

export const testAgentAccount = (id: number) => apiClient.post<TestResult>(`/agent-accounts/${id}/test`, {});

export type DhlProduct = {
  code: string;
  name: string;
};

// Fetches this DHL account's real available product codes/names (via a lightweight reference
// rate call server-side) — used so admins picking allowed_service_codes see actual product
// names instead of guessing codes, since DHL (unlike UPS) has no fixed product list.
export const listDhlProducts = (id: number) => apiClient.get<DhlProduct[]>(`/agent-accounts/${id}/dhl-products`);
