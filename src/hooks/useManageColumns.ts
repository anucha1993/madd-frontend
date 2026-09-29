"use client";

import { useState } from "react";

export type ColumnDef = { id: string; label: string };

const STORAGE_PREFIX = "manageColumns:";
const ORDER_SUFFIX = ":order";
const GROUP_SUFFIX = ":groups";

// Column visibility is per-browser (localStorage) for now, keyed by a per-page storageKey — no
// backend persistence yet. Once permission-based column restriction lands, filter `columns`
// down to what the user is allowed to see BEFORE passing them in here; this hook only remembers
// which of those allowed columns the user chose to hide.
function loadVisibility(storageKey: string, columns: ColumnDef[]): Record<string, boolean> {
  const defaults: Record<string, boolean> = {};
  columns.forEach((c) => (defaults[c.id] = true));
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (!raw) return defaults;
    return { ...defaults, ...(JSON.parse(raw) as Record<string, boolean>) };
  } catch {
    return defaults;
  }
}

// Saved order only ever lists ids known at save time — ids removed from `columns` since then are
// dropped here, and any brand-new column (added to the page after the user last saved) is
// appended at the end so it still shows up somewhere instead of vanishing.
function loadOrder(storageKey: string, columns: ColumnDef[]): string[] {
  const ids = columns.map((c) => c.id);
  if (typeof window === "undefined") return ids;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + storageKey + ORDER_SUFFIX);
    if (!raw) return ids;
    const saved = (JSON.parse(raw) as string[]).filter((id) => ids.includes(id));
    const missing = ids.filter((id) => !saved.includes(id));
    return [...saved, ...missing];
  } catch {
    return ids;
  }
}

// Maps a column id -> a group key; ids sharing the same group key are stacked (one on top of
// another) inside a single table cell instead of getting their own column. Ids removed from
// `columns` since the last save are dropped, same as loadOrder above.
function loadGroupOf(storageKey: string, columns: ColumnDef[]): Record<string, string> {
  const ids = new Set(columns.map((c) => c.id));
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + storageKey + GROUP_SUFFIX);
    if (!raw) return {};
    const saved = JSON.parse(raw) as Record<string, string>;
    const next: Record<string, string> = {};
    for (const [id, group] of Object.entries(saved)) {
      if (ids.has(id)) next[id] = group;
    }
    return next;
  } catch {
    return {};
  }
}

// Partitions `order` into display slots: consecutive-in-order columns sharing the same
// `groupOf` value are combined into one slot (rendered stacked in a single cell); everything
// else is its own single-column slot. Hidden columns are dropped, and a slot whose every member
// is hidden disappears entirely instead of leaving an empty cell.
function buildSlots<T extends ColumnDef>(order: string[], groupOf: Record<string, string>, byId: Map<string, T>, isVisible: (id: string) => boolean): T[][] {
  const seen = new Set<string>();
  const slots: T[][] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    const group = groupOf[id];
    const memberIds = group ? order.filter((oid) => groupOf[oid] === group) : [id];
    memberIds.forEach((m) => seen.add(m));
    const members = memberIds.map((m) => byId.get(m)).filter((c): c is T => !!c && isVisible(c.id));
    if (members.length > 0) slots.push(members);
  }
  return slots;
}

export function useManageColumns<T extends ColumnDef>(storageKey: string, columns: T[]) {
  const [visible, setVisible] = useState<Record<string, boolean>>(() => loadVisibility(storageKey, columns));
  const [order, setOrder] = useState<string[]>(() => loadOrder(storageKey, columns));
  const [groupOf, setGroupOf] = useState<Record<string, string>>(() => loadGroupOf(storageKey, columns));
  const [isOpen, setIsOpen] = useState(false);

  function isVisible(id: string) {
    return visible[id] ?? true;
  }

  const byId = new Map(columns.map((c) => [c.id, c]));
  const orderedColumns = order.map((id) => byId.get(id)).filter((c): c is T => !!c);
  // Defensive: a column present in `columns` but missing from `order` (shouldn't normally happen
  // given loadOrder's merge above, but guards against a stale/partial save) still gets rendered.
  columns.forEach((c) => {
    if (!order.includes(c.id)) orderedColumns.push(c);
  });

  const columnSlots = buildSlots(order, groupOf, byId, isVisible);

  function save(nextVisible: Record<string, boolean>, nextOrder: string[], nextGroupOf: Record<string, string>) {
    setVisible(nextVisible);
    setOrder(nextOrder);
    setGroupOf(nextGroupOf);
    localStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(nextVisible));
    localStorage.setItem(STORAGE_PREFIX + storageKey + ORDER_SUFFIX, JSON.stringify(nextOrder));
    localStorage.setItem(STORAGE_PREFIX + storageKey + GROUP_SUFFIX, JSON.stringify(nextGroupOf));
    setIsOpen(false);
  }

  return {
    columns,
    orderedColumns,
    columnSlots,
    groupOf,
    visible,
    isVisible,
    isOpen,
    openModal: () => setIsOpen(true),
    closeModal: () => setIsOpen(false),
    save,
  };
}

