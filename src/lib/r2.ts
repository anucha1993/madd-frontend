import { apiClient } from "./apiClient";

export type R2Settings = {
  is_configured: boolean;
  access_key_id: string | null;
  bucket: string | null;
  endpoint: string | null;
  has_secret_access_key: boolean;
};

export const getR2Settings = () => apiClient.get<R2Settings>("/r2/settings");

export const updateR2Settings = (data: { access_key_id: string; secret_access_key?: string; bucket: string; endpoint: string }) =>
  apiClient.put<{ message: string } & R2Settings>("/r2/settings", data);
