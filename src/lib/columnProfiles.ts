import { apiClient } from "./apiClient";

// Admin-defined table layouts for "Manage Columns" pages (see ColumnProfileController). Only
// `config.column_profiles` holders get role_ids back and may create/update/delete.
export type ColumnProfile = {
  id: number;
  name: string;
  columns: string[];
  // PHP serializes an empty map as [] — treat that the same as {}.
  group_of: Record<string, string> | [];
  role_ids?: number[];
};

export type ColumnProfilesResponse = {
  can_manage: boolean;
  profiles: ColumnProfile[];
  roles: { id: number; name: string }[];
};

export type ColumnProfileInput = {
  page_key?: string;
  name: string;
  columns: string[];
  group_of: Record<string, string>;
  role_ids: number[];
};

export const listColumnProfiles = (page: string) =>
  apiClient.get<ColumnProfilesResponse>(`/column-profiles?page=${encodeURIComponent(page)}`);

export const createColumnProfile = (data: ColumnProfileInput) => apiClient.post<ColumnProfile>("/column-profiles", data);

export const updateColumnProfile = (id: number, data: ColumnProfileInput) =>
  apiClient.put<ColumnProfile>(`/column-profiles/${id}`, data);

export const deleteColumnProfile = (id: number) => apiClient.delete<null>(`/column-profiles/${id}`);
