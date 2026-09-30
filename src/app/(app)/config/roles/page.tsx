"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Crown, Plus, ShieldCheck, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import { useAccess } from "@/components/auth/AccessProvider";
import type { DataScope, FieldLevel } from "@/lib/access";
import {
  createRole,
  deleteRole,
  getPermissionRegistry,
  listRoles,
  updateRole,
  type PermissionRegistry,
  type RegistryModule,
  type Role,
  type RoleInput,
} from "@/lib/roles";

type Draft = RoleInput & { id?: number; is_system?: boolean; users_count?: number };

// One tickable item inside a permission row's picker — either an action permission
// ("shipment.void") or a view/hide field group ("rate.markup").
type PickerItem = { id: string; label: string; hint?: string; checked: boolean };

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15 disabled:opacity-60";

// A module with ONLY view/hide field groups and no actions (e.g. Rate Quote) is shown as a
// normal permission row — ticked = "ดูได้", unticked = "ซ่อน".
function isTickableFieldModule(def: RegistryModule): boolean {
  const groups = Object.values(def.fields ?? {});
  return !Object.keys(def.actions ?? {}).length && groups.length > 0 && groups.every((g) => !g.inputs);
}

function toDraft(role: Role): Draft {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    is_super_admin: role.is_super_admin,
    is_system: role.is_system,
    users_count: role.users_count,
    permissions: [...role.permissions],
    field_access: JSON.parse(JSON.stringify(role.field_access ?? {})),
    data_scopes: { ...(role.data_scopes ?? {}) },
  };
}

function emptyDraft(registry: PermissionRegistry): Draft {
  const field_access: Draft["field_access"] = {};
  const data_scopes: Draft["data_scopes"] = {};
  for (const [module, def] of Object.entries(registry.modules)) {
    for (const [group, g] of Object.entries(def.fields ?? {})) {
      field_access[module] = { ...(field_access[module] ?? {}), [group]: g.default ?? "hidden" };
    }
    if (def.scope) data_scopes[module] = "branch";
  }
  return { key: "", name: "", description: "", is_super_admin: false, permissions: [], field_access, data_scopes };
}

/** "ดู, จอง, Void & 2 more" — like the summary next to each toggle. */
function summarize(items: PickerItem[]): ReactNode {
  const on = items.filter((i) => i.checked);
  if (on.length === 0) return <span className="text-slate-400">ไม่มีสิทธิ์</span>;
  const shown = on.slice(0, 3).map((i) => i.label).join(", ");
  return (
    <>
      {shown}
      {on.length > 3 && <span className="font-semibold"> & อีก {on.length - 3}</span>}
    </>
  );
}

function Toggle({ on, partial, disabled, onChange }: { on: boolean; partial?: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? (partial ? "bg-emerald-300" : "bg-emerald-500") : "bg-slate-300"
      }`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${on ? "translate-x-4.5" : "translate-x-0.5"}`} />
    </button>
  );
}

function Section({ title, description, children }: { title: string; description?: string | null; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
      <div className="mt-2 divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 py-2.5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-6">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-700">{label}</div>
        {description && <div className="text-xs text-slate-400">{description}</div>}
      </div>
      <div className="flex min-w-0 items-center gap-4">{children}</div>
    </div>
  );
}

