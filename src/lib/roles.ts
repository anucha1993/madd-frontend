import { apiClient } from "./apiClient";
import type { DataScope, FieldLevel } from "./access";

// Shape of madd-backend/config/permissions.php, served by GET /access/registry — the Roles UI
// renders straight from it, so a new action/field group/scope there shows up here automatically.
export type RegistryFieldGroup = {
  label: string;
  hint?: string;
  columns: string[];
  inputs?: Record<string, string | null>;
  default?: FieldLevel;
};

export type RegistryModule = {
  label: string;
  description?: string;
  category?: string;
  // action key -> short name ("ดู", "จอง"); action_hints explains each in the picker.
  actions?: Record<string, string>;
  action_hints?: Record<string, string>;
  fields?: Record<string, RegistryFieldGroup>;
  scope?: boolean;
};

export type PermissionRegistry = {
  modules: Record<string, RegistryModule>;
  categories: Record<string, { label: string; description: string | null }>;
  scopes: Record<DataScope, string>;
  field_levels: Record<FieldLevel, string>;
};

export type Role = {
  id: number;
  key: string;
  name: string;
  description: string | null;
  is_super_admin: boolean;
  is_system: boolean;
  permissions: string[];
  field_access: Record<string, Record<string, FieldLevel>>;
  data_scopes: Record<string, DataScope>;
  users_count?: number;
};

export type RoleInput = {
  key?: string;
  name: string;
  description?: string | null;
  is_super_admin?: boolean;
  permissions: string[];
  field_access: Record<string, Record<string, FieldLevel>>;
  data_scopes: Record<string, DataScope>;
};

export const getPermissionRegistry = () => apiClient.get<PermissionRegistry>("/access/registry");

export const listRoles = () => apiClient.get<Role[]>("/roles");

export const createRole = (data: RoleInput) => apiClient.post<Role>("/roles", data);

export const updateRole = (id: number, data: RoleInput) => apiClient.put<Role>(`/roles/${id}`, data);

export const deleteRole = (id: number) => apiClient.delete<null>(`/roles/${id}`);
