import { apiClient } from "./apiClient";

export type Branch = {
  id: number;
  name: string;
  // Short, easy-to-remember label staff use to tell branches apart (e.g. "บางใหญ่") — shown
  // next to the company name everywhere it's displayed, since every branch otherwise shares the
  // identical `name`/`company_name` text and only the (hard to remember) `code` differs.
  nickname: string | null;
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
  nickname?: string;
  company_name: string;
  code: string;
  tax_id: string;
  address?: string;
  phone?: string;
  fax?: string;
  is_head_office?: boolean;
  status?: boolean;
};

/** Company/branch name + "(nickname)" — the one shared format for every branch display in the app, e.g. "บริษัท เอ็มเอดีดี จำกัด (บางใหญ่)". Falls back to the branch code when no nickname is set yet. */
export function branchLabel(b: { name: string; code?: string | null; nickname?: string | null }): string {
  return b.nickname || b.code ? `${b.name} (${b.nickname || b.code})` : b.name;
}

/** Same idea, anchored on the company name specifically (used wherever `company_name` is the primary text, e.g. document headers). */
export function companyDisplayName(b: { company_name: string; nickname?: string | null }): string {
  return b.nickname ? `${b.company_name} (${b.nickname})` : b.company_name;
}

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
