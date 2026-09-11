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
  cost_price: string | number;
  sale_price: string | number;
  description: string | null;
  status: boolean;
};

export type SupplyInput = {
  name: string;
  type?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  icon_url?: string;
  cost_price: number;
  sale_price: number;
  description?: string;
  status?: boolean;
};

export const listSupplies = () => apiClient.get<Supply[]>("/supplies");

export const createSupply = (data: SupplyInput) => apiClient.post<Supply>("/supplies", data);

export const updateSupply = (id: number, data: Partial<SupplyInput>) =>
  apiClient.put<Supply>(`/supplies/${id}`, data);

export const deleteSupply = (id: number) => apiClient.delete<{ message: string }>(`/supplies/${id}`);
