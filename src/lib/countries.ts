import { apiClient } from "./apiClient";

export type Country = {
  id: number;
  iso2: string;
  name: string;
  region: string | null;
  subregion: string | null;
  status: boolean;
  synced_at: string | null;
};

export const listCountries = () => apiClient.get<Country[]>("/countries");

export const syncCountries = () => apiClient.post<{ message: string; count: number }>("/countries/sync", {});

export const updateCountryStatus = (id: number, status: boolean) =>
  apiClient.put<Country>(`/countries/${id}`, { status });

export type RestCountriesSettings = {
  is_configured: boolean;
  masked_api_key: string | null;
};

export const getRestCountriesSettings = () => apiClient.get<RestCountriesSettings>("/countries/settings");

export const updateRestCountriesSettings = (apiKey: string) =>
  apiClient.put<{ message: string } & RestCountriesSettings>("/countries/settings", { api_key: apiKey });

