"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import {
  createZonePrice,
  deleteZonePrice,
  downloadZonePrices,
  importZonePrices,
  listZonePrices,
  updateZonePrice,
  type Carrier,
  type Country,
  type ZonePrice,
  type ZonePriceInput,
} from "@/lib/countries";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";

const CARRIERS: Carrier[] = ["UPS", "DHL"];

type Draft = { charge_code: string; target: "ZONE" | "COUNTRY"; zone: string; country_iso2: string; price: string; note: string };

const EMPTY_DRAFT: Draft = { charge_code: "", target: "ZONE", zone: "", country_iso2: "", price: "", note: "" };

// Staff's own price per charge code per manual zone (+ single-country exceptions) — used as
// {ZONE_PRICE} by Fixed Charges / Mark-up formulas. Zones themselves are set on the Countries tab.
export default function ZonePricesPanel({ countries }: { countries: Country[] }) {
  const [prices, setPrices] = useState<ZonePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [carrier, setCarrier] = useState<Carrier>("UPS");
  const [codeFilter, setCodeFilter] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    setPrices(await listZonePrices());
  }

  useEffect(() => {
    listZonePrices()
      .then(setPrices)
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดราคาไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  const zoneColumn = carrier === "UPS" ? "ups_zone" : "dhl_zone";
  const countriesInZone = (zone: string) => countries.filter((c) => c[zoneColumn] === zone);
  const zones = Array.from(new Set(countries.map((c) => c[zoneColumn]).filter((z): z is string => !!z))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
  const countryName = (iso2: string) => countries.find((c) => c.iso2 === iso2)?.name ?? iso2;

  const visible = prices.filter((p) => p.carrier === carrier && (!codeFilter || p.charge_code === codeFilter));
  const codes = Array.from(new Set(prices.filter((p) => p.carrier === carrier).map((p) => p.charge_code))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

  function startEdit(p: ZonePrice) {
    setEditingId(p.id);
    setDraft({
      charge_code: p.charge_code,
      target: p.country_iso2 ? "COUNTRY" : "ZONE",
      zone: p.zone ?? "",
      country_iso2: p.country_iso2 ?? "",
      price: String(p.price),
      note: p.note ?? "",
    });
  }

  async function handleSave() {
    if (!draft) return;
    const data: ZonePriceInput = {
      carrier,
      charge_code: draft.charge_code.trim(),
      zone: draft.target === "ZONE" ? draft.zone.trim() || null : null,
      country_iso2: draft.target === "COUNTRY" ? draft.country_iso2 || null : null,
      price: Number(draft.price),
      note: draft.note.trim() || null,
    };
    setSaving(true);
    setError("");
    try {
      if (editingId) await updateZonePrice(editingId, data);
      else await createZonePrice(data);
      setDraft(null);
      setEditingId(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: ZonePrice) {
    if (!confirm(`ลบราคา ${p.charge_code} — ${p.country_iso2 ? countryName(p.country_iso2) : `Zone ${p.zone}`}?`)) return;
    setError("");
    try {
      await deleteZonePrice(p.id);
      setPrices((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const res = await importZonePrices(file);
      setMessage(res.message);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDownload() {
    setError("");
    try {
      await downloadZonePrices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ดาวน์โหลดไม่สำเร็จ");
    }
  }

  const canSave =
    !!draft &&
    !!draft.charge_code.trim() &&
    draft.price !== "" &&
    Number(draft.price) >= 0 &&
    (draft.target === "ZONE" ? !!draft.zone.trim() : !!draft.country_iso2);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading prices...
      </div>
    );
  }

  return (
    <div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {message && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">{message}</p>}

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        ราคาที่ตั้งเองต่อ Charge Code ตาม Zone ของประเทศปลายทาง — ใช้ใน <b>Agent Accounts → Fixed Charges</b> แบบ{" "}
        <b>Manual Zone</b> หรือในสูตรเป็น <code className="font-mono">{"{ZONE_PRICE}"}</code> (เช่น{" "}
        <code className="font-mono">{"{ZONE_PRICE} * {W}"}</code>) · ประเทศที่ราคาไม่เหมือนประเทศอื่นใน Zone เดียวกัน ให้เพิ่มแถวแบบ &quot;ประเทศ&quot; ·
        ปลายทางที่ไม่มีราคา จะใช้ราคาจาก API ตามเดิม
      </div>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2 border-b border-slate-200">
          {CARRIERS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCarrier(c);
                setCodeFilter("");
                setDraft(null);
                setEditingId(null);
              }}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
                carrier === c ? "border-brand-navy text-brand-navy" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {c}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-500">
                {prices.filter((p) => p.carrier === c).length}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)} className={`${inputClass} w-auto`}>
            <option value="">ทุก Charge Code</option>
            {codes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Download Template + ข้อมูล
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload Excel
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && confirm("อัปโหลดแล้วจะแทนที่ราคาเดิมทั้งหมดของ Carrier ที่อยู่ในไฟล์ — ดำเนินการต่อ?")) handleUpload(file);
              else if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setDraft({ ...EMPTY_DRAFT, charge_code: codeFilter });
            }}
            className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
          >
            <Plus className="h-4 w-4" />
            เพิ่มราคา
          </button>
        </div>
      </div>

      {draft && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
          <span className="py-1.5 text-sm font-semibold text-slate-600">{editingId ? "แก้ไข" : "เพิ่ม"} {carrier}</span>
          <label className="flex w-28 flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-600">Charge Code</span>
            <input value={draft.charge_code} onChange={(e) => setDraft({ ...draft, charge_code: e.target.value })} placeholder="เช่น 190" className={`${inputClass} font-mono`} />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-600">ใช้กับ</span>
            <div className="flex gap-1 rounded-lg border border-slate-300 bg-white p-1">
              {(["ZONE", "COUNTRY"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDraft({ ...draft, target: t })}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${draft.target === t ? "bg-brand-navy-dark text-white" : "text-slate-500 hover:bg-slate-100"}`}
                >
                  {t === "ZONE" ? "ทั้ง Zone" : "เฉพาะประเทศ"}
                </button>
              ))}
            </div>
          </div>
          {draft.target === "ZONE" ? (
            <label className="flex w-28 flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-600">Zone</span>
              <input value={draft.zone} onChange={(e) => setDraft({ ...draft, zone: e.target.value })} list="zone-options" placeholder="เช่น 1" className={inputClass} />
              <datalist id="zone-options">
                {zones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </label>
          ) : (
            <label className="flex min-w-[200px] flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-600">ประเทศ</span>
              <select value={draft.country_iso2} onChange={(e) => setDraft({ ...draft, country_iso2: e.target.value })} className={inputClass}>
                <option value="">— เลือกประเทศ —</option>
                {countries.map((c) => (
                  <option key={c.iso2} value={c.iso2}>
                    {c.name} ({c.iso2}){c[zoneColumn] ? ` · Zone ${c[zoneColumn]}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex w-32 flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-600">ราคา (THB)</span>
            <input type="number" min={0} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className={inputClass} />
          </label>
          <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-600">หมายเหตุ</span>
            <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className={inputClass} />
          </label>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canSave}
            className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
          >
            {saving ? "Saving..." : "บันทึก"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setEditingId(null);
            }}
            className="p-2 text-slate-400 hover:text-slate-600"
            title="ยกเลิก"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
            <tr>
              <th className="px-5 py-2.5 font-medium">Charge Code</th>
              <th className="px-5 py-2.5 font-medium">ใช้กับ</th>
              <th className="px-5 py-2.5 font-medium text-right">ราคา (THB)</th>
              <th className="px-5 py-2.5 font-medium">หมายเหตุ</th>
              <th className="px-5 py-2.5 font-medium text-right" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-sm text-slate-400">
                  ยังไม่มีราคาของ {carrier} — กด &quot;เพิ่มราคา&quot; หรือ Download Template แล้ว Upload Excel
                </td>
              </tr>
            ) : (
              visible.map((p) => {
                const inZone = p.zone ? countriesInZone(p.zone) : [];
                return (
                  <tr key={p.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-5 py-2.5 font-mono font-medium text-slate-700">{p.charge_code}</td>
                    <td className="px-5 py-2.5 text-slate-600">
                      {p.country_iso2 ? (
                        <>
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">เฉพาะประเทศ</span>{" "}
                          {countryName(p.country_iso2)} ({p.country_iso2})
                        </>
                      ) : (
                        <>
                          <span className="font-medium">Zone {p.zone}</span>
                          <div className="text-xs text-slate-400" title={inZone.map((c) => c.name).join(", ")}>
                            {inZone.length === 0
                              ? "ยังไม่มีประเทศใน Zone นี้"
                              : `${inZone.length} ประเทศ: ${inZone.slice(0, 5).map((c) => c.iso2).join(", ")}${inZone.length > 5 ? " …" : ""}`}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-medium text-slate-700">
                      {Number(p.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-2.5 text-slate-500">{p.note}</td>
                    <td className="px-5 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => startEdit(p)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="แก้ไข">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDelete(p)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="ลบ">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
