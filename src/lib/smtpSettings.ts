import { apiClient } from "./apiClient";

export type SmtpSettings = {
  gmail_address: string | null;
  has_app_password: boolean;
  enabled: boolean;
  is_configured: boolean;
};

export const getSmtpSettings = () => apiClient.get<SmtpSettings>("/smtp-settings");

export const updateSmtpSettings = (data: { gmail_address: string; gmail_app_password?: string; enabled: boolean }) =>
  apiClient.put<SmtpSettings>("/smtp-settings", data);

export const testSmtpSettings = (to: string) =>
  apiClient.post<{ message: string }>("/smtp-settings/test", { to });
