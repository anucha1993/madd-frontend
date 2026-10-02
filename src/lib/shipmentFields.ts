import { apiClient } from "./apiClient";

// Per-carrier "must be filled" booking fields — see /config/shipment-fields and
// config/shipment_fields.php on the backend (which enforces the same rules on POST /shipments).
export type ShipmentFieldDef = {
  key: string; // payload path, `*` = every package / invoice line
  label: string;
  group: string;
  step: 1 | 2 | 3 | 4 | 5;
};

export type ShipmentFieldRules = {
  carriers: string[];
  groups: Record<string, string>;
  fields: ShipmentFieldDef[];
  rules: Record<string, string[]>;
};

export const getShipmentFieldRules = () => apiClient.get<ShipmentFieldRules>("/shipment-field-rules");

export const saveShipmentFieldRules = (rules: Record<string, string[]>) =>
  apiClient.put<ShipmentFieldRules>("/shipment-field-rules", { rules });

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
}

// Every value at `path` in `obj` ("a.b", "list.*.field"); a `*` over an empty list yields one
// blank so a required per-row field on zero rows still counts as missing.
function valuesAt(obj: unknown, path: string[]): unknown[] {
  if (path.length === 0) return [obj];
  const [head, ...rest] = path;
  if (head === "*") {
    const list = Array.isArray(obj) ? obj : [];
    return list.length ? list.flatMap((item) => valuesAt(item, rest)) : [undefined];
  }
  const next = obj && typeof obj === "object" ? (obj as Record<string, unknown>)[head] : undefined;
  return valuesAt(next, rest);
}

/** The required fields (for this carrier) that are still blank in the booking payload. */
export function missingRequiredFields(payload: unknown, config: ShipmentFieldRules | null, carrier: string | undefined): ShipmentFieldDef[] {
  if (!config || !carrier) return [];
  const required = new Set(config.rules[carrier] ?? []);
  return config.fields.filter((f) => required.has(f.key) && valuesAt(payload, f.key.split(".")).some(isBlank));
}
