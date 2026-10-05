"use client";

import { useState, type FormEvent } from "react";
import type { Branch } from "@/lib/branches";
import { branchLabel } from "@/lib/branches";
import type { AppUser, AppUserInput } from "@/lib/users";
import type { Role } from "@/lib/roles";

type Props = {
  branches: Branch[];
  roles: Role[];
  initial?: AppUser | null;
  onSubmit: (data: AppUserInput) => Promise<void>;
  onCancel: () => void;
};

export default function UserForm({ branches, roles, initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [roleIds, setRoleIds] = useState<number[]>(
    initial?.roles.map((r) => r.id) ?? roles.filter((r) => r.key === "staff").map((r) => r.id),
  );
  const [canAccessAll, setCanAccessAll] = useState(initial?.can_access_all_branches ?? false);
  const [branchIds, setBranchIds] = useState<number[]>(initial?.branches.map((b) => b.id) ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleRole(id: number) {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  function toggleBranch(id: number) {
    setBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !username.trim() || !email.trim()) {
      setError("กรุณากรอกชื่อ, ชื่อผู้ใช้ และอีเมลให้ครบ");
      return;
    }
    if (!initial && !password.trim()) {
      setError("กรุณากำหนดรหัสผ่าน");
      return;
    }
    if (roleIds.length === 0) {
      setError("กรุณาเลือกอย่างน้อย 1 Role");
      return;
    }
    if (!canAccessAll && branchIds.length === 0) {
      setError("กรุณาเลือกอย่างน้อย 1 สาขา หรือเปิด \"เข้าถึงได้ทุกสาขา\"");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        password: password.trim() || undefined,
        role_ids: roleIds,
        can_access_all_branches: canAccessAll,
        branch_ids: branchIds,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
  const labelClass = "text-sm font-medium text-slate-600";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>ชื่อ-นามสกุล</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>ชื่อผู้ใช้ (username)</span>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>อีเมล</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>รหัสผ่าน</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={initial ? "•••••••• (เว้นว่างไว้เพื่อไม่เปลี่ยนแปลง)" : ""}
          className={inputClass}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Role (เลือกได้หลาย Role — สิทธิ์จะรวมกัน)</span>
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
          {roles.map((r) => (
            <label key={r.id} className="flex items-start gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={roleIds.includes(r.id)}
                onChange={() => toggleRole(r.id)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-amber"
              />
              <span>
                <span className="font-medium text-slate-700">{r.name}</span>
                {r.description && <span className="block text-xs text-slate-400">{r.description}</span>}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={canAccessAll}
            onChange={(e) => setCanAccessAll(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
          />
          เข้าถึงได้ทุกสาขา
        </label>

        {!canAccessAll && (
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            {branches.length === 0 ? (
              <p className="col-span-2 text-sm text-slate-400">ยังไม่มีสาขาในระบบ</p>
            ) : (
              branches.map((branch) => (
                <label key={branch.id} className="flex min-w-0 items-center gap-2 text-sm text-slate-600" title={branchLabel(branch)}>
                  <input
                    type="checkbox"
                    checked={branchIds.includes(branch.id)}
                    onChange={() => toggleBranch(branch.id)}
                    className="h-4 w-4 shrink-0 rounded border-slate-300 accent-brand-amber"
                  />
                  {/* Branch names are often all the same company name — the nickname (fallback: code) is what tells them apart. */}
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700">
                    {branch.nickname || branch.code}
                  </span>
                  <span className="min-w-0 truncate">{branch.name}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy-dark/90 disabled:opacity-60"
        >
          {submitting ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </form>
  );
}
