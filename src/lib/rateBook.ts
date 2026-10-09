import { apiClient } from "./apiClient";
import { API_URL } from "./apiUrl";
import { getToken } from "./auth";

export type RateBookCarrier = "UPS" | "DHL";
export type RateBookPackageType = "document" | "box";

// step = price every `step` kg (e.g. 0.5); null = one price PER KG for the whole band.
// max null = open-ended ("299.01+"). Above 10 kg the backend always rounds points up to whole kg.
export type RateBookBand = { min: number; max: number | null; step: number | null; account_id: number | null };

// For one zone, from min_weight up, quote with this account instead of the band's own.
export type RateBookAccountRule = { zone: string; min_weight: number; account_id: number };

export type RateBookZoneAddress = { iso2: string; city: string; postcode: string; state_code: string };

export type RateBookCarrierSettings = {
  enabled: boolean;
  service_codes: Record<RateBookPackageType, string>;
  bands: Record<RateBookPackageType, RateBookBand[]>;
  account_rules: RateBookAccountRule[];
  zone_countries: Record<string, RateBookZoneAddress>;
};

export type RateBookSettings = {
  enabled: boolean;
  frequency: "weekly" | "monthly";
  day_of_week: number;
  day_of_month: number;
  time: string;
  vat_percent: number;
  carriers: Record<RateBookCarrier, RateBookCarrierSettings>;
};

export type RateBookSettingsResponse = {
  settings: RateBookSettings;
  last_run_at: string | null;
  sync_requested: boolean;
  accounts: { id: number; carrier: RateBookCarrier; username: string; mode: string }[];
  zone_countries: Record<RateBookCarrier, Record<string, { iso2: string; name: string }[]>>;
};

export type RateBookRun = {
  id: number;
  status: "running" | "success" | "partial" | "failed";
  trigger: "schedule" | "manual";
  total_points: number;
  done_points: number;
  error_points: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  requester?: { id: number; name: string } | null;
};

export const getRateBookSettings = () => apiClient.get<RateBookSettingsResponse>("/rate-book/settings");

export const updateRateBookSettings = (settings: RateBookSettings) =>
  apiClient.put<{ settings: RateBookSettings }>("/rate-book/settings", settings);

// The scheduler picks the request up within a minute — a full sync takes ~10-20 minutes.
export const requestRateBookSync = () => apiClient.post<{ message: string }>("/rate-book/sync", {});

export const listRateBookRuns = () => apiClient.get<RateBookRun[]>("/rate-book/runs");

// One workbook per carrier, laid out like the business's own UPS/DHL rate files.
export async function downloadRateBook(run: RateBookRun, carrier: RateBookCarrier) {
  const token = getToken();
  const res = await fetch(`${API_URL}/rate-book/runs/${run.id}/export?carrier=${carrier}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("ดาวน์โหลดไฟล์ไม่สำเร็จ");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${carrier} Rate Book ${(run.finished_at ?? run.started_at ?? "").slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type RateBookRow = {
  package_type: RateBookPackageType;
  zone: string;
  country_iso2: string;
  band_label: string;
  weight: number;
  // Per-kg rows store every amount divided by the quoted weight.
  is_per_kg: boolean;
  account_username: string | null;
  service_code: string | null;
  // UPS published (pre-discount) freight — FULL; DISC % = 1 − freight / full. null for DHL.
  full: number | null;
  freight: number | null;
  fuel: number | null;
  surge: number | null;
  remote: number | null;
  peak: number | null;
  gogreen: number | null;
  other: number | null;
  // Carrier's own total. The charge fields above are after the account's Fixed Charges.
  cost: number | null;
  markup: number | null;
  // Round-up to a whole baht on top of markup (FREE in the rate-file template).
  rounding: number | null;
  sell: number | null;
  vat: number | null;
  total: number | null;
  error: string | null;
};

// One price column of the rate card: a zone, or an extra destination priced apart from its zone
// (UPS JP / AU / USA PR, DHL AU NZ). Rows are stored under `key`.
export type RateBookColumn = {
  key: string;
  label: string;
  zone: string;
  extra: boolean;
  iso2: string | null;
  country: string | null;
  countries: string[];
};

export type RateBookRowsResponse = {
  vat_percent: number;
  columns: RateBookColumn[];
  rows: RateBookRow[];
};

export const getRateBookRows = (runId: number, carrier: RateBookCarrier) =>
  apiClient.get<RateBookRowsResponse>(`/rate-book/runs/${runId}/rows?carrier=${carrier}`);
