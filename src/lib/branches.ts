import { apiClient } from "./apiClient";

export type Branch = {
  id: number;
  name: string;
  company_name: string;
  code: string;
  tax_id: string;
  address: string | null;
  phone: string | null;
  status: boolean;
  users_count?: number;
  carrier_accounts_count?: number;
};

export type BranchInput = {
  name: string;
  company_name: string;
  code: string;
  tax_id: string;
  address?: string;
  phone?: string;
  status?: boolean;
};

export const listBranches = () => apiClient.get<Branch[]>("/branches");

export const createBranch = (data: BranchInput) => apiClient.post<Branch>("/branches", data);

export const updateBranch = (id: number, data: Partial<BranchInput>) =>
  apiClient.put<Branch>(`/branches/${id}`, data);

export const deleteBranch = (id: number) => apiClient.delete<{ message: string }>(`/branches/${id}`);
