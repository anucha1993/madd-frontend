import { apiClient } from "./apiClient";

// Public Rate API keys for external sites (madd-backend ApiClientController). The plain
// `api_key` is only ever returned by create / regenerate.
export type ApiClientRecord = {
  id: number;
  name: string;
  key_prefix: string | null;
  branch_id: number | null;
  branch?: { id: number; name: string; code: string | null } | null;
  origin_city: string;
  origin_postcode: string;
  carriers: ("UPS" | "DHL")[] | null;
  max_results: number;
  price_rounding: number;
  rate_limit_per_minute: number;
  end_user_limit_per_minute: number;
  allowed_ips: string[] | null;
  status: boolean;
  last_used_at: string | null;
  calls_30d?: number;
  failed_30d?: number;
};

export type ApiClientInput = Omit<ApiClientRecord, "id" | "key_prefix" | "branch" | "last_used_at" | "calls_30d" | "failed_30d">;

export type ApiRequestLog = {
  id: number;
  api_client: { id: number; name: string } | null;
  ip: string | null;
  end_user_ip: string | null;
  destination_country: string | null;
  total_weight: number | null;
  pieces: number | null;
  result_count: number;
  lowest_price: number | null;
  cached: boolean;
  status_code: number;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
};

export type PublicRateOption = {
  carrier: string;
  service_code: string;
  service_name: string;
  price: number;
  currency: string;
  transit_days: number | null;
  estimated_delivery: string | null;
};

export const listApiClients = () => apiClient.get<ApiClientRecord[]>("/api-clients");

export const createApiClient = (data: ApiClientInput) => apiClient.post<{ client: ApiClientRecord; api_key: string }>("/api-clients", data);

export const updateApiClient = (id: number, data: ApiClientInput) => apiClient.put<ApiClientRecord>(`/api-clients/${id}`, data);

export const regenerateApiKey = (id: number) => apiClient.post<{ client: ApiClientRecord; api_key: string }>(`/api-clients/${id}/regenerate`, {});

export const deleteApiClient = (id: number) => apiClient.delete<void>(`/api-clients/${id}`);

export const testApiClient = (id: number, body: unknown) =>
  apiClient.post<{ options: PublicRateOption[]; disclaimer: string }>(`/api-clients/${id}/test`, body);

export const listApiRequestLogs = (filters: { api_client_id?: number; status?: "ok" | "failed"; page?: number }) => {
  const q = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
  const s = q.toString();
  return apiClient.get<{ data: ApiRequestLog[]; current_page: number; last_page: number; total: number }>(`/api-clients/logs${s ? `?${s}` : ""}`);
};
