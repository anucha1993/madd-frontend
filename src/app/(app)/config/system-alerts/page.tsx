"use client";

import { Fragment, useEffect, useState } from "react";
import { BellRing, CheckCheck, ChevronDown } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import {
  listSystemAlerts,
  resolveAllSystemAlerts,
  resolveSystemAlert,
  SYSTEM_ALERTS_CHANGED,
  type SystemAlert,
  type SystemAlertFilters,
} from "@/lib/systemAlerts";

const SOURCE_LABEL: Record<string, string> = {
  exception: "Error ระบบ",
  tracking_sync: "Tracking Sync",
  pickup_cancel: "ยกเลิก Pickup",
  pickup_overdue_mail: "อีเมล Pickup เลยเวลา",
};

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";

export default function SystemAlertsPage() {
  const [filters, setFilters] = useState<SystemAlertFilters>({ status: "open" });
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // State is only set from the request callbacks; `loading` is switched on by whatever changes
  // the query (see update()).
  useEffect(() => {
    let cancelled = false;
    listSystemAlerts({ ...filters, page })
      .then((res) => {
        if (cancelled) return;
        setAlerts(res.data);
        setSources(res.sources);
        setLastPage(res.last_page);
        setTotal(res.total);
        setError("");
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, page, reload]);

  function update(next: SystemAlertFilters, nextPage = 1) {
    setLoading(true);
    setFilters(next);
    setPage(nextPage);
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      window.dispatchEvent(new Event(SYSTEM_ALERTS_CHANGED));
      setLoading(true);
      setReload((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-[360px]">
      <PageHeader
        title="System Alerts"
        description="รายการที่ระบบทำงานพลาดเบื้องหลัง — อัปโหลดเอกสารไม่สำเร็จ, Tracking Sync ผิดพลาด, ยกเลิก Pickup อัตโนมัติไม่สำเร็จ, Error 500 ฯลฯ ตรวจสอบแล้วกด “แก้ไขแล้ว”"
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">สถานะ</span>
          <select value={filters.status ?? "open"} onChange={(e) => update({ ...filters, status: e.target.value as SystemAlertFilters["status"] })} className={`${inputClass} w-40`}>
            <option value="open">ยังไม่แก้ไข</option>
            <option value="resolved">แก้ไขแล้ว</option>
            <option value="all">ทั้งหมด</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ประเภท</span>
          <select value={filters.source ?? ""} onChange={(e) => update({ ...filters, source: e.target.value })} className={`${inputClass} w-52`}>
            <option value="">ทั้งหมด</option>
            {sources.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s] ?? s}
              </option>
            ))}
          </select>
        </label>
        {filters.status !== "resolved" && total > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => window.confirm("ทำเครื่องหมาย “แก้ไขแล้ว” ทุกรายการที่ยังเปิดอยู่?") && run(resolveAllSystemAlerts)}
            className="ml-auto flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            แก้ไขแล้วทั้งหมด
          </button>
        )}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading && alerts.length === 0 ? (
        <PageLoading label="Loading System Alerts..." />
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <BellRing className="h-10 w-10 text-brand-amber" />
          <p className="font-medium text-slate-600">ไม่มีรายการแจ้งเตือน</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
              <tr>
                <th className="px-4 py-2.5 font-medium">ล่าสุด</th>
                <th className="px-4 py-2.5 font-medium">ประเภท</th>
                <th className="px-4 py-2.5 font-medium">รายละเอียด</th>
                <th className="px-4 py-2.5 text-right font-medium">จำนวนครั้ง</th>
                <th className="px-4 py-2.5 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => {
                const isOpen = expanded === alert.id;
                return (
                  <Fragment key={alert.id}>
                    <tr className="border-b border-slate-100 align-top">
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                        {new Date(alert.last_seen_at).toLocaleString()}
                        {alert.occurrences > 1 && <div className="text-xs text-slate-400">ครั้งแรก {new Date(alert.first_seen_at).toLocaleString()}</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${alert.level === "warning" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>
                          {SOURCE_LABEL[alert.source] ?? alert.source}
                        </span>
                      </td>
                      <td className="max-w-xl px-4 py-2.5 text-slate-700">
                        <div className="break-words">{alert.message}</div>
                        {alert.context && (
                          <button type="button" onClick={() => setExpanded(isOpen ? null : alert.id)} className="mt-1 flex items-center gap-1 text-xs text-brand-navy hover:underline">
                            ข้อมูลเพิ่มเติม
                            <ChevronDown className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`} />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{alert.occurrences.toLocaleString()}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {alert.resolved_at ? (
                          <span className="text-xs text-emerald-700">
                            แก้ไขแล้ว
                            <div className="text-slate-400">
                              {alert.resolved_by?.name ?? "—"} · {new Date(alert.resolved_at).toLocaleString()}
                            </div>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => run(() => resolveSystemAlert(alert.id))}
                            className="rounded-lg border border-emerald-300 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            แก้ไขแล้ว
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && alert.context && (
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <td colSpan={5} className="px-4 py-3">
                          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-600">{JSON.stringify(alert.context, null, 2)}</pre>
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
              <button type="button" disabled={page <= 1} onClick={() => update(filters, page - 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
                ก่อนหน้า
              </button>
              <span>
                {page} / {lastPage}
              </span>
              <button type="button" disabled={page >= lastPage} onClick={() => update(filters, page + 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
