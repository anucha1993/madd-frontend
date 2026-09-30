"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createColumnProfile,
  deleteColumnProfile,
  listColumnProfiles,
  updateColumnProfile,
  type ColumnProfile,
  type ColumnProfilesResponse,
} from "@/lib/columnProfiles";

export type ColumnDef = { id: string; label: string };

export type ProfileMeta = { name: string; role_ids: number[] };

const STORAGE_PREFIX = "manageColumns:";
const ORDER_SUFFIX = ":order";
const GROUP_SUFFIX = ":groups";
const PROFILE_SUFFIX = ":profile";

// WHICH columns a page shows is decided by an admin through Column Profiles (server-side, per
// Role — see ColumnProfileController); each user may only re-arrange (order / stack) a
// profile's columns, remembered per browser in localStorage under a per-profile key.
// `columns` must already be filtered to what the user's field access allows — a profile can
// never bring back a column the Role may not see.
//
// Without any profile for the page: `config.column_profiles` holders keep the old fully
// personal show/hide behaviour (and can save it as a profile); everyone else sees every allowed
// column and can only re-arrange.

function readJson<V>(key: string): V | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as V) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / storage full — layout just won't persist.
  }
}

function removeKeys(...keys: string[]) {
  try {
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// Saved order only ever lists ids known at save time — ids no longer in `ids` are dropped, and
// any id added since then is appended in its default position order.
function mergeOrder(saved: string[] | null, ids: string[]): string[] {
  if (!saved) return ids;
  const kept = saved.filter((id) => ids.includes(id));
  return [...kept, ...ids.filter((id) => !kept.includes(id))];
}

// Group entries whose column is no longer present are dropped.
function filterGroups(groups: Record<string, string> | [] | null | undefined, ids: string[]): Record<string, string> {
  if (!groups || Array.isArray(groups)) return {};
  return Object.fromEntries(Object.entries(groups).filter(([id]) => ids.includes(id)));
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
  const [server, setServer] = useState<ColumnProfilesResponse | null>(null);
  const [activeId, setActiveId] = useState<number | null>(() => readJson<number>(STORAGE_PREFIX + storageKey + PROFILE_SUFFIX));
  // Bumped after every localStorage write so the derived layout below re-reads it.
  const [version, setVersion] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  async function reload(selectId?: number | null) {
    try {
      const res = await listColumnProfiles(storageKey);
      setServer(res);
      if (selectId !== undefined) setActiveId(selectId);
    } catch {
      // Endpoint unavailable (e.g. not migrated yet) — behave as "no profiles".
      setServer({ can_manage: false, profiles: [], roles: [] });
    }
  }

  useEffect(() => {
    let cancelled = false;
    listColumnProfiles(storageKey)
      .then((res) => !cancelled && setServer(res))
      .catch(() => !cancelled && setServer({ can_manage: false, profiles: [], roles: [] }));
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const canManage = !!server?.can_manage;
  const profiles = useMemo(() => server?.profiles ?? [], [server]);
  // A manager may explicitly pick "no profile" (activeId 0); everyone else always falls back
  // to their first available profile.
  const activeProfile: ColumnProfile | null =
    (activeId ? profiles.find((p) => p.id === activeId) : undefined) ?? (canManage && activeId === 0 ? null : profiles[0] ?? null);

  const allIds = useMemo(() => columns.map((c) => c.id), [columns]);
  const byId = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);

  const layout = useMemo(() => {
    void version;
    if (activeProfile) {
      // Profile columns the user's field access still allows, in the profile's default order.
      const profileIds = activeProfile.columns.filter((id) => byId.has(id));
      const defaultGroups = filterGroups(activeProfile.group_of, profileIds);
      if (canManage) {
        // Managers edit the profile itself, so they always see its saved default — plus every
        // other allowed column (unticked) available to add.
        const order = [...profileIds, ...allIds.filter((id) => !profileIds.includes(id))];
        return {
          order,
          groupOf: defaultGroups,
          visible: Object.fromEntries(allIds.map((id) => [id, profileIds.includes(id)])),
        };
      }
      const key = `${STORAGE_PREFIX}${storageKey}:p${activeProfile.id}`;
      const savedGroups = readJson<Record<string, string>>(key + GROUP_SUFFIX);
      return {
        order: mergeOrder(readJson<string[]>(key + ORDER_SUFFIX), profileIds),
        groupOf: savedGroups ? filterGroups(savedGroups, profileIds) : defaultGroups,
        visible: Object.fromEntries(profileIds.map((id) => [id, true])),
      };
    }
    const key = STORAGE_PREFIX + storageKey;
    const savedVisible = canManage ? readJson<Record<string, boolean>>(key) : null;
    return {
      order: mergeOrder(readJson<string[]>(key + ORDER_SUFFIX), allIds),
      groupOf: filterGroups(readJson<Record<string, string>>(key + GROUP_SUFFIX), allIds),
      visible: Object.fromEntries(allIds.map((id) => [id, savedVisible?.[id] ?? true])),
    };
  }, [activeProfile, canManage, storageKey, allIds, byId, version]);

  function isVisible(id: string) {
    return layout.visible[id] ?? false;
  }

  // Everything the modal lists: the profile's own columns for a regular user (nothing to add or
  // remove), every allowed column for a manager / the no-profile fallback.
  const orderedColumns = layout.order
    .filter((id) => canManage || !activeProfile || layout.visible[id])
    .map((id) => byId.get(id))
    .filter((c): c is T => !!c);

  const columnSlots = buildSlots(layout.order, layout.groupOf, byId, isVisible);

  /** Personal arrangement (regular users) / personal show-hide (managers with no profile). */
  function save(nextVisible: Record<string, boolean>, nextOrder: string[], nextGroupOf: Record<string, string>) {
    if (activeProfile) {
      const key = `${STORAGE_PREFIX}${storageKey}:p${activeProfile.id}`;
      writeJson(key + ORDER_SUFFIX, nextOrder);
      writeJson(key + GROUP_SUFFIX, nextGroupOf);
    } else {
      const key = STORAGE_PREFIX + storageKey;
      if (canManage) writeJson(key, nextVisible);
      writeJson(key + ORDER_SUFFIX, nextOrder);
      writeJson(key + GROUP_SUFFIX, nextGroupOf);
    }
    setVersion((v) => v + 1);
    setIsOpen(false);
  }

  /** Drops the user's own arrangement for the current profile, back to its default. */
  function resetLayout() {
    const key = activeProfile ? `${STORAGE_PREFIX}${storageKey}:p${activeProfile.id}` : STORAGE_PREFIX + storageKey;
    removeKeys(key + ORDER_SUFFIX, key + GROUP_SUFFIX);
    setVersion((v) => v + 1);
    setIsOpen(false);
  }

  function selectProfile(id: number | null) {
    setActiveId(id ?? 0);
    writeJson(STORAGE_PREFIX + storageKey + PROFILE_SUFFIX, id ?? 0);
  }

  /** Managers only — `asNew` saves a copy instead of overwriting the active profile. */
  async function saveProfile(meta: ProfileMeta, nextVisible: Record<string, boolean>, nextOrder: string[], nextGroupOf: Record<string, string>, asNew: boolean) {
    const cols = nextOrder.filter((id) => nextVisible[id]);
    const payload = { name: meta.name, role_ids: meta.role_ids, columns: cols, group_of: filterGroups(nextGroupOf, cols) };
    const saved =
      activeProfile && !asNew
        ? await updateColumnProfile(activeProfile.id, payload)
        : await createColumnProfile({ ...payload, page_key: storageKey });
    selectProfile(saved.id);
    await reload(saved.id);
    setIsOpen(false);
  }

  async function deleteProfile() {
    if (!activeProfile) return;
    await deleteColumnProfile(activeProfile.id);
    selectProfile(null);
    await reload(0);
    setIsOpen(false);
  }

  return {
    columns,
    orderedColumns,
    columnSlots,
    groupOf: layout.groupOf,
    visible: layout.visible,
    isVisible,
    isOpen,
    openModal: () => setIsOpen(true),
    closeModal: () => setIsOpen(false),
    save,
    resetLayout,
    // Column Profiles
    loaded: server !== null,
    canManage,
    profiles,
    roles: server?.roles ?? [],
    activeProfile,
    selectProfile,
    saveProfile,
    deleteProfile,
  };
}

export type ManageColumnsState = ReturnType<typeof useManageColumns<ColumnDef>>;
