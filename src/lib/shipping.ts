import { apiClient } from "./apiClient";

export type ShipmentPackageInput = {
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  quantity?: number;
  description?: string;
  is_document?: boolean;
};

export type CheckRateInput = {
  origin_contact_name?: string;
  origin_company?: string;
  origin_postcode: string;
  origin_city: string;
  origin_address?: string;
  origin_address2?: string;
  origin_address3?: string;
  origin_phone?: string;
  destination_contact_name?: string;
  destination_company?: string;
  destination_country: string;
  destination_city: string;
  destination_postcode?: string;
  destination_address?: string;
  destination_address2?: string;
  destination_address3?: string;
  destination_phone?: string;
  destination_email?: string;
  packages: ShipmentPackageInput[];
  agent_account_ids?: number[];
};

export type RateChargeLine = {
  code: string | null;
  description: string;
  amount: number;
  currency: string;
};

export type RateQuote = {
  carrier: "UPS" | "DHL";
  accountId: number;
  username: string;
  serviceCode: string | null;
  serviceLabel: string;
  currency?: string;
  billedWeight?: string | number | null;
  billedWeightUnit?: string | null;
  published?: number | null;
  negotiated?: number | null;
  isCustomerAgreement?: boolean;
  transitDays?: number | null;
  estimatedDelivery?: string | null;
  chargeBreakdown?: RateChargeLine[];
  error?: string | null;
};

export type CheckRateResult = {
  accountCount: number;
  results: RateQuote[];
};

export const checkRate = (data: CheckRateInput) => apiClient.post<CheckRateResult>("/shipping/check-rate", data);
