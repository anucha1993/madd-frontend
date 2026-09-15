import { apiClient } from "./apiClient";
import type { AgentAccount } from "./agentAccounts";

export type BranchCarrierAccount = {
  id: number;
  branch_id: number;
  agent_account_id: number;
  agent_account?: AgentAccount;
  label: string | null;
  tracking_prefix: string | null;
  is_default: boolean;
  // Which service/product codes this branch may use with this account — null/empty = all allowed.
  allowed_service_codes: string[] | null;
};

export type BranchCarrierAccountInput = {
  agent_account_id: number;
  label?: string | null;
  tracking_prefix?: string | null;
  is_default?: boolean;
  allowed_service_codes?: string[] | null;
};

export const listBranchCarrierAccounts = (branchId: number) =>
  apiClient.get<BranchCarrierAccount[]>(`/branches/${branchId}/carrier-accounts`);

export const syncBranchCarrierAccounts = (branchId: number, accounts: BranchCarrierAccountInput[]) =>
  apiClient.put<BranchCarrierAccount[]>(`/branches/${branchId}/carrier-accounts`, { accounts });
