"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, History, Search } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import { listAuditLogs, type AuditLog, type AuditLogFilters } from "@/lib/auditLogs";

const EVENT_LABEL: Record<string, string> = {
  created: "สร้าง",
  updated: "แก้ไข",
  deleted: "ลบ",
  roles_changed: "เปลี่ยน Role",
  branches_changed: "เปลี่ยนสาขา",
  lines_changed: "แก้ไขรายการเอกสาร",
  document_viewed: "เปิดเอกสาร",
  printed: "พิมพ์",
  exported: "Export",
  login: "เข้าสู่ระบบ",
  login_failed: "เข้าสู่ระบบไม่สำเร็จ",
  logout: "ออกจากระบบ",
};

const EVENT_STYLE: Record<string, string> = {
  created: "bg-emerald-50 text-emerald-700",
  updated: "bg-sky-50 text-sky-700",
  deleted: "bg-red-50 text-red-600",
  login_failed: "bg-red-50 text-red-600",
  login: "bg-slate-100 text-slate-600",
  logout: "bg-slate-100 text-slate-600",
  document_viewed: "bg-slate-100 text-slate-600",
  printed: "bg-slate-100 text-slate-600",
  exported: "bg-slate-100 text-slate-600",
};

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [applied, setApplied] = useState<AuditLogFilters>({});
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [subjectTypes, setSubjectTypes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State is only set from the request callbacks (never synchronously in the effect body);
  // `loading` is switched on by whatever changes the query (see goTo / the search form).
  useEffect(() => {
    let cancelled = false;
    listAuditLogs({ ...applied, page })
      .then((res) => {
        if (cancelled) return;
        setLogs(res.data);
        setSubjectTypes(res.subject_types);
        setLastPage(res.last_page);
        setTotal(res.total);
        setError("");
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [applied, page]);

  const goTo = useCallback((nextPage: number) => {
    setLoading(true);
    setPage(nextPage);
  }, []);

  return (
    <div className="relative min-h-[360px]">
      <PageHeader title="Audit Log" description="ประวัติการเปลี่ยนแปลง — ใครแก้ไขอะไร เมื่อไร (Role/สิทธิ์, ผู้ใช้, ราคา, บัญชี Carrier, Shipment, ใบเสร็จ, Pickup)" />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          setPage(1);
          setApplied({ ...filters });
        }}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ประเภทข้อมูล</span>
          <select value={filters.subject_type ?? ""} onChange={(e) => setFilters({ ...filters, subject_type: e.target.value })} className={`${inputClass} w-48`}>
            <option value="">ทั้งหมด</option>
            {subjectTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">การกระทำ</span>
          <select value={filters.event ?? ""} onChange={(e) => setFilters({ ...filters, event: e.target.value })} className={`${inputClass} w-40`}>
            <option value="">ทั้งหมด</option>
            {Object.entries(EVENT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ชื่อ / เลข</span>
          <input value={filters.search ?? ""} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="เช่น Staff, 5437..." className={`${inputClass} w-48`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ตั้งแต่</span>
          <input type="date" value={filters.date_from ?? ""} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ถึง</span>
          <input type="date" value={filters.date_to ?? ""} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className={inputClass} />
        </label>
        <button type="submit" className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90">
          <Search className="h-4 w-4" />
          ค้นหา
        </button>
      </form>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading && logs.length === 0 ? (
        <PageLoading label="Loading Audit Log..." />
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <History className="h-10 w-10 text-brand-amber" />
          <p className="font-medium text-slate-600">ยังไม่มีประวัติการเปลี่ยนแปลง</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
              <tr>
                <th className="px-4 py-2.5 font-medium">เวลา</th>
                <th className="px-4 py-2.5 font-medium">ผู้ใช้</th>
                <th className="px-4 py-2.5 font-medium">การกระทำ</th>
                <th className="px-4 py-2.5 font-medium">ข้อมูล</th>
                <th className="px-4 py-2.5 font-medium">ฟิลด์ที่เปลี่ยน</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const fields = Object.keys(log.changes ?? {});
                const isOpen = expanded === log.id;
                return (
                  <Fragment key={log.id}>
                    <tr className="border-b border-slate-100 align-top">
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {log.user?.name ?? (log.event === "login_failed" ? "—" : <span className="text-slate-400">System</span>)}
                        {log.ip && <div className="text-xs text-slate-400">{log.ip}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${EVENT_STYLE[log.event] ?? "bg-amber-50 text-amber-700"}`}>
                          {EVENT_LABEL[log.event] ?? log.event}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">
                        <span className="text-xs text-slate-400">{log.subject_type}</span>
                        <div className="font-medium">{log.subject_label ?? `#${log.subject_id}`}</div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {fields.length === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <button type="button" onClick={() => setExpanded(isOpen ? null : log.id)} className="flex items-center gap-1 text-left text-sm text-brand-navy hover:underline">
                            {fields.slice(0, 3).join(", ")}
                            {fields.length > 3 && ` & อีก ${fields.length - 3}`}
                            <ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <td colSpan={5} className="px-4 py-3">
                          <table className="w-full text-xs">
                            <thead className="text-slate-400">
                              <tr>
                                <th className="w-48 pb-1 text-left font-medium">ฟิลด์</th>
                                <th className="pb-1 text-left font-medium">ก่อน</th>
                                <th className="pb-1 text-left font-medium">หลัง</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fields.map((field) => (
                                <tr key={field} className="align-top">
                                  <td className="py-1 pr-3 font-mono text-slate-600">{field}</td>
                                  <td className="max-w-md break-all py-1 pr-3 text-red-600">{formatValue(log.changes![field].old)}</td>
                                  <td className="max-w-md break-all py-1 text-emerald-700">{formatValue(log.changes![field].new)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>ทั้งหมด {total.toLocaleString()} รายการ</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => goTo(page - 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
                ก่อนหน้า
              </button>
              <span>
                {page} / {lastPage}
              </span>
              <button type="button" disabled={page >= lastPage} onClick={() => goTo(page + 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
