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
};

export type AgentAccountInput = {
  agent_id: number;
  username_acc: string;
  api_key?: string;
  client_id?: string;
  client_secret?: string;
  basic_auth_username?: string;
  basic_auth_password?: string;
  status?: boolean;
};

export const listAgents = () => apiClient.get<Agent[]>("/agents");

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
