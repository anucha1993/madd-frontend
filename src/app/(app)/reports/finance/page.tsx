"use client";

import { useEffect, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { listBranches, branchLabel, type Branch } from "@/lib/branches";
import { getFinanceReport, type FinanceBucket, type FinanceFilters, type FinanceGroupBy, type FinanceReport } from "@/lib/financeReport";

// Thai calendar day (UTC+7) as YYYY-MM-DD.
const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const monthStart = (date: string, offset = 0) => {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
};
const monthEnd = (date: string) => {
  const d = new Date(`${monthStart(date, 1)}T00:00:00Z`);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
};

const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "เดือนนี้", range: () => [monthStart(today()), today()] },
  { label: "เดือนก่อน", range: () => [monthStart(today(), -1), monthEnd(monthStart(today(), -1))] },
  { label: "3 เดือน", range: () => [monthStart(today(), -2), today()] },
  { label: "ปีนี้", range: () => [`${today().slice(0, 4)}-01-01`, today()] },
];

const GROUPS: { value: FinanceGroupBy; label: string }[] = [
  { value: "month", label: "รายเดือน" },
  { value: "day", label: "รายวัน" },
  { value: "carrier", label: "Carrier" },
  { value: "branch", label: "สาขา" },
  { value: "customer_type", label: "ประเภทลูกค้า" },
];

