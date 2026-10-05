import { apiClient } from "./apiClient";

export type GoogleVisionSettings = {
  is_configured: boolean;
};

export const getGoogleVisionSettings = () => apiClient.get<GoogleVisionSettings>("/google-vision/settings");

export const updateGoogleVisionSettings = (apiKey: string) =>
  apiClient.put<{ message: string } & GoogleVisionSettings>("/google-vision/settings", { api_key: apiKey });
