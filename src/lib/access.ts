// Mirrors the backend's resolved access (AccessService, served on /me and /login). Only shapes
// the UI (hide menus/buttons/columns) — the API enforces every rule on its own.

export type FieldLevel = "hidden" | "view" | "edit";
export type DataScope = "own" | "branch" | "all";

export type Access = {
  is_super_admin: boolean;
  roles: { id: number; key: string; name: string }[];
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
const ROUTE_PERMISSIONS: { pattern: RegExp; permission: string | string[] }[] = [
  { pattern: /^\/shipment\/(create|draft)(\/|$)/, permission: "shipment.create" },
  { pattern: /^\/shipment(\/|$)/, permission: "shipment.view" },
  { pattern: /^\/dashboard(\/|$)/, permission: "shipment.view" },
  { pattern: /^\/pickup(\/|$)/, permission: "pickup.view" },
  { pattern: /^\/billing\/receipts\/new(\/|$)/, permission: "receipt.create" },
  { pattern: /^\/billing\/receipts\/[^/]+\/edit(\/|$)/, permission: "receipt.edit" },
  { pattern: /^\/billing\/receipts(\/|$)/, permission: "receipt.view" },
  { pattern: /^\/billing\/customers(\/|$)/, permission: ["billing_customer.manage", "receipt.create"] },
  { pattern: /^\/tracking(\/|$)/, permission: ["tracking.view", "shipment.view"] },
  { pattern: /^\/manifest(\/|$)/, permission: "report.manifest" },
  { pattern: /^\/reports\/summary(\/|$)/, permission: "report.summary" },
  { pattern: /^\/reports\/finance(\/|$)/, permission: "report.finance" },
  { pattern: /^\/branch(\/|$)/, permission: "branch.manage" },
  { pattern: /^\/customer(\/|$)/, permission: "customer.manage" },
  { pattern: /^\/config\/markup(\/|$)/, permission: "config.markup" },
  { pattern: /^\/config\/addon(\/|$)/, permission: "config.addon" },
  { pattern: /^\/config\/insurance-caps(\/|$)/, permission: "config.insurance" },
  { pattern: /^\/config\/supplies(\/|$)/, permission: "config.supplies" },
  { pattern: /^\/config\/weight-bands(\/|$)/, permission: "config.weight_bands" },
  { pattern: /^\/config\/manifest-options(\/|$)/, permission: "config.manifest_options" },
  { pattern: /^\/config\/receipt-line-templates(\/|$)/, permission: "config.receipt_templates" },
  { pattern: /^\/config\/countries(\/|$)/, permission: "config.countries" },
  { pattern: /^\/config\/agent-accounts(\/|$)/, permission: "config.agent_accounts" },
  { pattern: /^\/config\/thai-address(\/|$)/, permission: "config.thai_address" },
  { pattern: /^\/config\/users(\/|$)/, permission: "user.manage" },
  { pattern: /^\/config\/roles(\/|$)/, permission: "user.roles" },
  { pattern: /^\/config\/integrations(\/|$)/, permission: "config.integrations" },
  { pattern: /^\/config\/tracking-sync(\/|$)/, permission: "config.tracking_sync" },
  { pattern: /^\/config\/report-schedules(\/|$)/, permission: "config.report_schedules" },
  { pattern: /^\/config\/smtp-settings(\/|$)/, permission: "config.smtp" },
];

export function routePermission(pathname: string): string | string[] | null {
  return ROUTE_PERMISSIONS.find((r) => r.pattern.test(pathname))?.permission ?? null;
}

export function canVisit(access: Access, pathname: string): boolean {
  const permission = routePermission(pathname);
  return permission === null || can(access, permission);
}
