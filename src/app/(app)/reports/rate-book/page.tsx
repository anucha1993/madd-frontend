"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useAccess } from "@/components/auth/AccessProvider";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import RateBookTable from "@/components/reports/RateBookTable";
import {
  downloadRateBook,
  getRateBookSettings,
  listRateBookRuns,
  requestRateBookSync,
  updateRateBookSettings,
  type RateBookBand,
  type RateBookCarrier,
  type RateBookPackageType,
  type RateBookRun,
  type RateBookSettings,
  type RateBookSettingsResponse,
} from "@/lib/rateBook";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";

const CARRIERS: RateBookCarrier[] = ["UPS", "DHL"];
const PACKAGE_TYPES: { key: RateBookPackageType; label: string }[] = [
  { key: "box", label: "Non-document" },
  { key: "document", label: "Document" },
];
const DAYS = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];

const STATUS_STYLE: Record<RateBookRun["status"], string> = {
  running: "bg-sky-50 text-sky-700",
  success: "bg-emerald-50 text-emerald-700",
  partial: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-600",
};
const STATUS_LABEL: Record<RateBookRun["status"], string> = {
  running: "กำลัง Sync",
  success: "สำเร็จ",
  partial: "สำเร็จบางส่วน",
  failed: "ล้มเหลว",
};

