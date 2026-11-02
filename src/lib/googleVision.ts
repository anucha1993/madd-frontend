import { apiClient } from "./apiClient";

export type GoogleVisionSettings = {
  is_configured: boolean;
  /** OCR goes through DataCorp with the same dca_sk_ key as the AI — no Google key needed. */
  via_datacorp?: boolean;
};

export const getGoogleVisionSettings = () => apiClient.get<GoogleVisionSettings>("/google-vision/settings");

export const updateGoogleVisionSettings = (apiKey: string) =>
  apiClient.put<{ message: string } & GoogleVisionSettings>("/google-vision/settings", { api_key: apiKey });
