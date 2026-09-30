"use client";

import { useMemo, useState, type DragEvent } from "react";
import { GripVertical, Link2Off, Search } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type { ColumnDef, ProfileMeta } from "@/hooks/useManageColumns";
import type { ColumnProfile } from "@/lib/columnProfiles";

type Props = {
  // Passed in already in the page's current display order (columnsMgr.orderedColumns).
  columns: ColumnDef[];
  visible: Record<string, boolean>;
  // Column id -> group key; ids sharing the same key stack into one combined column.
  groupOf: Record<string, string>;
  onCancel: () => void;
  onSave: (visible: Record<string, boolean>, order: string[], groupOf: Record<string, string>) => void;
  // Regular users: columns come from an admin-defined profile — no show/hide ticks, only
  // re-arranging (order / stacking) is allowed.
  lockVisibility?: boolean;
  // Drops the user's own arrangement back to the profile default.
  onReset?: () => void;
  // Present only for `config.column_profiles` holders: the tick list then defines the profile.
  profileEditor?: {
    profile: ColumnProfile | null;
    roles: { id: number; name: string }[];
    onSaveProfile: (
      meta: ProfileMeta,
      visible: Record<string, boolean>,
      order: string[],
      groupOf: Record<string, string>,
      asNew: boolean,
    ) => Promise<void>;
    onDeleteProfile: () => Promise<void>;
  };
};

// Cycled by each group's position so multiple combined columns get visually distinct tints.
const GROUP_STYLES = [
  "border-sky-300 bg-sky-50",
  "border-emerald-300 bg-emerald-50",
  "border-amber-300 bg-amber-50",
  "border-violet-300 bg-violet-50",
  "border-rose-300 bg-rose-50",
];

type DropZone = "before" | "after" | "merge";

