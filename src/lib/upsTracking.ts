import { apiClient } from "./apiClient";

export type UpsTrackingActivity = {
  date: string | null;
  time: string | null;
  description: string | null;
  statusCode: string | null;
  statusType: string | null;
  location: string | null;
};

export type UpsTrackingPackage = {
  trackingNumber: string | null;
  currentStatusDescription: string | null;
  currentStatusCode: string | null;
  scheduledDeliveryDate: string | null;
  activities: UpsTrackingActivity[];
  podAvailable: boolean;
  podImageBase64: string | null;
  signatureImageBase64: string | null;
};

export type UpsTrackingAccount = {
  id: number;
  username_acc: string;
  agent_code: string;
};

export type UpsTrackingResult = {
  packages: UpsTrackingPackage[];
  account?: UpsTrackingAccount;
};

export type UpsTrackingParams = {
  mode: "inquiry" | "reference";
  number: string;
  agentAccountId?: number;
  returnPod?: boolean;
  returnSignature?: boolean;
  offset?: number;
  count?: number;
  fromPickupDate?: string;
  toPickupDate?: string;
};

export const trackUpsShipment = (params: UpsTrackingParams) =>
  apiClient.post<UpsTrackingResult>("/ups-tracking/track", {
    inquiry_number: params.mode === "inquiry" ? params.number : undefined,
    reference_number: params.mode === "reference" ? params.number : undefined,
    agent_account_id: params.agentAccountId,
    return_pod: params.returnPod,
    return_signature: params.returnSignature,
    offset: params.offset,
    count: params.count,
    from_pickup_date: params.fromPickupDate,
    to_pickup_date: params.toPickupDate,
  });
