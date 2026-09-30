import { apiClient } from "./apiClient";

// Per-record history from madd-backend TimelineController — already filtered to what the
// viewer may see (related modules, hidden field groups, IP only for Audit Log holders).
export type TimelineEntry = {
  id: string;
  at: string;
  source: "Shipment" | "Receipt" | "Pickup" | "Stock" | string;
  source_id: number | null;
  event: string;
  label: string | null;
  actor: string | null;
  is_system: boolean;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  ip?: string | null;
};

export type TimelineSubject = "shipments" | "receipts" | "pickups";

export const getTimeline = (subject: TimelineSubject, id: number) =>
  apiClient.get<{ entries: TimelineEntry[] }>(`/${subject}/${id}/timeline`);