export default function ManageColumnsModal({ columns, visible, groupOf, onCancel, onSave, lockVisibility, onReset, profileEditor }: Props) {
  const [draft, setDraft] = useState<Record<string, boolean>>(visible);
  const [order, setOrder] = useState<string[]>(() => columns.map((c) => c.id));
  const [groups, setGroups] = useState<Record<string, string>>(groupOf);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; zone: DropZone } | null>(null);
  const [query, setQuery] = useState("");

  const editingProfile = profileEditor?.profile ?? null;
  const [profileName, setProfileName] = useState(editingProfile?.name ?? "");
  const [profileRoleIds, setProfileRoleIds] = useState<number[]>(editingProfile?.role_ids ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const byId = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const ordered = useMemo(() => order.map((id) => byId.get(id)).filter((c): c is ColumnDef => !!c), [order, byId]);
  const isSearching = query.trim().length > 0;
  const filtered = useMemo(
    () => ordered.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase())),
    [ordered, query]
  );
  const groupIds = useMemo(() => Array.from(new Set(Object.values(groups))), [groups]);

  // Nests combined columns inside one box together so grouping is visually obvious (matches how
  // they'll actually render as a single stacked column on the page). While searching, groups are
  // flattened back into plain single-item rows since only a filtered subset is shown.
  const rows = useMemo(() => {
    if (isSearching) return filtered.map((c) => [c]);
    const seen = new Set<string>();
    const result: ColumnDef[][] = [];
    for (const id of order) {
      if (seen.has(id)) continue;
      const groupId = groups[id];
      const memberIds = groupId ? order.filter((oid) => groups[oid] === groupId) : [id];
      memberIds.forEach((m) => seen.add(m));
      const members = memberIds.map((m) => byId.get(m)).filter((c): c is ColumnDef => !!c);
      if (members.length > 0) result.push(members);
    }
    return result;
  }, [isSearching, filtered, order, groups, byId]);

  function toggle(id: string) {
    setDraft((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));
  }

  function groupStyle(groupId: string) {
    const idx = groupIds.indexOf(groupId) % GROUP_STYLES.length;
    return GROUP_STYLES[idx < 0 ? 0 : idx];
  }

  // Reordering/merging is disabled while searching — the visible rows are only a filtered
  // subset, so a drag position wouldn't map cleanly onto the full column order.
  function handleDragOver(e: DragEvent<HTMLDivElement>, targetId: string) {
    if (isSearching || !dragId || dragId === targetId) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientY - rect.top) / rect.height;
    const zone: DropZone = ratio < 0.3 ? "before" : ratio > 0.7 ? "after" : "merge";
    setDropTarget({ id: targetId, zone });
  }

  function ungroup(id: string) {
    setGroups((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId || isSearching) return;
    const zone = dropTarget?.zone ?? "after";
    if (zone === "merge") {
      const groupId = groups[targetId] ?? `group-${targetId}`;
      setGroups((prev) => ({ ...prev, [targetId]: groupId, [dragId]: groupId }));
      // Keep newly-combined columns adjacent in the list so the grouping reads clearly.
      setOrder((prev) => {
        const next = prev.filter((id) => id !== dragId);
        next.splice(next.indexOf(targetId) + 1, 0, dragId);
        return next;
      });
    } else {
      setOrder((prev) => {
        const next = prev.filter((id) => id !== dragId);
        const idx = next.indexOf(targetId);
        next.splice(zone === "before" ? idx : idx + 1, 0, dragId);
        return next;
      });
      // Reordering two members that already share a group (e.g. swapping the stacking order
      // inside a combined column) should NOT split them apart — only ungroup when the drop
      // target belongs to a different group (or none).
      if (groups[targetId] !== groups[dragId] || !groups[dragId]) {
        ungroup(dragId);
      }
    }
    setDragId(null);
    setDropTarget(null);
  }

  async function saveProfile(asNew: boolean) {
    if (!profileEditor) return;
    if (!profileName.trim()) {
      setError("กรุณาตั้งชื่อ Profile");
      return;
    }
    if (!order.some((id) => draft[id] ?? true)) {
      setError("ต้องเลือกอย่างน้อย 1 คอลัมน์");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await profileEditor.onSaveProfile({ name: profileName.trim(), role_ids: profileRoleIds }, draft, order, groups, asNew);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
      setBusy(false);
    }
  }

  async function removeProfile() {
    if (!profileEditor || !editingProfile) return;
    if (!confirm(`ยืนยันลบ Profile "${editingProfile.name}" ?`)) return;
    setBusy(true);
    try {
      await profileEditor.onDeleteProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
      setBusy(false);
    }
  }

  const title = profileEditor
    ? editingProfile
      ? `Column Profile: ${editingProfile.name}`
      : "Manage Columns (ไม่ใช้ Profile)"
    : "Manage Columns";

  return (
    <Modal title={title} onClose={onCancel}>
      {profileEditor && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">
              {editingProfile ? "ชื่อ Profile" : "ชื่อ Profile (สำหรับสร้างใหม่จากการจัดด้านล่าง)"}
            </span>
            <input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="เช่น หน้าร้าน, บัญชี"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
            />
          </label>
          <div>
            <span className="text-xs font-medium text-slate-600">ใช้ได้กับ Role (ไม่เลือก = ทุก Role)</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {profileEditor.roles.map((role) => {
                const on = profileRoleIds.includes(role.id);
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setProfileRoleIds((prev) => (on ? prev.filter((id) => id !== role.id) : [...prev, role.id]))}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
                      on ? "border-brand-navy bg-brand-navy text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {role.name}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            ติ๊ก = คอลัมน์ที่อยู่ใน Profile · ลำดับที่จัดตรงนี้เป็นค่าเริ่มต้น — ผู้ใช้ทั่วไปเลื่อนลำดับเองได้ แต่เพิ่ม/ลบคอลัมน์ไม่ได้
          </p>
        </div>
      )}
      {lockVisibility && (
        <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          คอลัมน์ที่แสดงกำหนดโดยผู้ดูแลระบบ — คุณจัดเรียงลำดับ / รวมคอลัมน์ได้ตามต้องการ
        </p>
      )}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 focus-within:border-brand-navy focus-within:ring-2 focus-within:ring-brand-navy/15">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="w-full text-sm outline-none"
        />
      </div>
      <p className="mb-2 text-xs text-slate-400">
        Drag a column onto the middle of another to combine them (stacked in one column).
      </p>
      <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">No matching columns</p>
        ) : (
          rows.map((members) => {
            const groupId = members.length > 1 ? groups[members[0].id] : undefined;
            return (
              <div
                key={members.map((m) => m.id).join("+")}
                className={`flex flex-col gap-0.5 rounded-lg border p-1 ${
                  groupId ? groupStyle(groupId) : "border-transparent"
                }`}
              >
                {members.map((c) => {
                  const isMergeTarget = dropTarget?.id === c.id && dropTarget.zone === "merge";
                  return (
                    <div
                      key={c.id}
                      draggable={!isSearching}
                      onDragStart={() => setDragId(c.id)}
                      onDragOver={(e) => handleDragOver(e, c.id)}
                      onDragLeave={() => setDropTarget((prev) => (prev?.id === c.id ? null : prev))}
                      onDrop={() => handleDrop(c.id)}
                      onDragEnd={() => {
                        setDragId(null);
                        setDropTarget(null);
                      }}
                      className={`relative flex items-center gap-2 rounded px-1.5 py-1 text-sm text-slate-700 ${
                        dragId === c.id ? "opacity-40" : ""
                      } ${isMergeTarget ? "ring-2 ring-brand-navy" : ""}`}
                    >
                      {dropTarget?.id === c.id && dropTarget.zone === "before" && (
                        <div className="absolute inset-x-1.5 -top-0.5 h-0.5 rounded bg-brand-navy" />
                      )}
                      {dropTarget?.id === c.id && dropTarget.zone === "after" && (
                        <div className="absolute inset-x-1.5 -bottom-0.5 h-0.5 rounded bg-brand-navy" />
                      )}
                      <GripVertical
                        className={`h-4 w-4 shrink-0 ${isSearching ? "text-slate-200" : "cursor-grab text-slate-400"}`}
                      />
                      <label className="flex flex-1 items-center gap-2">
                        {!lockVisibility && (
                          <input
                            type="checkbox"
                            checked={draft[c.id] ?? true}
                            onChange={() => toggle(c.id)}
                            className="h-4 w-4 rounded border-slate-300 text-brand-navy-dark focus:ring-brand-navy/30"
                          />
                        )}
                        {c.label}
                      </label>
                      {groupId && (
                        <button
                          type="button"
                          onClick={() => ungroup(c.id)}
                          className="rounded p-1 text-slate-400 hover:bg-white hover:text-red-500"
                          title="Remove from combined column"
                        >
                          <Link2Off className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {groupId && (
                  <p className="px-1.5 pb-0.5 text-[11px] text-slate-400">
                    Shown as one column: {members.map((m) => m.label).join(" / ")}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <div className="flex gap-2">
          {profileEditor && editingProfile && (
            <button
              type="button"
              onClick={removeProfile}
              disabled={busy}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              ลบ Profile
            </button>
          )}
          {!profileEditor && onReset && (
            <button type="button" onClick={onReset} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50">
              คืนค่าเริ่มต้น
            </button>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          {profileEditor ? (
            <>
              {editingProfile ? (
                <button
                  type="button"
                  onClick={() => saveProfile(true)}
                  disabled={busy}
                  className="rounded-lg border border-brand-navy px-4 py-2 text-sm font-medium text-brand-navy hover:bg-brand-navy/5 disabled:opacity-50"
                >
                  บันทึกเป็น Profile ใหม่
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSave(draft, order, groups)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  ใช้เฉพาะฉัน
                </button>
              )}
              <button
                type="button"
                onClick={() => saveProfile(!editingProfile)}
                disabled={busy}
                className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-50"
              >
                {busy ? "กำลังบันทึก..." : editingProfile ? "บันทึก Profile" : "สร้าง Profile"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onSave(draft, order, groups)}
              className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
            >
              Save
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
