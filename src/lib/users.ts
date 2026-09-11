import { apiClient } from "./apiClient";
import type { Branch } from "./branches";

export type UserRole = "admin" | "staff";

export type AppUser = {
  id: number;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  can_access_all_branches: boolean;
  branches: Branch[];
};

export type AppUserInput = {
  name: string;
  username: string;
  email: string;
  password?: string;
  role: UserRole;
  can_access_all_branches: boolean;
  branch_ids: number[];
};

export const listUsers = () => apiClient.get<AppUser[]>("/users");

export const createUser = (data: AppUserInput) => apiClient.post<AppUser>("/users", data);

export const updateUser = (id: number, data: Partial<AppUserInput>) =>
  apiClient.put<AppUser>(`/users/${id}`, data);

export const deleteUser = (id: number) => apiClient.delete<{ message: string }>(`/users/${id}`);
