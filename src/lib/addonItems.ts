import { apiClient } from "./apiClient";

export type AddonCategory = {
  id: number;
  name: string;
  sort_order: number;
};

export type AddonItem = {
  id: number;
  addon_category_id: number;
  name: string;
  carriers: ("UPS" | "DHL")[];
  price_type: "FIXED" | "MANUAL";
  price: string | number | null;
  trigger_type: "MANUAL" | "AUTO";
  status: boolean;
  note: string | null;
  category?: AddonCategory;
};

export const listAddonCategories = () => apiClient.get<AddonCategory[]>("/addon-categories");

export const createAddonCategory = (name: string) => apiClient.post<AddonCategory>("/addon-categories", { name });

export const deleteAddonCategory = (id: number) =>
  apiClient.delete<{ message: string }>(`/addon-categories/${id}`);

export const listAddonItems = (params: { addon_category_id?: number } = {}) => {
  const search = new URLSearchParams();
  if (params.addon_category_id) search.set("addon_category_id", String(params.addon_category_id));

  return apiClient.get<AddonItem[]>(`/addon-items?${search.toString()}`);
};

export type AddonItemInput = {
  addon_category_id: number;
  name: string;
  carriers: ("UPS" | "DHL")[];
  price_type: "FIXED" | "MANUAL";
  price?: number | null;
  trigger_type: "MANUAL" | "AUTO";
  status?: boolean;
  note?: string;
};

export const createAddonItem = (data: AddonItemInput) => apiClient.post<AddonItem>("/addon-items", data);

export const updateAddonItem = (id: number, data: Partial<AddonItemInput>) =>
  apiClient.put<AddonItem>(`/addon-items/${id}`, data);

export const deleteAddonItem = (id: number) => apiClient.delete<{ message: string }>(`/addon-items/${id}`);
