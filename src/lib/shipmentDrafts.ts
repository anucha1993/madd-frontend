import { apiClient } from "./apiClient";

// The draft's form_state is a full serialized snapshot of the /shipment/create page's state
// (ship info, packages, addon rows, selected rate quote, payment info, etc.) — deliberately
// untyped here (the create page owns the exact shape) so this file doesn't need updating every
// time a new field is added to the form.
export type ShipmentDraft = {
  id: number;
  name: string | null;
  form_state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export const listShipmentDrafts = () => apiClient.get<ShipmentDraft[]>("/shipment-drafts");

export const getShipmentDraft = (id: number) => apiClient.get<ShipmentDraft>(`/shipment-drafts/${id}`);

export const createShipmentDraft = (data: { name?: string; form_state: Record<string, unknown> }) =>
  apiClient.post<ShipmentDraft>("/shipment-drafts", data);

export const updateShipmentDraft = (id: number, data: { name?: string; form_state: Record<string, unknown> }) =>
  apiClient.put<ShipmentDraft>(`/shipment-drafts/${id}`, data);

export const deleteShipmentDraft = (id: number) => apiClient.delete<{ message: string }>(`/shipment-drafts/${id}`);
