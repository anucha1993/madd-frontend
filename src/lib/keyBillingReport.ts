import { apiClient } from "./apiClient";
import { API_URL } from "./apiUrl";
import { getToken } from "./auth";

export type KeyBillingRangePreset = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export type KeyBillingReportFilters = {
  range: KeyBillingRangePreset;
  date_from?: string;
  date_to?: string;
  branch_id?: number;
  carrier?: "UPS" | "DHL";
};

export type KeyBillingReportRow = {
  tracking: string | null;
  branch: string | null;
  carrier: string;
  account_number: string | null;
  destination_country: string | null;
  customer_type: string | null;
  payment_method: string | null;
  created_at: string | null;
  selling_total: number;
  cost_estimate: number;
  cost_invoice: number | null;
  cost_variance: number | null;
  margin_estimate: number;
  margin_actual: number | null;
  invoice_no: string | null;
  invoice_matched: boolean;
};

export type KeyBillingReportResult = {
  rows: KeyBillingReportRow[];
  total_shipments: number;
};

function buildQuery(filters: KeyBillingReportFilters) {
  const query = new URLSearchParams();
  query.set("range", filters.range);
  if (filters.date_from) query.set("date_from", filters.date_from);
  if (filters.date_to) query.set("date_to", filters.date_to);
  if (filters.branch_id) query.set("branch_id", String(filters.branch_id));
  if (filters.carrier) query.set("carrier", filters.carrier);
  return query.toString();
}

export const listKeyBillingReport = (filters: KeyBillingReportFilters) =>
  apiClient.get<KeyBillingReportResult>(`/key-billing-report?${buildQuery(filters)}`);

// Downloads the full-column .xlsx export (matches the reference template "ข้อมูลดึงเป็นรายงาน key
// billing.xlsx") directly as a blob, same pattern as downloadManifestReport.
export async function downloadKeyBillingReport(filters: KeyBillingReportFilters) {
  const token = getToken();
  const res = await fetch(`${API_URL}/key-billing-report/export?${buildQuery(filters)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error("ไม่สามารถ Export Key Billing Report ได้");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `key-billing-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
