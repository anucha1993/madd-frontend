"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, Download, Loader2, Table2, X } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import { listBranches, type Branch } from "@/lib/branches";
import {
  downloadShipmentAnalytics,
  getShipmentAnalytics,
  type AnalyticsFilters,
  type AnalyticsRow,
  type AttentionGroup,
  type ShipmentAnalytics,
} from "@/lib/shipmentAnalytics";

// Categorical slots (validated: CVD ΔE 24.7, normal ΔE 33.6, ≥3:1 on white). Color follows the
// carrier, never its rank.
const CARRIER_COLOR: Record<string, string> = { DHL: "#2a78d6", UPS: "#eb6834" };

const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const monthStart = (date: string, offset = 0) => {
  const d = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
};

const PRESETS: { label: string; range: () => [string, string] }[] = [
  { label: "วันนี้", range: () => [today(), today()] },
  { label: "7 วัน", range: () => [shift(today(), -6), today()] },
  { label: "30 วัน", range: () => [shift(today(), -29), today()] },
  { label: "เดือนนี้", range: () => [monthStart(today()), today()] },
  { label: "เดือนที่แล้ว", range: () => [monthStart(today(), -1), shift(monthStart(today()), -1)] },
  { label: "90 วัน", range: () => [shift(today(), -89), today()] },
];

const num = (v: number, digits = 0) => v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
const baht = (v: number) => `${num(Math.round(v))} ฿`;

let regionNames: Intl.DisplayNames | null = null;
try {
  regionNames = new Intl.DisplayNames(["th"], { type: "region" });
} catch {
  regionNames = null;
}
const countryName = (code: string) => {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
};
const periodLabel = (p: string, group: ShipmentAnalytics["group"]) => {
  const d = new Date(group === "month" ? `${p}-01T00:00:00` : `${p}T00:00:00`);
  return group === "month" ? d.toLocaleDateString("th-TH", { month: "short", year: "2-digit" }) : d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
};

const selectClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";

