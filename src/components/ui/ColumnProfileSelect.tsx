"use client";

import { LayoutTemplate } from "lucide-react";
import type { useManageColumns } from "@/hooks/useManageColumns";

type Mgr = Pick<ReturnType<typeof useManageColumns>, "loaded" | "canManage" | "profiles" | "activeProfile" | "selectProfile">;

/**
 * Column Profile switcher shown next to "Manage Columns". Regular users only see it when more
 * than one profile is available to their Roles; managers always see it (plus "no profile").
 */
export default function ColumnProfileSelect({ mgr }: { mgr: Mgr }) {
  if (!mgr.loaded || (!mgr.canManage && mgr.profiles.length < 2)) return null;

  return (
    <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-2.5 py-1 text-sm text-slate-600">
      <LayoutTemplate className="h-4 w-4 text-slate-400" />
      <select
        value={mgr.activeProfile?.id ?? 0}
        onChange={(e) => mgr.selectProfile(Number(e.target.value) || null)}
        className="bg-transparent py-0.5 text-sm font-medium outline-none"
        aria-label="Column Profile"
      >
        {mgr.profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        {mgr.canManage && <option value={0}>— ไม่ใช้ Profile (ทุกคอลัมน์) —</option>}
      </select>
    </label>
  );
}
