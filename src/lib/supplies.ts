import { apiClient } from "./apiClient";

export type Supply = {
  id: number;
  name: string;
  type: string | null;
  weight: string | number | null;
  length: string | number | null;
  width: string | number | null;
  height: string | number | null;
  icon_url: string | null;
  weight_band_id: number | null;
  weight_band?: { id: number; code: string; label: string } | null;
  is_featured: boolean;
  cost_price: string | number;
  sale_price: string | number;
  description: string | null;
  status: boolean;
  // Balances at the caller's own branches (see /config/supplies/stock).
  stocks?: { branch_id: number; quantity: number; min_qty: number | null; max_qty: number | null }[];
};

export type SupplyInput = {
  name: string;
  type?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  icon_url?: string;
  weight_band_id?: number | null;
  is_featured?: boolean;
  cost_price: number;
  sale_price: number;
  description?: string;
  status?: boolean;
};

// The stored value stays as first saved ("กล่อง" is the paper carton) — only the label changes.
export const SUPPLY_TYPES = [
  { value: "กล่อง", label: "กล่องกระดาษ" },
  { value: "กล่องเหล็ก", label: "กล่องเหล็ก" },
  { value: "ซอง", label: "ซอง" },
];

export const supplyTypeLabel = (type: string | null) => SUPPLY_TYPES.find((t) => t.value === type)?.label ?? type ?? "-";

export const listSupplies = () => apiClient.get<Supply[]>("/supplies");

export const createSupply = (data: SupplyInput) => apiClient.post<Supply>("/supplies", data);

export const updateSupply = (id: number, data: Partial<SupplyInput>) =>
  apiClient.put<Supply>(`/supplies/${id}`, data);

export const deleteSupply = (id: number) => apiClient.delete<{ message: string }>(`/supplies/${id}`);
