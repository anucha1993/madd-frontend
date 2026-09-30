import { apiClient } from "./apiClient";

// Who changed what — see madd-backend AuditLogger. `changes` is {field: {old, new}}; secrets are
// masked server-side as "***".
export type AuditLog = {
  id: number;
  event: string;
  subject_type: string;
  subject_id: number | null;
  subject_label: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  ip: string | null;
  created_at: string;
  user: { id: number; name: string; username: string } | null;
};

export type AuditLogPage = {
  data: AuditLog[];
  current_page: number;
  last_page: number;
  total: number;
  subject_types: string[];
};

export type AuditLogFilters = {
  subject_type?: string;
  event?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
};

export const listAuditLogs = (filters: AuditLogFilters) => {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const qs = query.toString();
  return apiClient.get<AuditLogPage>(`/audit-logs${qs ? `?${qs}` : ""}`);
};
