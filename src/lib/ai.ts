import { apiClient } from "./apiClient";
import type { RateQuote } from "./shipping";

export type AiSettings = {
  is_configured: boolean;
  masked_api_key: string | null;
  is_enabled: boolean;
};

export const getAiSettings = () => apiClient.get<AiSettings>("/ai/settings");

export const updateAiSettings = (apiKey: string) =>
  apiClient.put<{ message: string } & AiSettings>("/ai/settings", { api_key: apiKey });

export const toggleAi = (enabled: boolean) =>
  apiClient.put<{ message: string } & AiSettings>("/ai/toggle", { enabled });

export type ParsedAddress = {
  contact_name: string | null;
  company: string | null;
  address1: string | null;
  address2: string | null;
  subdistrict: string | null;
  district: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country_iso2: string | null;
  phone: string | null;
  email: string | null;
};

export const parseAddressWithAi = (text: string) =>
  apiClient.post<ParsedAddress>("/ai/parse-address", { text });

export type RateChatResult = {
  reply: string;
  extracted?: Record<string, unknown>;
  quotes: RateQuote[];
};

/** AI plan when the AI/OCR go through DataCorp (dca_sk_ key) — `enabled: false` otherwise. Pay links only for config.integrations. */
export type AiPlan = {
  enabled: boolean;
  can_pay?: boolean;
  plan?: string | null;
  used?: number;
  included?: number | null;
  remaining?: number | null;
  renews_at?: string | null;
  blocked?: boolean;
  reason?: string | null;
  message?: string | null;
  upgrade_url?: string | null;
  upgrade_plan?: string | null;
  upgrade_price?: number | null;
  pay_url?: string | null;
  plans_url?: string | null;
  /** trial / expired: one pay link per paid plan (e.g. Pro ฿990, Business ฿2,990) */
  plans?: AiPlanOption[];
  days_left?: number | null;
  renew_due?: boolean;
  auto_renew?: boolean;
};

export type AiPlanOption = { name: string; price_thb: number; billing: string; included: number | null; recommended: boolean; url: string };

export const getAiPlan =(fresh = false) => apiClient.get<AiPlan>(`/ai/plan${fresh ? "?fresh=1" : ""}`);

/** `payment` part of a 402 from the AI endpoints (plan expired / credits used up / unpaid). */
export type AiPayment = { reason: string; title: string; detail: string; pay_url: string | null };

export const askRateAi = (message: string) =>
  apiClient.post<RateChatResult>("/ai/rate-chat", { message });


