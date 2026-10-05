import { apiClient } from "./apiClient";
import { API_URL } from "./apiUrl";
import { getToken } from "./auth";

export type Country = {
  id: number;
  iso2: string;
  name: string;
  region: string | null;
  subregion: string | null;
  // Staff's own zone per carrier (Excel upload on /config/countries) — not the carrier API's zone.
  ups_zone: string | null;
  dhl_zone: string | null;
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


// --- Staff's own zones per country + prices per zone ({ZONE_PRICE} in Fixed Charges / Mark-up) ---

export type Carrier = "UPS" | "DHL";

export type ZonePrice = {
  id: number;
  carrier: Carrier;
  charge_code: string;
  // Exactly one of zone / country_iso2 — a country row overrides its zone's price.
  zone: string | null;
  country_iso2: string | null;
  price: number;
  note: string | null;
};

export type ZonePriceInput = Omit<ZonePrice, "id">;

export const updateCountryZones = (id: number, zones: { ups_zone?: string | null; dhl_zone?: string | null }) =>
  apiClient.put<Country>(`/country-zones/${id}`, zones);

export const listZonePrices = () => apiClient.get<ZonePrice[]>("/zone-prices");
export const createZonePrice = (data: ZonePriceInput) => apiClient.post<ZonePrice>("/zone-prices", data);
export const updateZonePrice = (id: number, data: ZonePriceInput) => apiClient.put<ZonePrice>(`/zone-prices/${id}`, data);
export const deleteZonePrice = (id: number) => apiClient.delete<{ message: string }>(`/zone-prices/${id}`);

function uploadSheet(path: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.upload<{ message: string }>(path, formData);
}

export const importCountryZones = (file: File) => uploadSheet("/country-zones/import", file);
export const importZonePrices = (file: File) => uploadSheet("/zone-prices/import", file);

// The download IS the upload template — current data, with a "วิธีใช้" sheet explaining columns.
async function downloadSheet(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error("ดาวน์โหลดไฟล์ไม่สำเร็จ");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const downloadCountryZones = () => downloadSheet("/country-zones/export", "country-zones.xlsx");
export const downloadZonePrices = () => downloadSheet("/zone-prices/export", "zone-prices.xlsx");
