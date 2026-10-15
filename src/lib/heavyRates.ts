import { apiClient } from "./apiClient";

export type HeavyRateCarrier = "UPS" | "DHL";

// rates by column — "all" (every zone without its own price), "zone:5" or "country:US" (a special
// price for one country, beating its zone); THB per kg.
export type HeavyRateBand = { min_weight: number; max_weight: number | null; rates: Record<string, number | null> };

// replaced_codes = the quote lines the Heavy Weight Rate line replaces (the rest stay); codes = every
// line a quote can carry, to pick from.
export type HeavyRateSettings = {
  bands: HeavyRateBand[];
  replaced_codes: string[];
  codes: { code: string; label: string }[];
};

export const getHeavyRates = (carrier: HeavyRateCarrier) => apiClient.get<HeavyRateSettings>(`/heavy-rates?carrier=${carrier}`);

// Saves the whole band × zone matrix of one carrier.
export const saveHeavyRates = (carrier: HeavyRateCarrier, bands: HeavyRateBand[]) =>
  apiClient.put<HeavyRateSettings>("/heavy-rates", { carrier, bands });

export const saveHeavyRateCodes = (carrier: HeavyRateCarrier, replaced_codes: string[]) =>
  apiClient.put<HeavyRateSettings>("/heavy-rates/codes", { carrier, replaced_codes });
