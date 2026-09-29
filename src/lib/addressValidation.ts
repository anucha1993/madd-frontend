import { apiClient } from "./apiClient";

export type AddressValidationCandidate = {
  addressLines: string[];
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  classification: "commercial" | "residential" | "unknown";
};

export type AddressValidationResult = {
  valid: boolean;
  ambiguous: boolean;
  noCandidates: boolean;
  candidates: AddressValidationCandidate[];
};

export type AddressValidationInput = {
  country: string;
  city: string;
  state_code?: string;
  postcode?: string;
  address?: string;
  address2?: string;
  address3?: string;
  agent_account_id?: number;
};

// Validates an international Ship To address via UPS Street Level Address Validation.
export const validateAddress = (data: AddressValidationInput) =>
  apiClient.post<AddressValidationResult>("/address-validation/validate", data);
