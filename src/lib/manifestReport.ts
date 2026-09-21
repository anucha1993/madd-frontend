import { apiClient } from "./apiClient";
import { API_URL } from "./apiUrl";
import { getToken } from "./auth";

export type ManifestRangePreset = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export type ManifestReportFilters = {
  range: ManifestRangePreset;
  date_from?: string;
  date_to?: string;
  branch_id?: number;
  carrier?: "UPS" | "DHL";
  agent_account_id?: number;
};

export type ManifestReportRow = {
  tracking: string | null;
  ref: string | null;
  zone: string | null;
  weight_act: number;
  weight_dim: number;
  pay: string | null;
  dest: string | null;
  type: string | null;
  pkg: number;
  shipper: string | null;
  consignee: string | null;
  freight: number;
  sur: number;
  accs: number;
  ins: number;
  ins_co: string | null;
  metal: number;
  form: number;
  other: number;
  total_charge: number;
  remark: string | null;
  inv_value: number;
};

export type ManifestReportGroup = {
  header: {
    date: string | null;
    account_number: string;
    branch_name: string;
    branch_code: string;
    carrier: string;
  };
  rows: ManifestReportRow[];
};

export type ManifestReportResult = {
  groups: ManifestReportGroup[];
  total_shipments: number;
};

function buildQuery(filters: ManifestReportFilters) {
  const query = new URLSearchParams();
  query.set("range", filters.range);
  if (filters.date_from) query.set("date_from", filters.date_from);
  if (filters.date_to) query.set("date_to", filters.date_to);
  if (filters.branch_id) query.set("branch_id", String(filters.branch_id));
  if (filters.carrier) query.set("carrier", filters.carrier);
  if (filters.agent_account_id) query.set("agent_account_id", String(filters.agent_account_id));
  return query.toString();
}

export const listManifestReport = (filters: ManifestReportFilters) =>
  apiClient.get<ManifestReportResult>(`/manifest-report?${buildQuery(filters)}`);

// Downloads the .xlsx export directly (blob + temporary <a download> click) rather than opening
// a print-preview tab like the shipment document helpers — this is a spreadsheet, not something
// meant to be printed straight away.
export async function downloadManifestReport(filters: ManifestReportFilters) {
  const token = getToken();
  const res = await fetch(`${API_URL}/manifest-report/export?${buildQuery(filters)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error("ไม่สามารถ Export Manifest ได้");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `manifest-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