const money = (n: number | undefined | null) => (n == null ? "-" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const inputClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";

export default function ReportFinancePage() {
  const [filters, setFilters] = useState<FinanceFilters>(() => ({ date_from: monthStart(today()), date_to: today(), group_by: "month" }));
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    listBranches()
      .then(setBranches)
      .catch(() => {}); // no branch.view — the filter just isn't offered
  }, []);

  useEffect(() => {
    let cancelled = false;
    getFinanceReport(filters)
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setError("");
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "โหลดรายงานไม่สำเร็จ"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const update = (patch: Partial<FinanceFilters>) => {
    setLoading(true);
    setFilters((f) => ({ ...f, ...patch }));
  };
  const s = report?.summary;
  const showCost = !!report?.show_cost;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="รายงานรายรับ-รายจ่าย" description="รายรับจากราคาขาย เทียบรายจ่ายตาม Invoice ของ Carrier (ยังไม่มี Invoice ใช้ต้นทุนตอนจองเป็นค่าประมาณ)" />

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          ตั้งแต่
          <input type="date" value={filters.date_from} max={filters.date_to} onChange={(e) => e.target.value && update({ date_from: e.target.value })} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          ถึง
          <input type="date" value={filters.date_to} min={filters.date_from} onChange={(e) => e.target.value && update({ date_to: e.target.value })} className={inputClass} />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                const [date_from, date_to] = p.range();
                update({ date_from, date_to });
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
          Carrier
          <select value={filters.carrier ?? ""} onChange={(e) => update({ carrier: e.target.value || undefined })} className={inputClass}>
            <option value="">ทั้งหมด</option>
            <option value="UPS">UPS</option>
            <option value="DHL">DHL</option>
          </select>
        </label>
        {branches.length > 0 && (
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
            สาขา
            <select value={filters.branch_id ?? ""} onChange={(e) => update({ branch_id: e.target.value ? Number(e.target.value) : null })} className={inputClass}>
              <option value="">ทั้งหมด</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {branchLabel(b)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="ml-auto flex flex-col gap-1 text-xs font-medium text-slate-500">
          แยกตาม
          <select value={filters.group_by} onChange={(e) => update({ group_by: e.target.value as FinanceGroupBy })} className={inputClass}>
            {GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {s && (
        <div className={`grid gap-3 sm:grid-cols-2 ${showCost ? "lg:grid-cols-4" : "lg:grid-cols-2"} ${loading ? "opacity-60" : ""}`}>
          <Card label="Shipment" value={s.shipments.toLocaleString()} />
          <Card label="รายรับ (THB)" value={money(s.revenue)} />
          {showCost && <Card label="รายจ่าย (THB)" value={money(s.expense)} sub={`Invoice ${money(s.cost_invoiced)} · ประมาณ ${money(s.cost_estimated)}`} />}
          {showCost && (
            <Card
              label="กำไรขั้นต้น (THB)"
              value={money(s.profit)}
              sub={s.margin != null ? `Margin ${s.margin.toFixed(1)}%` : undefined}
              tone={(s.profit ?? 0) < 0 ? "bad" : "good"}
            />
          )}
        </div>
      )}

      {s && <Notes s={s} showCost={showCost} />}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">{GROUPS.find((g) => g.value === filters.group_by)?.label}</th>
              <th className="px-4 py-3 text-right font-medium">Shipment</th>
              <th className="px-4 py-3 text-right font-medium">รายรับ</th>
              {showCost && (
                <>
                  <th className="px-4 py-3 text-right font-medium">ตาม Invoice</th>
                  <th className="px-4 py-3 text-right font-medium">ประมาณการ</th>
                  <th className="px-4 py-3 text-right font-medium">รายจ่ายรวม</th>
                  <th className="px-4 py-3 text-right font-medium">กำไร</th>
                  <th className="px-4 py-3 text-right font-medium">Margin</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className={loading ? "opacity-60" : ""}>
            {loading && !report && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            )}
            {report && report.groups.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  ไม่มี Shipment ที่จองแล้วในช่วงนี้
                </td>
              </tr>
            )}
            {report?.groups.map((g) => <Row key={g.key} b={g} showCost={showCost} />)}
            {report && report.groups.length > 1 && <Row b={report.summary} showCost={showCost} total />}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "bad" ? "text-red-600" : tone === "good" ? "text-emerald-600" : "text-slate-800"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function Row({ b, showCost, total }: { b: FinanceBucket; showCost: boolean; total?: boolean }) {
  const cell = "px-4 py-2.5 text-right tabular-nums";
  return (
    <tr className={total ? "border-t-2 border-slate-200 bg-slate-50 font-semibold" : "border-t border-slate-100"}>
      <td className="px-4 py-2.5">{b.label}</td>
      <td className={cell}>{b.shipments.toLocaleString()}</td>
      <td className={cell}>{money(b.revenue)}</td>
      {showCost && (
        <>
          <td className={cell}>{money(b.cost_invoiced)}</td>
          <td className={`${cell} text-slate-500`}>{money(b.cost_estimated)}</td>
          <td className={cell}>{money(b.expense)}</td>
          <td className={`${cell} ${(b.profit ?? 0) < 0 ? "text-red-600" : "text-emerald-700"}`}>{money(b.profit)}</td>
          <td className={cell}>{b.margin != null ? `${b.margin.toFixed(1)}%` : "-"}</td>
        </>
      )}
    </tr>
  );
}

// What the totals rest on — so an estimate is never read as the carrier's real bill.
function Notes({ s, showCost }: { s: FinanceBucket; showCost: boolean }) {
  const notes: string[] = [];
  if (showCost && (s.estimated_count ?? 0) > 0) notes.push(`${s.estimated_count} Shipment ยังไม่มี Invoice จาก Carrier — รายจ่ายเป็นต้นทุนตอนจอง (ประมาณการ)`);
  if (showCost && (s.no_cost_count ?? 0) > 0) notes.push(`${s.no_cost_count} Shipment ไม่มีข้อมูลต้นทุน — ไม่ได้นับรายจ่าย`);
  if (s.other_currency_count > 0) notes.push(`${s.other_currency_count} Shipment ไม่ใช่สกุล THB — ไม่ได้รวมในยอด`);
  notes.push("ไม่รวม Shipment โหมดทดสอบ (Test) และที่ยกเลิกแล้ว");
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
      {notes.map((n) => (
        <p key={n} className="flex items-start gap-1.5">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {n}
        </p>
      ))}
    </div>
  );
}