export default function ShipmentAnalyticsPage() {
  const [filters, setFilters] = useState<AnalyticsFilters>({ date_from: shift(today(), -29), date_to: today() });
  const [data, setData] = useState<ShipmentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    listBranches()
      .then(setBranches)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    getShipmentAnalytics(filters)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError("");
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const update = (next: Partial<AnalyticsFilters>) => {
    setLoading(true);
    setFilters((f) => ({ ...f, ...next }));
  };
  const staffName = data?.staff.find((s) => Number(s.key) === filters.created_by)?.name;
  const branchName = branches.find((b) => b.id === filters.branch_id)?.name;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Shipment Analytics" description="ภาพรวมปริมาณงานและการปฏิบัติงาน เทียบกับช่วงก่อนหน้า — เฉพาะ Shipment โหมดจริง ตามขอบเขตสาขาของคุณ" />
        <button
          type="button"
          disabled={exporting || !data}
          onClick={async () => {
            setExporting(true);
            try {
              await downloadShipmentAnalytics(filters);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Export ไม่สำเร็จ");
            } finally {
              setExporting(false);
            }
          }}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export Excel
        </button>
      </div>

      {/* Filters — one row, above every chart */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap overflow-hidden rounded-lg border border-slate-300">
          {PRESETS.map((p) => {
            const [f, t] = p.range();
            const active = filters.date_from === f && filters.date_to === t;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => update({ date_from: f, date_to: t })}
                className={`border-r border-slate-200 px-3 py-2 text-sm last:border-r-0 ${active ? "bg-brand-navy-dark text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <input type="date" value={filters.date_from} max={filters.date_to} onChange={(e) => update({ date_from: e.target.value })} className={selectClass} aria-label="ตั้งแต่" />
        <span className="pb-2 text-slate-400">–</span>
        <input type="date" value={filters.date_to} min={filters.date_from} onChange={(e) => update({ date_to: e.target.value })} className={selectClass} aria-label="ถึง" />
        {branches.length > 1 && (
          <select value={filters.branch_id ?? ""} onChange={(e) => update({ branch_id: e.target.value ? Number(e.target.value) : undefined })} className={selectClass} aria-label="สาขา">
            <option value="">ทุกสาขา</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
        <select value={filters.carrier ?? ""} onChange={(e) => update({ carrier: (e.target.value || undefined) as AnalyticsFilters["carrier"] })} className={selectClass} aria-label="Carrier">
          <option value="">ทุก Carrier</option>
          <option value="DHL">DHL</option>
          <option value="UPS">UPS</option>
        </select>
        {(filters.branch_id || filters.carrier || filters.created_by) && (
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {[
              filters.branch_id && { label: `สาขา: ${branchName ?? filters.branch_id}`, clear: { branch_id: undefined } },
              filters.carrier && { label: `Carrier: ${filters.carrier}`, clear: { carrier: undefined } },
              filters.created_by && { label: `พนักงาน: ${staffName ?? filters.created_by}`, clear: { created_by: undefined } },
            ]
              .filter(Boolean)
              .map((chip) => {
                const c = chip as { label: string; clear: Partial<AnalyticsFilters> };
                return (
                  <button key={c.label} type="button" onClick={() => update(c.clear)} className="flex items-center gap-1 rounded-full bg-brand-navy/10 px-3 py-1 text-xs font-medium text-brand-navy-dark hover:bg-brand-navy/15">
                    {c.label}
                    <X className="h-3 w-3" />
                  </button>
                );
              })}
          </div>
        )}
        {loading && data && <Loader2 className="mb-2 h-4 w-4 animate-spin text-slate-400" />}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {!data ? (
        <PageLoading label="Loading analytics..." />
      ) : (
        <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
          <p className="text-xs text-slate-500">
            {periodLabel(data.from, "day")} – {periodLabel(data.to, "day")} · เทียบกับ {periodLabel(data.previous.from, "day")} – {periodLabel(data.previous.to, "day")}
          </p>
          <KpiRow data={data} />

          <div className="grid gap-5 xl:grid-cols-3">
            <Panel title="แนวโน้ม Shipment" className="xl:col-span-2">
              <TrendChart data={data} />
            </Panel>
            <Panel title="⚠ ต้องติดตาม">
              <Attention attention={data.attention} />
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Carrier / บริการ">
              <HBars
                rows={data.carriers.map((c) => ({ id: c.key, label: c.service ?? c.key, sub: c.carrier, value: c.shipments, color: CARRIER_COLOR[c.carrier ?? ""] ?? "#64748b", extra: c.revenue != null ? baht(c.revenue) : `${num(c.weight, 1)} kg` }))}
                onPick={(id) => update({ carrier: id.split("|")[0] as AnalyticsFilters["carrier"] })}
                empty="ยังไม่มี Shipment ในช่วงนี้"
              />
            </Panel>
            <Panel title="ประเทศปลายทางยอดนิยม">
              <HBars
                rows={data.destinations.map((d) => ({ id: d.key, label: countryName(d.key), sub: d.key, value: d.shipments, color: "#2a78d6", extra: d.revenue != null ? baht(d.revenue) : `${num(d.weight, 1)} kg` }))}
                empty="ยังไม่มี Shipment ในช่วงนี้"
              />
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="สาขา">
              <RankTable rows={data.branches} showRevenue={data.show_revenue} onPick={(r) => r.key !== "0" && update({ branch_id: Number(r.key) })} />
            </Panel>
            <Panel title="พนักงานผู้จอง">
              <RankTable rows={data.staff} showRevenue={data.show_revenue} onPick={(r) => r.key !== "0" && update({ created_by: Number(r.key) })} />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h2 className="mb-4 text-sm font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

// ---------- KPI tiles ----------
function KpiRow({ data }: { data: ShipmentAnalytics }) {
  const { kpis, previous_kpis: prev, trend } = data;
  const count = trend.map((t) => t.DHL + t.UPS);
  const tiles: { label: string; value: string; delta: Delta | null; spark?: number[]; hint?: string }[] = [
    { label: "Shipments", value: num(kpis.shipments), delta: pctDelta(kpis.shipments, prev.shipments), spark: count },
    { label: "กล่อง", value: num(kpis.pieces), delta: pctDelta(kpis.pieces, prev.pieces) },
    { label: "น้ำหนักรวม", value: `${num(kpis.weight, 1)} kg`, delta: pctDelta(kpis.weight, prev.weight) },
    ...(kpis.revenue != null
      ? [{ label: "ยอดขาย", value: baht(kpis.revenue), delta: pctDelta(kpis.revenue, prev.revenue ?? 0), spark: trend.map((t) => t.revenue ?? 0), hint: `เฉลี่ย ${baht(kpis.avg_revenue ?? 0)} / Shipment` }]
      : []),
    { label: "ส่งถึงแล้ว", value: `${num(kpis.delivered_rate, 1)}%`, delta: ptsDelta(kpis.delivered_rate, prev.delivered_rate), hint: kpis.avg_transit_days != null ? `ขนส่งเฉลี่ย ${num(kpis.avg_transit_days, 1)} วัน` : undefined },
    { label: "Void", value: `${num(kpis.void_rate, 1)}%`, delta: ptsDelta(kpis.void_rate, prev.void_rate, true), hint: `${num(kpis.voided)} รายการ` },
  ];
  return (
    <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${tiles.length === 6 ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500">{t.label}</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{t.value}</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <DeltaBadge delta={t.delta} />
            {t.spark && t.spark.length > 1 && <Sparkline values={t.spark} />}
          </div>
          {t.hint && <div className="mt-1 text-[11px] text-slate-400">{t.hint}</div>}
        </div>
      ))}
    </div>
  );
}

type Delta = { text: string; good: boolean | null };
const pctDelta = (now: number, before: number): Delta | null => {
  if (!before) return now ? { text: "ใหม่", good: true } : null;
  const p = ((now - before) / before) * 100;
  return { text: `${p >= 0 ? "▲" : "▼"} ${num(Math.abs(p), Math.abs(p) < 10 ? 1 : 0)}%`, good: p === 0 ? null : p > 0 };
};
const ptsDelta = (now: number, before: number, lowerIsBetter = false): Delta | null => {
  const d = now - before;
  if (Math.abs(d) < 0.05) return { text: "เท่าเดิม", good: null };
  return { text: `${d > 0 ? "▲" : "▼"} ${num(Math.abs(d), 1)} pts`, good: lowerIsBetter ? d < 0 : d > 0 };
};

function DeltaBadge({ delta }: { delta: Delta | null }) {
  if (!delta) return <span className="text-[11px] text-slate-400">ไม่มีข้อมูลเทียบ</span>;
  const tone = delta.good === null ? "text-slate-500" : delta.good ? "text-emerald-700" : "text-red-600";
  return <span className={`text-xs font-semibold ${tone}`}>{delta.text}</span>;
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 72;
  const h = 22;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0">
      <polyline points={pts} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ---------- Trend (stacked bars DHL/UPS) ----------
function TrendChart({ data }: { data: ShipmentAnalytics }) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const rows = data.trend;
  const max = Math.max(1, ...rows.map((r) => r.DHL + r.UPS));
  const ticks = useMemo(() => {
    const step = Math.max(1, Math.ceil(max / 4));
    return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  }, [max]);
  const top = ticks[ticks.length - 1] || 1;
  const labelEvery = Math.max(1, Math.ceil(rows.length / 10));
  const totals = { DHL: rows.reduce((a, r) => a + r.DHL, 0), UPS: rows.reduce((a, r) => a + r.UPS, 0) };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-xs text-slate-600">
          {(["DHL", "UPS"] as const).map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: CARRIER_COLOR[c] }} />
              {c} <b className="tabular-nums text-slate-800">{num(totals[c])}</b>
            </span>
          ))}
        </div>
        <button type="button" onClick={() => setAsTable((v) => !v)} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <Table2 className="h-3.5 w-3.5" />
          {asTable ? "แสดงกราฟ" : "แสดงตาราง"}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-xs text-slate-400">
              <tr>
                <th className="py-1 text-left font-medium">ช่วง</th>
                <th className="py-1 text-right font-medium">DHL</th>
                <th className="py-1 text-right font-medium">UPS</th>
                <th className="py-1 text-right font-medium">Void</th>
                {data.show_revenue && <th className="py-1 text-right font-medium">ยอดขาย</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.period} className="border-t border-slate-100 tabular-nums">
                  <td className="py-1 text-slate-600">{periodLabel(r.period, data.group)}</td>
                  <td className="py-1 text-right">{r.DHL}</td>
                  <td className="py-1 text-right">{r.UPS}</td>
                  <td className="py-1 text-right text-slate-500">{r.voided}</td>
                  {data.show_revenue && <td className="py-1 text-right">{baht(r.revenue ?? 0)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <div className="flex h-60 gap-2">
            <div className="relative w-7 shrink-0 text-right text-[10px] text-slate-400">
              {ticks.map((t) => (
                <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
                  {t}
                </span>
              ))}
            </div>
            <div className="relative flex-1" onMouseLeave={() => setHover(null)}>
              {ticks.map((t) => (
                <div key={t} className="absolute inset-x-0 border-t border-slate-100" style={{ bottom: `${(t / top) * 100}%` }} />
              ))}
              <div className="absolute inset-0 flex items-end" style={{ gap: rows.length > 40 ? 1 : 3 }}>
                {rows.map((r, i) => {
                  const dhl = (r.DHL / top) * 100;
                  const ups = (r.UPS / top) * 100;
                  return (
                    <div key={r.period} className="relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)}>
                      {hover === i && <div className="absolute inset-0 rounded-md bg-slate-100/70" />}
                      {/* UPS on top of DHL, 2px surface gap between, rounded data end */}
                      {r.UPS > 0 && <div className="relative mx-auto w-full max-w-[28px] rounded-t-[4px]" style={{ height: `${ups}%`, background: CARRIER_COLOR.UPS, marginBottom: r.DHL > 0 ? 2 : 0 }} />}
                      {r.DHL > 0 && <div className={`relative mx-auto w-full max-w-[28px] ${r.UPS > 0 ? "" : "rounded-t-[4px]"}`} style={{ height: `${dhl}%`, background: CARRIER_COLOR.DHL }} />}
                    </div>
                  );
                })}
              </div>
              {hover !== null && (
                <div
                  className="pointer-events-none absolute top-0 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
                  style={{ left: `clamp(0px, calc(${((hover + 0.5) / rows.length) * 100}% - 75px), calc(100% - 150px))` }}
                >
                  <div className="mb-1 font-semibold text-slate-800">{periodLabel(rows[hover].period, data.group)}</div>
                  {(["DHL", "UPS"] as const).map((c) => (
                    <div key={c} className="flex items-center justify-between gap-6 text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-sm" style={{ background: CARRIER_COLOR[c] }} />
                        {c}
                      </span>
                      <b className="tabular-nums text-slate-800">{rows[hover][c]}</b>
                    </div>
                  ))}
                  {rows[hover].voided > 0 && <div className="flex justify-between gap-6 text-slate-500"><span>Void</span><b className="tabular-nums">{rows[hover].voided}</b></div>}
                  {data.show_revenue && <div className="mt-1 flex justify-between gap-6 border-t border-slate-100 pt-1 text-slate-600"><span>ยอดขาย</span><b className="tabular-nums text-slate-800">{baht(rows[hover].revenue ?? 0)}</b></div>}
                </div>
              )}
            </div>
          </div>
          <div className="ml-9 mt-1 flex text-[10px] text-slate-400">
            {rows.map((r, i) => (
              <span key={r.period} className="flex-1 truncate text-center">
                {i % labelEvery === 0 ? periodLabel(r.period, data.group) : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Horizontal bars ----------
function HBars({ rows, onPick, empty }: { rows: { id: string; label: string; sub?: string; value: number; color: string; extra?: string }[]; onPick?: (id: string) => void; empty: string }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-slate-400">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const Row = onPick ? "button" : "div";
        return (
          <Row
            key={r.id}
            {...(onPick ? { type: "button" as const, onClick: () => onPick(r.id), title: "กรองตามรายการนี้" } : {})}
            className={`group block w-full text-left ${onPick ? "cursor-pointer" : ""}`}
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-slate-700 group-hover:text-brand-navy">
                {r.label} {r.sub && r.sub !== r.label && <span className="text-xs font-normal text-slate-400">{r.sub}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-slate-600">
                <b className="text-slate-800">{num(r.value)}</b> <span className="text-xs text-slate-400">({num((r.value / total) * 100)}%)</span>
                {r.extra && <span className="ml-2 text-xs text-slate-500">{r.extra}</span>}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: r.color }} />
            </div>
          </Row>
        );
      })}
    </div>
  );
}

// ---------- Branch / staff tables ----------
function RankTable({ rows, showRevenue, onPick }: { rows: AnalyticsRow[]; showRevenue: boolean; onPick: (r: AnalyticsRow) => void }) {
  const [sort, setSort] = useState<"shipments" | "revenue" | "weight" | "voided">("shipments");
  if (!rows.length) return <p className="py-8 text-center text-sm text-slate-400">ยังไม่มีข้อมูล</p>;
  const sorted = [...rows].sort((a, b) => (Number(b[sort] ?? 0) - Number(a[sort] ?? 0)));
  const head = (key: typeof sort, label: string) => (
    <th className="py-2 text-right font-medium">
      <button type="button" onClick={() => setSort(key)} className={`inline-flex items-center gap-0.5 ${sort === key ? "text-slate-800" : "hover:text-slate-600"}`}>
        {label}
        {sort === key && <ChevronDown className="h-3 w-3" />}
      </button>
    </th>
  );
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white text-xs text-slate-400">
          <tr>
            <th className="py-2 text-left font-medium">ชื่อ</th>
            {head("shipments", "Shipments")}
            {head("weight", "น้ำหนัก")}
            {showRevenue && head("revenue", "ยอดขาย")}
            {head("voided", "Void")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key} onClick={() => onPick(r)} className="cursor-pointer border-t border-slate-100 tabular-nums hover:bg-slate-50" title="กรองตามรายการนี้">
              <td className="py-2 pr-2 font-medium text-slate-700">{r.name ?? r.key}</td>
              <td className="py-2 text-right text-slate-800">{num(r.shipments)}</td>
              <td className="py-2 text-right text-slate-600">{num(r.weight, 1)} kg</td>
              {showRevenue && <td className="py-2 text-right text-slate-800">{baht(r.revenue ?? 0)}</td>}
              <td className="py-2 text-right text-slate-500">{num(r.voided ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Attention ----------
const ATTENTION: { key: keyof ShipmentAnalytics["attention"]; label: string; hint: string }[] = [
  { key: "awaiting_pickup", label: "ยังไม่มีคนมารับพัสดุ เกิน 1 วัน", hint: "จองแล้วแต่ยังไม่มีการสแกนรับ" },
  { key: "slow_transit", label: "ระหว่างขนส่งนานเกิน 7 วัน", hint: "รับพัสดุแล้วแต่ยังไม่ส่งถึง" },
  { key: "not_invoiced", label: "ยังไม่ออกใบเสร็จ", hint: "จองใน 90 วันที่ผ่านมา" },
  { key: "void_not_notified", label: "Void แล้ว ยังไม่แจ้ง DHL", hint: "ต้องแจ้ง DHL ยกเลิก Waybill" },
];

function Attention({ attention }: { attention: ShipmentAnalytics["attention"] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="divide-y divide-slate-100">
      {ATTENTION.map(({ key, label, hint }) => {
        const g: AttentionGroup = attention[key];
        const isOpen = open === key;
        return (
          <div key={key} className="py-2.5 first:pt-0 last:pb-0">
            <button type="button" disabled={!g.count} onClick={() => setOpen(isOpen ? null : key)} className="flex w-full items-center gap-3 text-left disabled:cursor-default">
              <span className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-bold tabular-nums ${g.count ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-400"}`}>{g.count}</span>
              <span className="min-w-0 flex-1">
                <span className={`flex items-center gap-1 text-sm font-medium ${g.count ? "text-slate-800" : "text-slate-400"}`}>
                  {g.count > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                  {label}
                </span>
                <span className="block text-xs text-slate-400">{hint}</span>
              </span>
              {g.count > 0 && <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />}
            </button>
            {isOpen && (
              <ul className="mt-2 space-y-1 pl-11">
                {g.items.map((s) => (
                  <li key={s.id}>
                    <Link href={`/shipment/view/${s.id}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-slate-50">
                      <span className="flex items-center gap-1.5 font-mono text-slate-700">
                        <span className="h-2 w-2 rounded-sm" style={{ background: CARRIER_COLOR[s.carrier] ?? "#64748b" }} />
                        {s.tracking_number ?? `#${s.id}`}
                      </span>
                      <span className="text-slate-400">
                        {s.country && `${s.country} · `}
                        {new Date(s.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                      </span>
                    </Link>
                  </li>
                ))}
                {g.count > g.items.length && <li className="px-2 text-[11px] text-slate-400">และอีก {num(g.count - g.items.length)} รายการ</li>}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
