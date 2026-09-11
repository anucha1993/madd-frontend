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

export const askRateAi = (message: string) =>
  apiClient.post<RateChatResult>("/ai/rate-chat", { message });


