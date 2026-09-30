import { apiClient } from "./apiClient";
import type { Shipment } from "./shipments";

export type PickupAddress = {
  contact_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address: string;
  city: string;
  postcode: string;
};

// A Pickup is NOT tied to specific tracking numbers on the carrier side — only total piece
// count/weight + address + time window are sent — but we still keep the `shipments` we attached
// it to locally so staff can see/manage which bookings a pickup covers (see PickupController).
export type Pickup = {
  id: number;
  agent_account_id: number;
  carrier: "UPS" | "DHL";
  status: "requested" | "cancelled" | "failed";
  pickup_date: string;
  ready_time: string;
  close_time: string;
  address: PickupAddress;
  total_weight: number;
  total_pieces: number;
  carrier_reference: string | null;
  raw_response?: Record<string, unknown> | null;
  error_message: string | null;
  cancelled_at: string | null;
  created_at: string;
  agent_account?: { id: number; username_acc: string; agent?: { agent_code: string; name?: string } } | null;
  shipments?: Shipment[];
  // Derived from the attached shipments' picked_up_at (see Pickup::getCollectionAttribute) —
  // null for cancelled/failed pickups.
  collection?: PickupCollection | null;
};

export type PickupCollection = {
  state: "waiting" | "partial" | "collected" | "overdue";
  picked: number;
  total: number;
};

export type PaginatedPickups = {
  data: Pickup[];
  current_page: number;
  last_page: number;
  total: number;
};

export type CreatePickupInput = {
  agent_account_id: number;
  shipment_ids: number[];
  pickup_date: string;
  ready_time: string;
  close_time: string;
  contact_name?: string;
  company_name?: string;
  phone?: string;
  email?: string;
  address: string;
  city: string;
  postcode: string;
  reference_number?: string;
};

export const listPickups = (params?: { carrier?: "UPS" | "DHL"; status?: string; page?: number; overdue?: boolean }) => {
  const query = new URLSearchParams();
  if (params?.overdue) query.set("overdue", "1");
  if (params?.carrier) query.set("carrier", params.carrier);
  if (params?.status) query.set("status", params.status);
  if (params?.page) query.set("page", String(params.page));
  const qs = query.toString();
  return apiClient.get<PaginatedPickups>(`/pickups${qs ? `?${qs}` : ""}`);
};

export const createPickup = (data: CreatePickupInput) => apiClient.post<Pickup>("/pickups", data);

/** Staff confirm the courier came — marks every attached shipment as picked up. */
export const confirmPickupCollected = (id: number) => apiClient.post<Pickup>(`/pickups/${id}/confirm-collected`, {});

export const cancelPickup = (id: number, data?: { requestor_name?: string; reason?: string }) =>
  apiClient.post<Pickup>(`/pickups/${id}/cancel`, data ?? {});
