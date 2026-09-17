import { apiClient } from "./apiClient";

export type TrackingSyncSettings = {
  enabled: boolean;
  interval_minutes: number;
  last_run_at: string | null;
};

export type TrackingSyncLog = {
  id: number;
  started_at: string;
  finished_at: string | null;
  checked_count: number;
  updated_count: number;
  error_count: number;
  errors?: { shipment_id: number; tracking_number: string; message: string }[] | null;
  updates?: { shipment_id: number; tracking_number: string; carrier: string; from: string | null; to: string }[] | null;
  forced: boolean;
};

export type PaginatedTrackingSyncLogs = {
  data: TrackingSyncLog[];
  current_page: number;
  last_page: number;
  total: number;
};

export const getTrackingSyncSettings = () => apiClient.get<TrackingSyncSettings>("/tracking-sync/settings");

export const updateTrackingSyncSettings = (data: { enabled: boolean; interval_minutes: number }) =>
  apiClient.put<TrackingSyncSettings>("/tracking-sync/settings", data);

export const listTrackingSyncLogs = (page?: number) =>
  apiClient.get<PaginatedTrackingSyncLogs>(`/tracking-sync/logs${page ? `?page=${page}` : ""}`);

// Runs the sync immediately (bypasses the enabled/interval gate) — used by the settings page's
// "Run Now" button so staff can verify it works without waiting for the next scheduled tick.
export const runTrackingSyncNow = () => apiClient.post<TrackingSyncLog>("/tracking-sync/run-now", {});
