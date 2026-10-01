"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calculator, Eye, MapPin, PackageSearch, Users } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import { getApiStats, listApiClients, type ApiClientRecord, type ApiStats, type ApiStatsGroup } from "@/lib/apiClients";

const PRESETS = [
  { days: 7, label: "7 วัน" },
  { days: 30, label: "30 วัน" },
  { days: 90, label: "90 วัน" },
  { days: 365, label: "1 ปี" },
];

const bangkokToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const shift = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const n = (v: number) => v.toLocaleString();
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");

let regionNames: Intl.DisplayNames | null = null;
try {
  regionNames = new Intl.DisplayNames(["th"], { type: "region" });
} catch {
  regionNames = null;
}
const countryName = (code: string) => {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
};

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";

export default function ApiStatsPage() {
  const [clients, setClients] = useState<ApiClientRecord[]>([]);
  const [filters, setFilters] = useState({ date_from: shift(bangkokToday(), -29), date_to: bangkokToday(), api_client_id: undefined as number | undefined });
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listApiClients()
      .then(setClients)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    getApiStats(filters)
      .then((res) => {
        if (cancelled) return;
        setStats(res);
        setError("");
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "โหลดสถิติไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const activeDays = Math.round((Date.parse(filters.date_to) - Date.parse(filters.date_from)) / 86400000) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="สถิติการใช้งานเว็บไซต์" description="ผู้เข้าชมและการใช้งานหน้า Rate Quote / Tracking บนเว็บไซต์ (จาก Plugin WordPress) — เวลาไทย" />
        <Link href="/config/api-clients" className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" />
          Public API
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setFilters({ ...filters, date_from: shift(bangkokToday(), -(p.days - 1)), date_to: bangkokToday() })}
              className={`px-3 py-2 text-sm ${filters.date_to === bangkokToday() && activeDays === p.days ? "bg-brand-navy-dark text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ตั้งแต่</span>
          <input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ถึง</span>
          <input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} className={inputClass} />
        </label>
        {clients.length > 1 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">เว็บไซต์ / Key</span>
            <select value={filters.api_client_id ?? ""} onChange={(e) => setFilters({ ...filters, api_client_id: e.target.value ? Number(e.target.value) : undefined })} className={`${inputClass} w-52`}>
              <option value="">ทั้งหมด</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {!stats ? (
        <PageLoading label="Loading stats..." />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <GroupCard
              title="Rate Quote"
              icon={<Calculator className="h-5 w-5" />}
              color="#f5b400"
              g={stats.summary.rates}
              searchLabel="เช็คราคา"
              extra={[
                ["ไม่มีบริการ", stats.summary.rates.no_result ?? 0],
                ["ไม่สำเร็จ", stats.summary.rates.failed],
              ]}
            />
            <GroupCard
              title="Tracking"
              icon={<PackageSearch className="h-5 w-5" />}
              color="#0b2a36"
              g={stats.summary.tracking}
              searchLabel="ค้นหา"
              extra={[
                ["ไม่พบเลข", stats.summary.tracking.not_found ?? 0],
                ["เลขนอก MADD", stats.summary.tracking.external ?? 0],
              ]}
            />
          </div>

          <Panel title="รายวัน">
            <DailyChart daily={stats.daily} />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="ช่วงเวลาที่มีการใช้งาน (ค้นหาทั้งหมด)">
              <HourlyChart hourly={stats.hourly} />
            </Panel>
            <Panel title="น้ำหนักที่เช็คราคา">
              <Bars rows={stats.weights.map((w) => ({ label: w.label, value: w.searches }))} color="#f5b400" />
            </Panel>
          </div>

          <Panel title="ประเทศปลายทางยอดนิยม (เช็คราคา)" icon={<MapPin className="h-4 w-4 text-slate-400" />}>
            {stats.destinations.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">ยังไม่มีข้อมูล</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th className="pb-2 font-medium">ประเทศ</th>
                    <th className="pb-2 font-medium">จำนวน</th>
                    <th className="pb-2 text-right font-medium">น้ำหนักเฉลี่ย</th>
                    <th className="pb-2 text-right font-medium">ราคาต่ำสุดเฉลี่ย</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.destinations.map((d) => {
                    const max = stats.destinations[0].searches || 1;
                    return (
                      <tr key={d.country} className="border-t border-slate-100">
                        <td className="py-2 pr-3 font-medium text-slate-700">
                          {countryName(d.country)} <span className="text-xs text-slate-400">{d.country}</span>
                        </td>
                        <td className="w-1/2 py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 rounded-full bg-brand-amber" style={{ width: `${Math.max(4, (d.searches / max) * 100)}%` }} />
                            <span className="tabular-nums text-slate-600">{n(d.searches)}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-600">{d.avg_weight != null ? `${d.avg_weight} kg` : "—"}</td>
                        <td className="py-2 text-right tabular-nums text-slate-600">{d.avg_price != null ? `${n(Math.round(d.avg_price))} ฿` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>
          <p className="text-xs text-slate-400">
            ผู้เข้าชม = จำนวน IP ไม่ซ้ำ · การเปิดหน้านับเมื่อใช้ Plugin MADD Tracking 1.3.2+ / MADD Rate Quote 1.0.3+ · ข้อมูลเก็บไว้ 365 วัน
          </p>
        </>
      )}
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-800">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function GroupCard({ title, icon, color, g, searchLabel, extra }: { title: string; icon: React.ReactNode; color: string; g: ApiStatsGroup; searchLabel: string; extra: [string, number][] }) {
  const kpis: { label: string; value: string; hint?: string; icon?: React.ReactNode }[] = [
    { label: "เปิดหน้า", value: n(g.views), icon: <Eye className="h-3.5 w-3.5" /> },
    { label: "ผู้เข้าชม (ไม่ซ้ำ)", value: n(g.visitors), icon: <Users className="h-3.5 w-3.5" /> },
    { label: searchLabel, value: n(g.searches), hint: `${n(g.searchers)} คน` },
    { label: "สำเร็จ", value: pct(g.successful, g.searches), hint: `${n(g.successful)} ครั้ง` },
  ];
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="flex items-center gap-2 font-semibold text-slate-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: color }}>
            {icon}
          </span>
          {title}
        </h2>
        <span className="text-xs text-slate-400">
          {g.views > 0 ? `ค้นหาต่อการเปิดหน้า ${pct(g.searches, g.views)}` : ""}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white px-5 py-4">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              {k.icon}
              {k.label}
            </div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{k.value}</div>
            {k.hint && <div className="text-xs text-slate-400">{k.hint}</div>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-5 py-3 text-xs text-slate-500">
        {extra.map(([label, value]) => (
          <span key={label}>
            {label} <b className="text-slate-700">{n(value)}</b>
          </span>
        ))}
        <span>
          จาก Cache <b className="text-slate-700">{n(g.cached)}</b>
        </span>
        {g.avg_ms > 0 && (
          <span>
            ตอบเฉลี่ย <b className="text-slate-700">{(g.avg_ms / 1000).toFixed(1)} วินาที</b>
          </span>
        )}
      </div>
    </section>
  );
}

function DailyChart({ daily }: { daily: ApiStats["daily"] }) {
  const series = [
    { key: "rates_searches", label: "เช็คราคา", color: "#f5b400" },
    { key: "tracking_searches", label: "ค้นหา Tracking", color: "#0b2a36" },
    { key: "rates_views", label: "เปิดหน้า Rate Quote", color: "#fcd977", dashed: true },
    { key: "tracking_views", label: "เปิดหน้า Tracking", color: "#7fa3b1", dashed: true },
  ] as const;
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...daily.flatMap((d) => series.map((s) => d[s.key])));
  const W = 1000;
  const H = 220;
  const pad = 28;
  const x = (i: number) => pad + (daily.length <= 1 ? 0 : (i * (W - pad * 2)) / (daily.length - 1));
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const ticks = useMemo(() => [0, Math.round(max / 2), max], [max]);
  const labelEvery = Math.ceil(daily.length / 10);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5" style={{ background: s.color, opacity: "dashed" in s ? 0.9 : 1 }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" preserveAspectRatio="none" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad} x2={W - pad} y1={y(t)} y2={y(t)} stroke="#eef2f6" />
              <text x={4} y={y(t) + 4} fontSize="11" fill="#94a3b8">
                {t}
              </text>
            </g>
          ))}
          {series.map((s) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.color}
              strokeWidth={"dashed" in s ? 2 : 2.5}
              strokeDasharray={"dashed" in s ? "6 5" : undefined}
              vectorEffect="non-scaling-stroke"
              points={daily.map((d, i) => `${x(i)},${y(d[s.key])}`).join(" ")}
            />
          ))}
          {daily.map((d, i) => (
            <rect key={d.date} x={x(i) - (W - pad * 2) / Math.max(1, daily.length) / 2} y={0} width={(W - pad * 2) / Math.max(1, daily.length)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad / 2} y2={H - pad} stroke="#cbd5e1" strokeDasharray="3 3" />}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% - 80px), calc(100% - 170px))` }}
          >
            <div className="mb-1 font-semibold text-slate-700">{new Date(`${daily[hover].date}T00:00:00`).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}</div>
            {series.map((s) => (
              <div key={s.key} className="flex justify-between gap-4 text-slate-600">
                <span>{s.label}</span>
                <b className="tabular-nums">{daily[hover][s.key]}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between px-1 text-[11px] text-slate-400">
        {daily
          .filter((_, i) => i % labelEvery === 0)
          .map((d) => (
            <span key={d.date}>{new Date(`${d.date}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
          ))}
      </div>
    </div>
  );
}

function HourlyChart({ hourly }: { hourly: number[] }) {
  const max = Math.max(1, ...hourly);
  const peak = hourly.indexOf(Math.max(...hourly));
  return (
    <div>
      <div className="flex h-40 items-end gap-1">
        {hourly.map((v, h) => (
          <div key={h} className="group relative flex flex-1 flex-col items-center justify-end">
            <div className={`w-full rounded-t ${h === peak && v > 0 ? "bg-brand-amber" : "bg-brand-navy/70"}`} style={{ height: `${Math.max(v > 0 ? 4 : 1, (v / max) * 100)}%` }} />
            <span className="pointer-events-none absolute -top-6 hidden rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white group-hover:block">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        {[0, 6, 12, 18, 23].map((h) => (
          <span key={h}>{String(h).padStart(2, "0")}:00</span>
        ))}
      </div>
      {hourly.some((v) => v > 0) && <p className="mt-2 text-xs text-slate-500">ช่วงที่ใช้มากที่สุด {String(peak).padStart(2, "0")}:00–{String(peak + 1).padStart(2, "0")}:00 น.</p>}
    </div>
  );
}

function Bars({ rows, color }: { rows: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 text-sm">
          <span className="w-20 shrink-0 text-slate-600">{r.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
          <span className="w-10 text-right tabular-nums text-slate-600">{n(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
