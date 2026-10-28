// Mirrors the backend's resolved access (AccessService, served on /me and /login). Only shapes
// the UI (hide menus/buttons/columns) — the API enforces every rule on its own.

export type FieldLevel = "hidden" | "view" | "edit";
export type DataScope = "own" | "branch" | "all";

export type Access = {
  is_super_admin: boolean;
  // Role hierarchy rank — Roles / users are manageable only if ranked strictly below this.
  level?: number;
  roles: { id: number; key: string; name: string; level?: number }[];
  permissions: string[];
  fields: Record<string, Record<string, FieldLevel>>;
  scopes: Record<string, DataScope>;
};

export const NO_ACCESS: Access = { is_super_admin: false, roles: [], permissions: [], fields: {}, scopes: {} };

/** True if the user holds ANY of the given permission keys (e.g. "shipment.void"). */
export function can(access: Access, permission: string | string[]): boolean {
  if (access.is_super_admin) return true;
  const keys = Array.isArray(permission) ? permission : [permission];
  return keys.some((key) => access.permissions.includes(key));
}

export function fieldLevel(access: Access, module: string, group: string): FieldLevel {
  if (access.is_super_admin) return "edit";
  return access.fields[module]?.[group] ?? "hidden";
}

export function canSeeField(access: Access, module: string, group: string): boolean {
  return fieldLevel(access, module, group) !== "hidden";
}

export function canEditField(access: Access, module: string, group: string): boolean {
  return fieldLevel(access, module, group) === "edit";
}

// Page-level requirements, matched most-specific first. A route not listed here (e.g.
// /profile) is open to every signed-in user. Keep in sync with the `perm:` middleware in
// madd-backend/routes/api.php.
// `permission`: any one of them. `all`: every one too — for pages whose API needs two (e.g. the
// shipment detail page reads GET shipments/{id}, which needs shipment.view as well).
const ROUTE_PERMISSIONS: { pattern: RegExp; permission: string | string[]; all?: string[] }[] = [
  { pattern: /^\/shipment\/create(\/|$)/, permission: "shipment.create" },
  { pattern: /^\/shipment\/draft(\/|$)/, permission: "shipment.draft" },
  { pattern: /^\/shipment\/view(\/|$)/, permission: "shipment.detail", all: ["shipment.view"] },
  { pattern: /^\/shipment(\/|$)/, permission: "shipment.view" },
  { pattern: /^\/dashboard(\/|$)/, permission: "shipment.view" },
  { pattern: /^\/pickup(\/|$)/, permission: "pickup.view" },
  // Issuing picks the shipments to bill (GET shipments — shipment.view).
  { pattern: /^\/billing\/receipts\/new(\/|$)/, permission: "receipt.create", all: ["shipment.view"] },
  { pattern: /^\/billing\/receipts\/[^/]+\/edit(\/|$)/, permission: "receipt.edit", all: ["receipt.view"] },
  { pattern: /^\/billing\/carrier-invoices(\/|$)/, permission: "carrier_invoice.view" },
  { pattern: /^\/billing\/receipts(\/|$)/, permission: "receipt.view" },
  // Before /supply-sales — selling has its own permission.
  { pattern: /^\/supply-sales\/new(\/|$)/, permission: "supply_sale.create" },
  { pattern: /^\/supply-sales(\/|$)/, permission: "supply_sale.view" },
  { pattern: /^\/billing\/customers(\/|$)/, permission: ["billing_customer.view", "receipt.create"] },
  { pattern: /^\/tracking(\/|$)/, permission: ["tracking.view", "shipment.view"] },
  { pattern: /^\/manifest(\/|$)/, permission: "report.manifest" },
  { pattern: /^\/reports\/summary(\/|$)/, permission: "report.summary" },
  { pattern: /^\/reports\/finance(\/|$)/, permission: "report.finance" },
  { pattern: /^\/reports\/rate-book(\/|$)/, permission: "report.rate_book" },
  { pattern: /^\/reports\/key-billing(\/|$)/, permission: "report.key_billing" },
  { pattern: /^\/branch(\/|$)/, permission: "branch.view" },
  { pattern: /^\/customer(\/|$)/, permission: "customer.view" },
  { pattern: /^\/config\/markup(\/|$)/, permission: "config.markup" },
  { pattern: /^\/config\/weight-markups(\/|$)/, permission: "config.weight_markups" },
  { pattern: /^\/config\/heavy-rates(\/|$)/, permission: "config.heavy_rates" },
  { pattern: /^\/config\/customer-display(\/|$)/, permission: "config.customer_display" },
  { pattern: /^\/config\/charge-names(\/|$)/, permission: "config.charge_names" },
  { pattern: /^\/config\/addon(\/|$)/, permission: "config.addon" },
  { pattern: /^\/config\/insurance-caps(\/|$)/, permission: "config.insurance" },
  // Before /config/supplies — the stock page has its own (branch-staff) permission.
  { pattern: /^\/config\/supplies\/stock(\/|$)/, permission: "supply_stock.view" },
  { pattern: /^\/config\/supplies(\/|$)/, permission: "config.supplies" },
  { pattern: /^\/config\/weight-bands(\/|$)/, permission: "config.weight_bands" },
  { pattern: /^\/config\/manifest-options(\/|$)/, permission: "config.manifest_options" },
  { pattern: /^\/config\/receipt-line-templates(\/|$)/, permission: "config.receipt_templates" },
  { pattern: /^\/config\/countries(\/|$)/, permission: "config.countries" },
  { pattern: /^\/config\/agent-accounts(\/|$)/, permission: "config.agent_accounts" },
  { pattern: /^\/config\/thai-address(\/|$)/, permission: "config.thai_address" },
  { pattern: /^\/config\/users(\/|$)/, permission: "user.view" },
  { pattern: /^\/config\/roles(\/|$)/, permission: "user.roles" },
  { pattern: /^\/config\/audit-logs(\/|$)/, permission: "user.audit" },
  { pattern: /^\/config\/system-alerts(\/|$)/, permission: "config.system_alerts" },
  { pattern: /^\/config\/api-clients(\/|$)/, permission: "config.api_clients" },
  { pattern: /^\/config\/integrations(\/|$)/, permission: "config.integrations" },
  { pattern: /^\/config\/tracking-sync(\/|$)/, permission: "config.tracking_sync" },
  { pattern: /^\/config\/shipment-fields(\/|$)/, permission: "config.shipment_fields" },
  { pattern: /^\/config\/report-schedules(\/|$)/, permission: "config.report_schedules" },
  { pattern: /^\/config\/smtp-settings(\/|$)/, permission: "config.smtp" },
];

export function routePermission(pathname: string): string | string[] | null {
  return ROUTE_PERMISSIONS.find((r) => r.pattern.test(pathname))?.permission ?? null;
}

export function canVisit(access: Access, pathname: string): boolean {
  const rule = ROUTE_PERMISSIONS.find((r) => r.pattern.test(pathname));
  if (!rule) return true;
  return can(access, rule.permission) && (rule.all ?? []).every((p) => can(access, p));
}
