import { apiClient } from "./apiClient";

// /reports/finance — revenue (sell price) vs expense (the carrier's invoice, else the booking-time
// cost as an estimate) for booked shipments. See FinanceReportController.
export type FinanceGroupBy = "month" | "day" | "carrier" | "branch" | "customer_type";

export type FinanceBucket = {
  key: string;
  label: string;
  shipments: number;
  revenue: number;
  other_currency_count: number;
  // Absent for a Role whose shipment "cost" field is hidden.
  cost_invoiced?: number;
  cost_estimated?: number;
  expense?: number;
  profit?: number;
  margin?: number | null;
  invoiced_count?: number;
  estimated_count?: number;
  no_cost_count?: number;
};

export type FinanceReport = {
  date_from: string;
  date_to: string;
  group_by: FinanceGroupBy;
  show_cost: boolean;
  summary: FinanceBucket;
  groups: FinanceBucket[];
};

export type FinanceFilters = { date_from: string; date_to: string; group_by: FinanceGroupBy; carrier?: string; branch_id?: number | null };

export const getFinanceReport = (f: FinanceFilters) => {
  const q = new URLSearchParams({ date_from: f.date_from, date_to: f.date_to, group_by: f.group_by });
  if (f.carrier) q.set("carrier", f.carrier);
  if (f.branch_id) q.set("branch_id", String(f.branch_id));
  return apiClient.get<FinanceReport>(`/reports/finance?${q}`);
};
