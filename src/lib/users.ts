import { apiClient } from "./apiClient";
import type { Branch } from "./branches";

export type UserRoleRef = {
  id: number;
  key: string;
  name: string;
  is_super_admin: boolean;
};

export type AppUser = {
  id: number;
  name: string;
  username: string;
  email: string;
  roles: UserRoleRef[];
  can_access_all_branches: boolean;
  branches: Branch[];
};

export type AppUserInput = {
  name: string;
  username: string;
  email: string;
  password?: string;
  role_ids: number[];
  can_access_all_branches: boolean;
  branch_ids: number[];
};

export const listUsers = () => apiClient.get<AppUser[]>("/users");

export const createUser = (data: AppUserInput) => apiClient.post<AppUser>("/users", data);

export const updateUser = (id: number, data: Partial<AppUserInput>) =>
  apiClient.put<AppUser>(`/users/${id}`, data);

export const deleteUser = (id: number) => apiClient.delete<{ message: string }>(`/users/${id}`);
