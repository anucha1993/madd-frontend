import { apiClient } from "./apiClient";

export type Branch = {
  id: number;
  name: string;
  company_name: string;
  code: string;
  tax_id: string;
  address: string | null;
  phone: string | null;
  fax: string | null;
  // Exactly one branch is normally flagged head office — its address/phone/fax is always
  // printed as the fixed "สำนักงานใหญ่" block on Receipts/Tax Invoices, alongside the specific
  // issuing branch's own "สำนักงานสาขา" block (see receipts).
  is_head_office: boolean;
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
  fax?: string;
  is_head_office?: boolean;
  status?: boolean;
};

export type DocumentNumberSequence = {
  id: number;
  branch_id: number;
  document_type: "CASH_RECEIPT" | "TAX_INVOICE";
  field: "vol_no" | "no";
  pattern: string;
  next_number: number;
};

export const listBranches = () => apiClient.get<Branch[]>("/branches");

export const createBranch = (data: BranchInput) => apiClient.post<Branch>("/branches", data);

export const updateBranch = (id: number, data: Partial<BranchInput>) =>
  apiClient.put<Branch>(`/branches/${id}`, data);

export const deleteBranch = (id: number) => apiClient.delete<{ message: string }>(`/branches/${id}`);

export const getDocumentNumberSettings = (branchId: number) =>
  apiClient.get<DocumentNumberSequence[]>(`/branches/${branchId}/document-number-settings`);

export const updateDocumentNumberSettings = (
  branchId: number,
  sequences: { id: number; pattern: string; next_number: number }[],
) =>
  apiClient.put<DocumentNumberSequence[]>(`/branches/${branchId}/document-number-settings`, { sequences });