export default function RateBookPage() {
  const { can } = useAccess();
  const canEdit = can("report.rate_book_settings");
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<RateBookSettingsResponse | null>(null);
  const [settings, setSettings] = useState<RateBookSettings | null>(null);
  const [runs, setRuns] = useState<RateBookRun[]>([]);
  const [carrierTab, setCarrierTab] = useState<RateBookCarrier>("UPS");
  const [pageTab, setPageTab] = useState<"rates" | "history" | "settings">("rates");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setRuns(await listRateBookRuns());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [res] = await Promise.all([getRateBookSettings(), loadRuns()]);
        setMeta(res);
        setSettings(res.settings);
      } catch (e) {
        setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadRuns]);

  // Keep the progress fresh while a sync is queued or running.
  const busy = runs.some((r) => r.status === "running") || !!meta?.sync_requested;
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(async () => {
      await loadRuns();
      const res = await getRateBookSettings();
      setMeta((prev) => (prev ? { ...prev, sync_requested: res.sync_requested, last_run_at: res.last_run_at } : res));
    }, 10000);
    return () => clearInterval(timer);
  }, [busy, loadRuns]);

  if (loading) return <PageLoading label="Loading Rate Book..." />;
  if (!settings || !meta) return <p className="text-sm text-red-600">{error || "โหลดข้อมูลไม่สำเร็จ"}</p>;

  const carrier = settings.carriers[carrierTab];
  const accountsFor = (c: RateBookCarrier) => meta.accounts.filter((a) => a.carrier === c);

  function updateCarrier(patch: Partial<RateBookSettings["carriers"][RateBookCarrier]>) {
    setSettings((prev) => (prev ? { ...prev, carriers: { ...prev.carriers, [carrierTab]: { ...prev.carriers[carrierTab], ...patch } } } : prev));
  }

  function updateBand(type: RateBookPackageType, index: number, patch: Partial<RateBookBand>) {
    updateCarrier({ bands: { ...carrier.bands, [type]: carrier.bands[type].map((b, i) => (i === index ? { ...b, ...patch } : b)) } });
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await updateRateBookSettings(settings);
      setSettings(res.settings);
      setMessage("บันทึกแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setError("");
    try {
      const res = await requestRateBookSync();
      setMessage(res.message);
      setMeta((prev) => (prev ? { ...prev, sync_requested: true } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "สั่ง Sync ไม่สำเร็จ");
    }
  }

  async function handleDownload(run: RateBookRun, carrier: RateBookCarrier) {
    setDownloading(`${run.id}-${carrier}`);
    try {
      await downloadRateBook(run, carrier);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดาวน์โหลดไม่สำเร็จ");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Rate Book"
        description="ราคาขาย (ดึงจาก API จริง + Markup ของแต่ละบัญชี) ต่อช่วงน้ำหนัก × Zone — ใช้ภายใน ดาวน์โหลดเป็น Excel"
      />

      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-slate-200">
        {(
          [
            ["rates", "ตารางเรท"],
            ["history", "ประวัติการ Sync"],
            ...(canEdit ? [["settings", "ตั้งค่า"] as const] : []),
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPageTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${
              pageTab === key ? "border-brand-amber text-brand-navy-dark" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-1.5">
          <button type="button" onClick={loadRuns} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={handleSync}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {meta.sync_requested ? "รอเริ่ม Sync..." : busy ? "กำลัง Sync..." : "Sync ตอนนี้"}
            </button>
          )}
        </div>
      </div>

      {(message || error) && (
        <p className={`mb-4 text-sm ${error ? "text-red-600" : "text-emerald-600"}`}>{error || message}</p>
      )}

      {pageTab === "rates" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <RateBookTable runs={runs} />
        </div>
      )}

      {pageTab === "history" && (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {runs.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-slate-400">ยังไม่เคย Sync — กด &quot;Sync ตอนนี้&quot; เพื่อสร้าง Rate Book ชุดแรก</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-2 font-medium">#</th>
                  <th className="px-5 py-2 font-medium">เริ่ม</th>
                  <th className="px-5 py-2 font-medium">สถานะ</th>
                  <th className="px-5 py-2 font-medium">ความคืบหน้า</th>
                  <th className="px-5 py-2 font-medium">สั่งโดย</th>
                  <th className="px-5 py-2 text-right font-medium">Excel</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t border-slate-100">
                    <td className="px-5 py-2 text-slate-500">{run.id}</td>
                    <td className="px-5 py-2 text-slate-600">{run.started_at ? new Date(run.started_at).toLocaleString() : "-"}</td>
                    <td className="px-5 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[run.status]}`}>{STATUS_LABEL[run.status]}</span>
                      {run.error && <div className="mt-0.5 max-w-xs truncate text-xs text-red-500" title={run.error}>{run.error}</div>}
                    </td>
                    <td className="px-5 py-2 text-slate-600">
                      {run.done_points.toLocaleString()} / {run.total_points.toLocaleString()}
                      {run.error_points > 0 && <span className="ml-1 text-xs text-amber-600">(error {run.error_points})</span>}
                    </td>
                    <td className="px-5 py-2 text-slate-500">{run.trigger === "schedule" ? "ตั้งเวลา" : run.requester?.name ?? "Manual"}</td>
                    <td className="px-5 py-2 text-right">
                      {(run.status === "success" || run.status === "partial") && (
                        <div className="inline-flex gap-1.5">
                          {CARRIERS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => handleDownload(run, c)}
                              disabled={downloading === `${run.id}-${c}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                            >
                              {downloading === `${run.id}-${c}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {pageTab === "settings" && canEdit && (
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">รอบ Sync อัตโนมัติ</h2>
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-600">เปิด Sync อัตโนมัติ</span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-600">ความถี่</span>
                <select
                  value={settings.frequency}
                  onChange={(e) => setSettings({ ...settings, frequency: e.target.value as RateBookSettings["frequency"] })}
                  className={`${inputClass} w-36`}
                >
                  <option value="weekly">สัปดาห์ละครั้ง</option>
                  <option value="monthly">เดือนละครั้ง</option>
                </select>
              </label>
              {settings.frequency === "weekly" ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">วัน</span>
                  <select
                    value={settings.day_of_week}
                    onChange={(e) => setSettings({ ...settings, day_of_week: Number(e.target.value) })}
                    className={`${inputClass} w-36`}
                  >
                    {DAYS.map((d, i) => (
                      <option key={d} value={i + 1}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-600">วันที่ (1-28)</span>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={settings.day_of_month}
                    onChange={(e) => setSettings({ ...settings, day_of_month: Number(e.target.value) })}
                    className={`${inputClass} w-24`}
                  />
                </label>
              )}
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-600">เวลา</span>
                <input
                  type="time"
                  value={settings.time}
                  onChange={(e) => setSettings({ ...settings, time: e.target.value })}
                  className={`${inputClass} w-32`}
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              ราคาใน Rate Book = ราคาขายเดียวกับหน้า Create Shipment ทุกบาท (Fixed Charges + Mark-up ของแต่ละบัญชี) — ไม่บวก VAT เพิ่ม
            </p>
            {meta.last_run_at && <p className="mt-3 text-xs text-slate-400">Sync ล่าสุด: {new Date(meta.last_run_at).toLocaleString()}</p>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {CARRIERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCarrierTab(c)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${
                    carrierTab === c ? "bg-brand-navy-dark text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {c}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={carrier.enabled}
                  onChange={(e) => updateCarrier({ enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                รวม {carrierTab} ใน Rate Book
              </label>
            </div>

            {PACKAGE_TYPES.map(({ key, label }) => (
              <div key={key} className="mb-5">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
                  <label className="flex items-center gap-1.5 text-xs text-slate-500">
                    Service code
                    <input
                      type="text"
                      value={carrier.service_codes[key]}
                      onChange={(e) => updateCarrier({ service_codes: { ...carrier.service_codes, [key]: e.target.value.toUpperCase() } })}
                      className={`${inputClass} w-16`}
                    />
                  </label>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">ตั้งแต่ (kg)</th>
                        <th className="px-3 py-2 font-medium">ถึง (kg) — ว่าง = ขึ้นไป</th>
                        <th className="px-3 py-2 font-medium">แสดงราคา</th>
                        <th className="px-3 py-2 font-medium">บัญชีที่ใช้ดึงราคา</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {carrier.bands[key].map((band, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              step="0.01"
                              value={band.min}
                              onChange={(e) => updateBand(key, i, { min: Number(e.target.value) })}
                              className={`${inputClass} w-24`}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              step="0.01"
                              value={band.max ?? ""}
                              onChange={(e) =>
                                updateBand(key, i, e.target.value === "" ? { max: null, step: null } : { max: Number(e.target.value) })
                              }
                              className={`${inputClass} w-24`}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <select
                              value={band.step == null ? "" : String(band.step)}
                              onChange={(e) => updateBand(key, i, { step: e.target.value === "" ? null : Number(e.target.value) })}
                              className={`${inputClass} w-40`}
                            >
                              <option value="0.5" disabled={band.max == null}>
                                ทุก 0.5 kg
                              </option>
                              <option value="1" disabled={band.max == null}>
                                ทุก 1 kg
                              </option>
                              <option value="">ราคาต่อ kg</option>
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <select
                              value={band.account_id ?? ""}
                              onChange={(e) => updateBand(key, i, { account_id: e.target.value ? Number(e.target.value) : null })}
                              className={`${inputClass} w-44`}
                            >
                              <option value="">— เลือกบัญชี —</option>
                              {accountsFor(carrierTab).map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.username}
                                  {a.mode === "test" ? " (test)" : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <button
                              type="button"
                              onClick={() => updateCarrier({ bands: { ...carrier.bands, [key]: carrier.bands[key].filter((_, j) => j !== i) } })}
                              className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                              aria-label="ลบช่วง"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const last = carrier.bands[key][carrier.bands[key].length - 1];
                    const min = last?.max != null ? Number((last.max + 0.01).toFixed(2)) : 0.1;
                    updateCarrier({ bands: { ...carrier.bands, [key]: [...carrier.bands[key], { min, max: null, step: null, account_id: last?.account_id ?? null }] } });
                  }}
                  className="mt-2 flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline"
                >
                  <Plus className="h-4 w-4" /> เพิ่มช่วงน้ำหนัก
                </button>
              </div>
            ))}
            <p className="mb-5 text-xs text-slate-400">ตั้งแต่ 10.01 kg ขึ้นไปไม่มีขายน้ำหนักทศนิยม — ระบบปัดขึ้นเป็น kg เต็มเสมอ (10.01 → 11)</p>

            <div className="mb-5">
              <h3 className="mb-1 text-sm font-semibold text-slate-700">บัญชีเฉพาะ Zone</h3>
              <p className="mb-2 text-xs text-slate-400">ใช้แทนบัญชีของช่วงน้ำหนัก สำหรับ Zone นั้นตั้งแต่น้ำหนักที่กำหนดขึ้นไป (เช่น DHL Zone 7 ตั้งแต่ 14 kg)</p>
              {carrier.account_rules.map((rule, i) => (
                <div key={i} className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  Zone
                  <select
                    value={rule.zone}
                    onChange={(e) => updateCarrier({ account_rules: carrier.account_rules.map((r, j) => (j === i ? { ...r, zone: e.target.value } : r)) })}
                    className={`${inputClass} w-20`}
                  >
                    {Object.keys(carrier.zone_countries).map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                  ตั้งแต่
                  <input
                    type="number"
                    step="0.01"
                    value={rule.min_weight}
                    onChange={(e) =>
                      updateCarrier({ account_rules: carrier.account_rules.map((r, j) => (j === i ? { ...r, min_weight: Number(e.target.value) } : r)) })
                    }
                    className={`${inputClass} w-20`}
                  />
                  kg ใช้บัญชี
                  <select
                    value={rule.account_id ?? ""}
                    onChange={(e) =>
                      updateCarrier({ account_rules: carrier.account_rules.map((r, j) => (j === i ? { ...r, account_id: Number(e.target.value) } : r)) })
                    }
                    className={`${inputClass} w-44`}
                  >
                    <option value="" disabled>
                      — เลือกบัญชี —
                    </option>
                    {accountsFor(carrierTab).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.username}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => updateCarrier({ account_rules: carrier.account_rules.filter((_, j) => j !== i) })}
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                    aria-label="ลบกฎ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateCarrier({
                    account_rules: [
                      ...carrier.account_rules,
                      { zone: Object.keys(carrier.zone_countries)[0] ?? "", min_weight: 0, account_id: accountsFor(carrierTab)[0]?.id ?? 0 },
                    ],
                  })
                }
                className="flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline"
              >
                <Plus className="h-4 w-4" /> เพิ่มบัญชีเฉพาะ Zone
              </button>
            </div>

            <h3 className="mb-1 text-sm font-semibold text-slate-700">ปลายทางตัวแทนของแต่ละ Zone</h3>
            <p className="mb-2 text-xs text-slate-400">ใช้ขอราคาแทนทั้ง Zone — ต้องเป็นเมือง/รหัสไปรษณีย์จริง (Zone ตามหน้า Countries)</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Zone</th>
                    <th className="px-3 py-2 font-medium">ประเทศ</th>
                    <th className="px-3 py-2 font-medium">เมือง</th>
                    <th className="px-3 py-2 font-medium">รหัสไปรษณีย์</th>
                    <th className="px-3 py-2 font-medium">State</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(carrier.zone_countries).map(([zone, address]) => {
                    const setAddress = (patch: Partial<typeof address>) =>
                      updateCarrier({ zone_countries: { ...carrier.zone_countries, [zone]: { ...address, ...patch } } });
                    return (
                      <tr key={zone} className="border-t border-slate-100">
                        <td className="px-3 py-1.5 font-medium text-slate-700">{zone}</td>
                        <td className="px-3 py-1.5">
                          <select value={address.iso2} onChange={(e) => setAddress({ iso2: e.target.value })} className={`${inputClass} w-52`}>
                            {(meta.zone_countries[carrierTab][zone] ?? []).map((c) => (
                              <option key={c.iso2} value={c.iso2}>
                                {c.iso2} — {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <input value={address.city} onChange={(e) => setAddress({ city: e.target.value })} className={`${inputClass} w-40`} />
                        </td>
                        <td className="px-3 py-1.5">
                          <input value={address.postcode} onChange={(e) => setAddress({ postcode: e.target.value })} className={`${inputClass} w-28`} />
                        </td>
                        <td className="px-3 py-1.5">
                          <input value={address.state_code} onChange={(e) => setAddress({ state_code: e.target.value.toUpperCase() })} className={`${inputClass} w-20`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-amber px-5 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              บันทึกการตั้งค่า
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
