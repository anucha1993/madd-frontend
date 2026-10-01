import { apiClient } from "./apiClient";
import { API_URL } from "./apiUrl";
import { getToken } from "./auth";

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
  browser_origins: string[] | null;
  allow_rates: boolean;
  allow_tracking: boolean;
  track_any_number: boolean;
  external_tracking_daily_limit: number;
  status: boolean;
  last_used_at: string | null;
  calls_30d?: number;
  failed_30d?: number;
};

export type ApiClientInput = Omit<ApiClientRecord, "id" | "key_prefix" | "branch" | "last_used_at" | "calls_30d" | "failed_30d">;

export type ApiRequestLog = {
  id: number;
  api_client: { id: number; name: string } | null;
  endpoint: "rates" | "tracking" | "web_tracking" | "web_rates";
  reference: string | null;
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

export type WordPressPlugin = { slug: string; name: string; version: string | null; summary: string; updated_at: string };

export const listWordPressPlugins = () => apiClient.get<WordPressPlugin[]>("/wordpress-plugins");

// Blob download (the endpoint needs the Bearer token, so a plain <a href> can't be used).
export async function downloadWordPressPlugin(plugin: WordPressPlugin) {
  const token = getToken();
  const res = await fetch(`${API_URL}/wordpress-plugins/${plugin.slug}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("ดาวน์โหลด Plugin ไม่สำเร็จ");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${plugin.slug}-${plugin.version ?? "latest"}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const listApiRequestLogs = (filters: { api_client_id?: number; status?: "ok" | "failed"; endpoint?: "rates" | "tracking" | "web_tracking" | "web_rates"; page?: number }) => {
  const q = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v !== undefined && q.set(k, String(v)));
  const s = q.toString();
  return apiClient.get<{ data: ApiRequestLog[]; current_page: number; last_page: number; total: number }>(`/api-clients/logs${s ? `?${s}` : ""}`);
};

// Website plugin usage (madd-backend PublicApiStatsService) — days/hours are Bangkok time.
export type ApiStatsGroup = {
  views: number;
  searches: number;
  visitors: number;
  searchers: number;
  successful: number;
  failed: number;
  cached: number;
  avg_ms: number;
  no_result?: number;
  not_found?: number;
  external?: number;
};

export type ApiStats = {
  from: string;
  to: string;
  summary: { rates: ApiStatsGroup; tracking: ApiStatsGroup };
  daily: { date: string; rates_views: number; rates_searches: number; tracking_views: number; tracking_searches: number }[];
  hourly: number[];
  destinations: { country: string; searches: number; avg_price: number | null; avg_weight: number | null }[];
  weights: { label: string; searches: number }[];
};

export const getApiStats = (filters: { date_from?: string; date_to?: string; api_client_id?: number }) => {
  const q = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => v !== undefined && v !== "" && q.set(k, String(v)));
  const s = q.toString();
  return apiClient.get<ApiStats>(`/api-clients/stats${s ? `?${s}` : ""}`);
};
