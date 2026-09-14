import { apiClient } from "./apiClient";

export type ManifestOptionGroup =
  | "customer_type"
  | "payment_option"
  | "zone"
  | "destination"
  | "charge_code"
  | "insurance_code"
  | "form_charge"
  | "bill_transportation_to"
  | "bill_duty_tax_to";

export type ManifestOptionProvider = "UPS" | "DHL";

export type ManifestOption = {
  id: number;
  group: ManifestOptionGroup;
  provider: ManifestOptionProvider | null;
  name: string;
  code: string;
  amount: string | number | null;
  sort_order: number;
  status: boolean;
};

export type ManifestOptionInput = {
  group: ManifestOptionGroup;
  provider?: ManifestOptionProvider | null;
  name: string;
  code: string;
  amount?: number | null;
  status?: boolean;
};

export const listManifestOptions = (group?: ManifestOptionGroup) =>
  apiClient.get<ManifestOption[]>(group ? `/manifest-options?group=${group}` : "/manifest-options");

export const createManifestOption = (data: ManifestOptionInput) =>
  apiClient.post<ManifestOption>("/manifest-options", data);

export const updateManifestOption = (id: number, data: Partial<ManifestOptionInput>) =>
  apiClient.put<ManifestOption>(`/manifest-options/${id}`, data);

export const deleteManifestOption = (id: number) =>
  apiClient.delete<{ message: string }>(`/manifest-options/${id}`);
