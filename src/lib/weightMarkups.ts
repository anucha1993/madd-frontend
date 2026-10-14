import { apiClient } from "./apiClient";

export type WeightMarkupCarrier = "UPS" | "DHL";
export type WeightMarkupPackageType = "document" | "box";

// rates by column — "all" (the band's default), "zone:5", "country:US". A cell is THB per kg (a
// number) or a formula string like "{BASE}*5%" whose result is THB for the whole shipment.
export type WeightMarkupCell = number | string | null;
export type WeightMarkupBand = { min_weight: number; max_weight: number | null; rates: Record<string, WeightMarkupCell> };

export type WeightMarkupMatrix = { bands: WeightMarkupBand[]; account_sets: number[] };

type Scope = { carrier: WeightMarkupCarrier; package_type: WeightMarkupPackageType; agent_account_id: number | null };

const query = (s: Scope) =>
  `carrier=${s.carrier}&package_type=${s.package_type}${s.agent_account_id ? `&agent_account_id=${s.agent_account_id}` : ""}`;

export const getWeightMarkups = (s: Scope) => apiClient.get<WeightMarkupMatrix>(`/weight-markups?${query(s)}`);

// Saves the whole matrix of one carrier × type × (all accounts | one account).
export const saveWeightMarkups = (s: Scope, bands: WeightMarkupBand[]) =>
  apiClient.put<WeightMarkupMatrix>("/weight-markups", { ...s, bands });

// Removes an account's own set — it falls back to the carrier-wide bands.
export const deleteWeightMarkupSet = (s: Scope) => apiClient.delete<{ message: string }>(`/weight-markups?${query(s)}`);
