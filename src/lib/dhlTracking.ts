import { apiClient } from "./apiClient";
import type { UpsTrackingResult } from "./upsTracking";

export type DhlTrackingParams = {
  trackingNumber: string;
  agentAccountId?: number;
};

export const trackDhlShipment = (params: DhlTrackingParams) =>
  apiClient.post<UpsTrackingResult>("/dhl-tracking/track", {
    tracking_number: params.trackingNumber,
    agent_account_id: params.agentAccountId,
  });
