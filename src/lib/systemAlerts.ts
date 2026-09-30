import { apiClient } from "./apiClient";

// Background failures recorded by madd-backend SystemAlert::record — repeats of the same open
// alert are folded into one row (`occurrences`, `last_seen_at`).
export type SystemAlert = {
  id: number;
  level: "error" | "warning";
  source: string;
  message: string;
  context: Record<string, unknown> | null;
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  resolved_by: { id: number; name: string } | null;
};

export type SystemAlertPage = {
  data: SystemAlert[];
  current_page: number;
  last_page: number;
  total: number;
  sources: string[];
};

export type SystemAlertFilters = {
  status?: "open" | "resolved" | "all";
  source?: string;
  page?: number;
};

export const listSystemAlerts = (filters: SystemAlertFilters) => {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const qs = query.toString();
  return apiClient.get<SystemAlertPage>(`/system-alerts${qs ? `?${qs}` : ""}`);
};

export const getSystemAlertSummary = () => apiClient.get<{ open: number }>("/system-alerts/summary");

export const resolveSystemAlert = (id: number) => apiClient.post<SystemAlert>(`/system-alerts/${id}/resolve`, {});

export const resolveAllSystemAlerts = () => apiClient.post<{ resolved: number }>("/system-alerts/resolve-all", {});

// Lets the Topbar badge refresh right after alerts are resolved on the System Alerts page.
export const SYSTEM_ALERTS_CHANGED = "madd:system-alerts-changed";
