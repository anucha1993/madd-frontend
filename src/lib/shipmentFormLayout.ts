import { apiClient } from "./apiClient";

// Ship From / Ship To field order + width on /shipment/create — one layout for every account,
// arranged by an admin on the form itself ("จัดตำแหน่ง"). Keys = shipment_fields keys.
export type FormLayoutSection = "origin" | "destination";
export type FormLayoutWidth = "full" | "half";
export type FormLayoutItem = { key: string; width: FormLayoutWidth };
export type ShipmentFormLayout = Record<FormLayoutSection, FormLayoutItem[]>;

// The form as it was built — also where a field missing from a saved layout goes.
export const DEFAULT_FORM_LAYOUT: ShipmentFormLayout = {
  origin: [
    { key: "origin.contact_name", width: "half" },
    { key: "origin.company", width: "half" },
    { key: "origin.tax_id", width: "full" },
    { key: "origin.postcode", width: "full" },
    { key: "origin.address", width: "full" },
    { key: "origin.address2", width: "half" },
    { key: "origin.address3", width: "half" },
    { key: "origin.phone", width: "full" },
    { key: "origin.notes", width: "full" },
  ],
  destination: [
    { key: "destination.contact_name", width: "half" },
    { key: "destination.company", width: "half" },
    { key: "destination.tax_id", width: "full" },
    { key: "destination.country", width: "full" },
    { key: "destination.city", width: "half" },
    { key: "destination.state", width: "half" },
    { key: "destination.postcode", width: "full" },
    { key: "destination.address", width: "full" },
    { key: "destination.address2", width: "half" },
    { key: "destination.address3", width: "half" },
    { key: "destination.phone", width: "half" },
    { key: "destination.email", width: "half" },
    { key: "destination.notes", width: "full" },
  ],
};

export const getShipmentFormLayout = () => apiClient.get<ShipmentFormLayout>("/shipment-form-layout");

export const saveShipmentFormLayout = (section: FormLayoutSection, fields: FormLayoutItem[]) =>
  apiClient.put<ShipmentFormLayout>("/shipment-form-layout", { section, fields });

/** A saved layout made safe: only fields the form has, every one of them (missing → default spot at the end). */
export function resolveFormLayout(section: FormLayoutSection, saved: FormLayoutItem[] | undefined): FormLayoutItem[] {
  const defaults = DEFAULT_FORM_LAYOUT[section];
  const known = new Set(defaults.map((d) => d.key));
  const kept = (saved ?? []).filter((item, i, all) => known.has(item.key) && all.findIndex((x) => x.key === item.key) === i);
  const missing = defaults.filter((d) => !kept.some((k) => k.key === d.key));
  return kept.length ? [...kept, ...missing] : defaults;
}
