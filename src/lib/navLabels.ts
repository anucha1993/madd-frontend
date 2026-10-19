import { apiClient } from "./apiClient";
import type { NavItem } from "./nav";

// Custom left-menu names — one set for everyone, renamed by a Super Admin with the pencil in the
// sidebar. Key: a page's href, or "section:<id>" for a group (nav.ts); none = built-in name.
export type NavLabels = Record<string, string>;

export const navLabelKey = (item: { id?: string; href?: string; label: string; children?: unknown }) =>
  item.children || !item.href ? `section:${item.id ?? item.label}` : item.href;

export const getNavLabels = () => apiClient.get<{ labels: NavLabels }>("/nav-labels");

/** An empty label puts the built-in name back. */
export const saveNavLabel = (key: string, label: string) =>
  apiClient.put<{ labels: NavLabels }>("/nav-labels", { key, label });

export const labelOf = (labels: NavLabels, item: Pick<NavItem, "id" | "href" | "label" | "children">) =>
  labels[navLabelKey(item)] || item.label;
