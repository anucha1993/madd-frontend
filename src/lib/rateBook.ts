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

// Another service priced in the same book (e.g. UPS 08 Worldwide Expedited shown as "Eco"), with
// its own weight bands — leave a package type's bands empty to skip it.
// A sub-column of an extra service in the main table: sits `under` a main column, priced to the
// destination of the `source` column (Eco/US CA under zone 5 is priced to USA PR).
export type RateBookSubColumn = { under: string; source: string; label: string };

// The UPS SAMPLE SAVE sheet's Eco columns (same as RateBookSettings::UPS_ECO_COLUMNS).
export const UPS_ECO_COLUMNS: RateBookSubColumn[] = [
  { under: "JP", source: "JP", label: "Eco JP" },
  { under: "5", source: "USA PR", label: "Eco/US CA" },
  { under: "7", source: "7", label: "Eco" },
  { under: "8", source: "8", label: "Eco" },
  { under: "9", source: "9", label: "Eco" },
];

export type RateBookExtraService = {
  code: string;
  label: string;
  bands: Record<RateBookPackageType, RateBookBand[]>;
  // [] = a sub-column under every column.
  columns?: RateBookSubColumn[];
};

export type RateBookCarrierSettings = {
  enabled: boolean;
  service_codes: Record<RateBookPackageType, string>;
  // The main service's name on the rate table (UPS 65 = "Saver").
  service_label: string;
  extra_services: RateBookExtraService[];
  bands: Record<RateBookPackageType, RateBookBand[]>;
  extra_columns?: { label: string; after?: string }[];
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
  // Last progress write — a running run that stops moving here has died (the server closes it after 10 min).
  updated_at: string | null;
  requester?: { id: number; name: string } | null;
};

export const getRateBookSettings = () => apiClient.get<RateBookSettingsResponse>("/rate-book/settings");

export const updateRateBookSettings = (settings: RateBookSettings) =>
  apiClient.put<{ settings: RateBookSettings }>("/rate-book/settings", settings);

// The scheduler picks the request up within a minute — a full sync takes ~10-20 minutes.
export const requestRateBookSync = () => apiClient.post<{ message: string }>("/rate-book/sync", {});

export const listRateBookRuns = () => apiClient.get<RateBookRun[]>("/rate-book/runs");

// Stops a running sync (a live one within seconds; one whose process already died at once).
export const cancelRateBookRun = (runId: number) => apiClient.post<{ message: string }>(`/rate-book/runs/${runId}/cancel`, {});

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

// A service a run priced; rows belong to it by service_code (anything else = the main one).
export type RateBookService = { key: string; label: string; main: boolean; codes: string[]; columns?: RateBookSubColumn[] };

export type RateBookRowsResponse = {
  vat_percent: number;
  services?: RateBookService[];
  columns: RateBookColumn[];
  rows: RateBookRow[];
};

export const getRateBookRows = (runId: number, carrier: RateBookCarrier) =>
  apiClient.get<RateBookRowsResponse>(`/rate-book/runs/${runId}/rows?carrier=${carrier}`);

// ---- Hand-typed rate cards (no API, e.g. SAGAWA → Japan) — checking prices only ----

export type ManualRateCard = {
  key: string;
  name: string;
  destination: string;
  // Shown in Check Rate (/shipment/create) for this destination (ISO2, e.g. JP) — quote only.
  country: string;
  currency: string;
  note: string;
  // A price per listed weight (0.5 … 10 every 0.5, 11 … 20 every 1 kg).
  steps: { weight: number; price: number }[];
  // Above the steps: whole kg × the band's rate; max null = "and up".
  per_kg: { min: number; max: number | null; price: number }[];
};

export const getManualRateCards = () => apiClient.get<{ cards: ManualRateCard[] }>("/rate-book/manual-cards");

export const saveManualRateCards = (cards: ManualRateCard[]) =>
  apiClient.put<{ cards: ManualRateCard[] }>("/rate-book/manual-cards", { cards });

/** The card's price for a weight: the next listed step up, else whole kg × its per-kg band (as ManualRateCards.php). */
export function manualCardPrice(card: ManualRateCard, weight: number): { price: number | null; how: string } {
  const steps = [...card.steps].sort((a, b) => a.weight - b.weight);
  const step = steps.find((s) => s.weight >= weight - 1e-9);
  if (step) return { price: step.price, how: step.weight === weight ? `${step.weight} kg` : `คิดที่ ${step.weight} kg` };
  const kg = Math.ceil(weight - 1e-9);
  const band = card.per_kg.find((b) => kg >= b.min && (b.max == null || kg <= b.max));
  if (!band) return { price: null, how: "" };
  return { price: Math.round(kg * band.price * 100) / 100, how: `${kg} kg × ${band.price} /kg (${band.max == null ? `${band.min}+` : `${band.min}–${band.max}`} kg)` };
}
