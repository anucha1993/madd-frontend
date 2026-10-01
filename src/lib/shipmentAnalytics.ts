import { apiClient } from "./apiClient";
import { API_URL } from "./apiUrl";
import { getToken } from "./auth";

// Reports › Shipment Analytics (madd-backend ShipmentAnalyticsService). Revenue keys are absent
// when the Role can't see the shipment pricing field.
export type AnalyticsKpis = {
  shipments: number;
  pieces: number;
  weight: number;
  revenue?: number;
  avg_revenue?: number;
  delivered_rate: number;
  void_rate: number;
  voided: number;
  avg_transit_days: number | null;
};

export type AnalyticsRow = { key: string; shipments: number; weight: number; revenue?: number; voided?: number; name?: string; carrier?: string; service?: string };

export type AttentionGroup = {
  count: number;
  items: { id: number; tracking_number: string | null; carrier: string; created_at: string; country: string | null }[];
};

export type ShipmentAnalytics = {
  from: string;
  to: string;
  previous: { from: string; to: string };
  group: "day" | "week" | "month";
  show_revenue: boolean;
  kpis: AnalyticsKpis;
  previous_kpis: AnalyticsKpis;
  trend: { period: string; DHL: number; UPS: number; voided: number; revenue?: number }[];
  carriers: AnalyticsRow[];
  destinations: AnalyticsRow[];
  branches: AnalyticsRow[];
  staff: AnalyticsRow[];
  attention: { awaiting_pickup: AttentionGroup; slow_transit: AttentionGroup; not_invoiced: AttentionGroup; void_not_notified: AttentionGroup };
};

export type AnalyticsFilters = { date_from: string; date_to: string; branch_id?: number; carrier?: "UPS" | "DHL"; created_by?: number };

const query = (f: AnalyticsFilters) => {
  const q = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => v !== undefined && v !== "" && q.set(k, String(v)));
  return q.toString();
};

export const getShipmentAnalytics = (filters: AnalyticsFilters) => apiClient.get<ShipmentAnalytics>(`/reports/shipment-analytics?${query(filters)}`);

export async function downloadShipmentAnalytics(filters: AnalyticsFilters) {
  const token = getToken();
  const res = await fetch(`${API_URL}/reports/shipment-analytics/export?${query(filters)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("Export ไม่สำเร็จ");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `shipment-analytics-${filters.date_from}-${filters.date_to}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