export default function RolesPage() {
  const { can, access } = useAccess();
  const canEdit = can("user.roles");
  const [registry, setRegistry] = useState<PermissionRegistry | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function applyLoaded(reg: PermissionRegistry, list: Role[], selectId?: number) {
    setRegistry(reg);
    setRoles(list);
    const selected = list.find((r) => r.id === selectId) ?? list[0];
    setDraft(selected ? toDraft(selected) : emptyDraft(reg));
    setError("");
  }

  /** Reload after a save/delete, keeping `selectId` selected. */
  async function loadAll(selectId?: number) {
    setLoading(true);
    try {
      const [reg, list] = await Promise.all([getPermissionRegistry(), listRoles()]);
      applyLoaded(reg, list, selectId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  // Initial load — state is only set from the promise callbacks, never synchronously here.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getPermissionRegistry(), listRoles()])
      .then(([reg, list]) => !cancelled && applyLoaded(reg, list))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const totalActions = useMemo(
    () => Object.values(registry?.modules ?? {}).reduce((n, m) => n + Object.keys(m.actions ?? {}).length, 0),
    [registry],
  );

  function update(patch: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setNotice("");
  }

  function selectRole(next: Draft) {
    setDraft(next);
    setOpenPicker(null);
    setNotice("");
    setError("");
  }

  function levelOf(module: string, group: string): FieldLevel {
    return draft?.field_access[module]?.[group] ?? registry?.modules[module]?.fields?.[group]?.default ?? "hidden";
  }

  function setFieldLevels(module: string, levels: Record<string, FieldLevel>) {
    if (!draft) return;
    update({ field_access: { ...draft.field_access, [module]: { ...(draft.field_access[module] ?? {}), ...levels } } });
  }

  /** Picker items for a module row — its actions, or (for Rate Quote) its view/hide field groups. */
  function itemsFor(module: string, def: RegistryModule): PickerItem[] {
    if (isTickableFieldModule(def)) {
      return Object.entries(def.fields!).map(([group, g]) => ({
        id: group,
        label: g.label,
        hint: g.hint,
        checked: levelOf(module, group) !== "hidden",
      }));
    }
    return Object.entries(def.actions ?? {}).map(([action, label]) => ({
      id: `${module}.${action}`,
      label,
      hint: def.action_hints?.[action],
      checked: !!draft?.permissions.includes(`${module}.${action}`),
    }));
  }

  function setItems(module: string, def: RegistryModule, ids: string[], on: boolean) {
    if (!draft) return;
    if (isTickableFieldModule(def)) {
      setFieldLevels(module, Object.fromEntries(ids.map((g) => [g, on ? "view" : "hidden"])) as Record<string, FieldLevel>);
      return;
    }
    const rest = draft.permissions.filter((p) => !ids.includes(p));
    update({ permissions: on ? [...rest, ...ids] : rest });
  }

  async function handleSave() {
    if (!draft) return;
    setError("");
    if (!draft.name.trim() || (!draft.id && !draft.key?.trim())) {
      setError("กรุณากรอกชื่อ Role และรหัส (key)");
      return;
    }
    setSaving(true);
    try {
      const payload: RoleInput = {
        name: draft.name.trim(),
        description: draft.description?.trim() || null,
        is_super_admin: draft.is_super_admin,
        permissions: draft.permissions,
        field_access: draft.field_access,
        data_scopes: draft.data_scopes,
        ...(draft.id ? {} : { key: draft.key?.trim() }),
      };
      const saved = draft.id ? await updateRole(draft.id, payload) : await createRole(payload);
      await loadAll(saved.id);
      setNotice("บันทึกเรียบร้อย — ผู้ใช้ใน Role นี้จะได้สิทธิ์ใหม่เมื่อโหลดหน้าเว็บครั้งถัดไป");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft?.id) return;
    if (!confirm(`ยืนยันลบ Role "${draft.name}" ?`)) return;
    setError("");
    try {
      await deleteRole(draft.id);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    }
  }

  if (loading && !registry) return <PageLoading label="Loading Roles..." />;

  const locked = !canEdit || !!draft?.is_super_admin;
  const superRoleCount = roles.filter((r) => r.is_super_admin).length;
  // Mirrors RoleController::destroy() — explained next to the button instead of failing on click.
  const deleteBlockedReason = !draft?.id
    ? null
    : (draft.users_count ?? 0) > 0
      ? `ยังมีผู้ใช้ ${draft.users_count} คนใน Role นี้ — ย้ายไป Role อื่นก่อน (หน้า Users)`
      : draft.is_super_admin && superRoleCount <= 1
        ? "ต้องมี Role Super Admin อย่างน้อย 1 Role"
        : null;

  const modules = Object.entries(registry?.modules ?? {});
  const fieldModules = modules.filter(([, def]) => def.fields && Object.keys(def.fields).length > 0 && !isTickableFieldModule(def));
  const scopeModules = modules.filter(([, def]) => def.scope);

  /** Shared "label | toggle | summary ⌄" row — the picker body is supplied by the caller. */
  function renderPickerRow(opts: {
    id: string;
    label: string;
    description?: string;
    onCount: number;
    total: number;
    summary: ReactNode;
    onToggle: (on: boolean) => void;
    onSelectAll: (all: boolean) => void;
    wide?: boolean;
    children: ReactNode;
  }) {
    const isOpen = openPicker === opts.id;
    return (
      <Row key={opts.id} label={opts.label} description={opts.description}>
        <Toggle
          on={opts.onCount > 0}
          partial={opts.onCount > 0 && opts.onCount < opts.total}
          disabled={locked}
          onChange={opts.onToggle}
        />
        <div className="relative min-w-0">
          <button
            type="button"
            onClick={() => setOpenPicker(isOpen ? null : opts.id)}
            disabled={locked}
            className="flex max-w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <span className="truncate">{opts.summary}</span>
            {!locked && <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />}
          </button>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenPicker(null)} aria-hidden />
              <div
                className={`absolute left-0 z-20 mt-1 ${opts.wide ? "w-[26rem]" : "w-80"} max-w-[85vw] rounded-xl border border-slate-200 bg-white p-2 shadow-xl`}
              >
                <div className="mb-1 flex items-center justify-between border-b border-slate-100 px-2 pb-2">
                  <span className="text-xs font-semibold text-slate-500">{opts.label}</span>
                  <button
                    type="button"
                    onClick={() => opts.onSelectAll(opts.onCount < opts.total)}
                    className="text-xs font-medium text-brand-navy hover:underline"
                  >
                    {opts.onCount < opts.total ? "เลือกทั้งหมด" : "ล้างทั้งหมด"}
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">{opts.children}</div>
              </div>
            </>
          )}
        </div>
      </Row>
    );
  }

  function renderPermissionRow(module: string, def: RegistryModule) {
    const items = itemsFor(module, def);
    const onCount = items.filter((i) => i.checked).length;
    const setAll = (on: boolean) => setItems(module, def, items.map((i) => i.id), on);
    return renderPickerRow({
      id: module,
      label: def.label,
      description: def.description,
      onCount,
      total: items.length,
      summary: summarize(items),
      onToggle: setAll,
      onSelectAll: setAll,
      children: items.map((item) => (
        <label key={item.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
          <input
            type="checkbox"
            checked={item.checked}
            onChange={(e) => setItems(module, def, [item.id], e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-amber"
          />
          <span className="min-w-0">
            <span className="block text-sm text-slate-700">{item.label}</span>
            {item.hint && <span className="block text-xs text-slate-400">{item.hint}</span>}
          </span>
        </label>
      )),
    });
  }

  /**
   * Field groups of one module: each group has a "เห็น" tick and, for groups with inputs, a
   * "แก้ไขได้" tick (edit implies view; clearing view clears edit). "All on" = every group at
   * its highest level.
   */
  function renderFieldRow(module: string, def: RegistryModule) {
    const groups = Object.entries(def.fields!);
    const maxLevel = (g: (typeof groups)[number][1]): FieldLevel => (g.inputs ? "edit" : "view");
    const visible = groups.filter(([group]) => levelOf(module, group) !== "hidden");
    const editable = groups.filter(([group]) => levelOf(module, group) === "edit");
    const atMax = groups.filter(([group, g]) => levelOf(module, group) === maxLevel(g)).length;
    const setAll = (on: boolean) =>
      setFieldLevels(module, Object.fromEntries(groups.map(([group, g]) => [group, on ? maxLevel(g) : "hidden"])) as Record<string, FieldLevel>);
    const shortLabel = (label: string) => label.replace(/\s*\(.*\)\s*$/, "");

    return renderPickerRow({
      id: `fields:${module}`,
      label: def.label,
      onCount: visible.length,
      total: groups.length,
      summary:
        visible.length === 0 ? (
          <span className="text-slate-400">ซ่อนทั้งหมด</span>
        ) : (
          <>
            เห็น: {visible.slice(0, 3).map(([, g]) => shortLabel(g.label)).join(", ")}
            {visible.length > 3 && <span className="font-semibold"> & อีก {visible.length - 3}</span>}
            {editable.length > 0 && <span className="text-emerald-600"> · แก้ไขได้ {editable.length}</span>}
          </>
        ),
      onToggle: setAll,
      onSelectAll: () => setAll(atMax < groups.length),
      wide: true,
      children: (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_4rem] px-2 pb-1 text-[11px] font-semibold text-slate-400">
            <span>ฟิลด์</span>
            <span className="text-center">เห็น</span>
            <span className="text-center">แก้ไขได้</span>
          </div>
          {groups.map(([group, g]) => {
            const level = levelOf(module, group);
            return (
              <div
                key={group}
                className="grid grid-cols-[minmax(0,1fr)_3.5rem_4rem] items-center rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={g.columns.join(", ")}
              >
                <span className="min-w-0 text-sm text-slate-700">{g.label}</span>
                <span className="flex justify-center">
                  <input
                    type="checkbox"
                    checked={level !== "hidden"}
                    onChange={(e) => setFieldLevels(module, { [group]: e.target.checked ? "view" : "hidden" })}
                    className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
                    aria-label={`เห็น ${g.label}`}
                  />
                </span>
                <span className="flex justify-center">
                  {g.inputs ? (
                    <input
                      type="checkbox"
                      checked={level === "edit"}
                      onChange={(e) => setFieldLevels(module, { [group]: e.target.checked ? "edit" : "view" })}
                      className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
                      aria-label={`แก้ไข ${g.label}`}
                    />
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </span>
              </div>
            );
          })}
        </>
      ),
    });
  }

  return (
    <div className="relative min-h-[360px]">
      <PageHeader
        title="Roles & Permissions"
        description="กำหนดสิทธิ์เมนู/การกระทำ ข้อมูลราคา ฟิลด์ และขอบเขตสาขา ให้แต่ละ Role — ผู้ใช้หนึ่งคนมีได้หลาย Role (สิทธิ์รวมกัน)"
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Role list */}
        <div className="flex flex-col gap-2 lg:sticky lg:top-4 lg:self-start">
          {roles.map((role) => {
            const active = draft?.id === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => selectRole(toDraft(role))}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  active ? "border-brand-amber bg-brand-amber/10" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {role.is_super_admin ? (
                    <Crown className="h-4 w-4 text-brand-amber" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="font-medium text-slate-700">{role.name}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {role.users_count ?? 0} ผู้ใช้ ·{" "}
                  {role.is_super_admin ? "ทุกสิทธิ์" : `${role.permissions.length}/${totalActions} สิทธิ์`}
                </div>
              </button>
            );
          })}
          {canEdit && registry && (
            <button
              type="button"
              onClick={() => selectRole(emptyDraft(registry))}
              className={`flex items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm font-medium transition ${
                draft && !draft.id
                  ? "border-brand-amber bg-brand-amber/10 text-brand-navy-dark"
                  : "border-slate-300 text-slate-500 hover:border-brand-navy hover:text-brand-navy"
              }`}
            >
              <Plus className="h-4 w-4" />
              เพิ่ม Role ใหม่
            </button>
          )}
        </div>

        {/* Editor */}
        {draft && registry && (
          <div className="flex min-w-0 flex-col gap-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">ชื่อ Role</span>
                  <input value={draft.name} onChange={(e) => update({ name: e.target.value })} disabled={!canEdit} className={inputClass} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">รหัส (key)</span>
                  <input
                    value={draft.key ?? ""}
                    onChange={(e) => update({ key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                    disabled={!canEdit || !!draft.id}
                    placeholder="เช่น cashier"
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-600">คำอธิบาย</span>
                  <input
                    value={draft.description ?? ""}
                    onChange={(e) => update({ description: e.target.value })}
                    disabled={!canEdit}
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <Toggle
                  on={!!draft.is_super_admin}
                  disabled={!canEdit || !access.is_super_admin}
                  onChange={(on) => update({ is_super_admin: on })}
                />
                <span className="text-sm text-slate-700">
                  <span className="font-medium">Super Admin</span>
                  <span className="block text-xs text-slate-400">
                    ข้ามการตรวจสิทธิ์ทั้งหมด — ทุกเมนู ทุกฟิลด์ ทุกสาขา (กำหนดได้เฉพาะ Super Admin)
                  </span>
                </span>
              </div>
            </section>

            {draft.is_super_admin ? (
              <p className="flex items-center gap-2 rounded-xl border border-brand-amber/40 bg-brand-amber/10 px-4 py-3 text-sm text-brand-navy-dark">
                <Check className="h-4 w-4" />
                Role นี้เป็น Super Admin — ได้รับทุกสิทธิ์โดยอัตโนมัติ ไม่ต้องตั้งค่ารายละเอียดด้านล่าง
              </p>
            ) : (
              <>
                {Object.entries(registry.categories ?? {}).map(([category, cat]) => {
                  const rows = modules.filter(
                    ([, def]) => def.category === category && (Object.keys(def.actions ?? {}).length > 0 || isTickableFieldModule(def)),
                  );
                  if (rows.length === 0) return null;
                  return (
                    <Section key={category} title={cat.label} description={cat.description}>
                      {rows.map(([module, def]) => renderPermissionRow(module, def))}
                    </Section>
                  );
                })}

                <Section
                  title="สิทธิ์ระดับฟิลด์"
                  description="ไม่ติ๊ก &quot;เห็น&quot; = ฟิลด์ถูกตัดออกจากข้อมูลที่ API ส่งมา (รวมถึงเอกสาร PDF) · &quot;แก้ไขได้&quot; = กรอก/เปลี่ยนค่าตอนสร้างได้"
                >
                  {fieldModules.map(([module, def]) => renderFieldRow(module, def))}
                </Section>

                <Section
                  title="ขอบเขตข้อมูล (มุมมองตามสาขา)"
                  description='"เฉพาะสาขาของตัวเอง" ใช้สาขาที่กำหนดให้ผู้ใช้ในหน้า Users (ผู้ใช้ที่ตั้งเป็น "เข้าถึงได้ทุกสาขา" จะเห็นทุกสาขา) และเห็นรายการที่ตัวเองสร้างเสมอ'
                >
                  {scopeModules.map(([module, def]) => (
                    <Row key={module} label={def.label}>
                      <select
                        value={draft.data_scopes[module] ?? "own"}
                        onChange={(e) => update({ data_scopes: { ...draft.data_scopes, [module]: e.target.value as DataScope } })}
                        disabled={locked}
                        className={`${inputClass} max-w-xs py-1.5`}
                      >
                        {(Object.entries(registry.scopes) as [DataScope, string][]).map(([scope, label]) => (
                          <option key={scope} value={scope}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </Row>
                  ))}
                </Section>
              </>
            )}

            {canEdit && (
              <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                <div className="flex min-w-0 items-center gap-3">
                  {draft.id && (
                    <>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={!!deleteBlockedReason}
                        title={deleteBlockedReason ?? undefined}
                        className="flex shrink-0 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Trash2 className="h-4 w-4" />
                        ลบ Role
                      </button>
                      {deleteBlockedReason && <span className="text-xs text-slate-400">{deleteBlockedReason}</span>}
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-brand-navy-dark px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy-dark/90 disabled:opacity-60"
                >
                  {saving ? "กำลังบันทึก..." : draft.id ? "บันทึกการเปลี่ยนแปลง" : "สร้าง Role"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
