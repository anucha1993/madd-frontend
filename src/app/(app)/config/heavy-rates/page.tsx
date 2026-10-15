"use client";

import SearchPicker from "@/components/ui/SearchPicker";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useAccess } from "@/components/auth/AccessProvider";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import { listCountries, type Country } from "@/lib/countries";
import { getHeavyRates, saveHeavyRateCodes, saveHeavyRates, type HeavyRateBand, type HeavyRateCarrier } from "@/lib/heavyRates";

const fieldClass =
  "rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";

const CARRIERS: HeavyRateCarrier[] = ["UPS", "DHL"];

// Cells are edited as text so a half-typed number isn't lost; converted on save.
type EditBand = { min_weight: number; max_weight: number | null; rates: Record<string, string> };

const toEdit = (bands: HeavyRateBand[]): EditBand[] =>
  bands.map((b) => ({
    ...b,
    rates: Object.fromEntries(Object.entries(b.rates).map(([k, v]) => [k, v == null ? "" : String(v)])),
  }));

export default function HeavyRatesPage() {
  const { can } = useAccess();
  const canEdit = can("config.heavy_rates_edit");
  const [carrier, setCarrier] = useState<HeavyRateCarrier>("UPS");
  const [countries, setCountries] = useState<Country[]>([]);
  const [bands, setBands] = useState<EditBand[]>([]);
  const [codes, setCodes] = useState<{ code: string; label: string }[]>([]);
  const [replaced, setReplaced] = useState<string[]>([]);
  const [codeFilter, setCodeFilter] = useState("");
  // Countries with a special price (added from the picker, or already priced in a band).
  const [extraCountries, setExtraCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const zoneColumn = carrier === "UPS" ? "ups_zone" : "dhl_zone";
  const zones = useMemo(
    () =>
      Array.from(new Set(countries.map((c) => c[zoneColumn]).filter((z): z is string => !!z))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    [countries, zoneColumn],
  );

  useEffect(() => {
    listCountries()
      .then(setCountries)
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    getHeavyRates(carrier)
      .then((res) => {
        if (cancelled) return;
        setError("");
        setMessage("");
        setBands(toEdit(res.bands));
        setCodes(res.codes);
        setReplaced(res.replaced_codes);
        setExtraCountries([]);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [carrier]);

  if (loading) return <PageLoading label="Loading Heavy Weight Rate..." />;

  const countryName = (iso2: string) => countries.find((c) => c.iso2 === iso2)?.name ?? iso2;
  const pricedCountries = Array.from(
    new Set([...bands.flatMap((b) => Object.keys(b.rates).filter((k) => k.startsWith("country:")).map((k) => k.slice(8))), ...extraCountries]),
  ).sort((a, b) => countryName(a).localeCompare(countryName(b)));
  const scopeKeys = ["all", ...zones.map((z) => `zone:${z}`), ...pricedCountries.map((c) => `country:${c}`)];

  function removeCountry(iso2: string) {
    setExtraCountries((prev) => prev.filter((c) => c !== iso2));
    setBands((prev) => prev.map((b) => ({ ...b, rates: Object.fromEntries(Object.entries(b.rates).filter(([k]) => k !== `country:${iso2}`)) })));
  }

  function setBand(i: number, patch: Partial<EditBand>) {
    setBands((prev) => prev.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }

  function setRate(i: number, key: string, value: string) {
    setBands((prev) => prev.map((b, j) => (j === i ? { ...b, rates: { ...b.rates, [key]: value } } : b)));
  }

  async function handleSave() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload: HeavyRateBand[] = bands.map((b) => ({
        ...b,
        rates: Object.fromEntries(
          Object.entries(b.rates)
            .filter(([k, v]) => scopeKeys.includes(k) && v.trim() !== "")
            .map(([k, v]) => [k, Number(v)]),
        ),
      }));
      const res = await saveHeavyRates(carrier, payload);
      await saveHeavyRateCodes(carrier, replaced);
      setBands(toEdit(res.bands));
      setMessage("บันทึกแล้ว — มีผลกับราคาขายทันที (Check Rate / Create Shipment / Rate Book / Public API)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-1.5 text-sm font-semibold ${active ? "bg-brand-navy-dark text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"}`;

  return (
    <div>
      <PageHeader
        title="Heavy Weight Rate"
        description="ราคาขายที่ตั้งเอง (บาท/kg) สำหรับน้ำหนักมาก เช่น 71 kg ขึ้นไป — แทนราคาจาก API ทั้งหมด (รวม Fixed Charges / Mark-up / Weight Markup) ทุกส่วนของระบบ"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {CARRIERS.map((c) => (
          <button key={c} type="button" onClick={() => setCarrier(c)} className={tabClass(carrier === c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {!canEdit && (
          <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            ดูได้อย่างเดียว — ต้องมีสิทธิ์ &quot;ราคาขายน้ำหนักเกิน: แก้ไข&quot; เพื่อเปลี่ยนราคา
          </p>
        )}

        <fieldset disabled={!canEdit} className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="w-48 px-3 py-2 text-left font-medium">ช่วงน้ำหนัก (kg) →</th>
                  {bands.map((band, i) => (
                    <th key={i} className="min-w-[170px] px-3 py-2 text-left font-medium">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          value={band.min_weight}
                          onChange={(e) => setBand(i, { min_weight: Number(e.target.value) })}
                          className={`${fieldClass} w-16`}
                          aria-label="ตั้งแต่ (kg)"
                        />
                        <span>–</span>
                        <input
                          type="number"
                          step="1"
                          value={band.max_weight ?? ""}
                          placeholder="ขึ้นไป"
                          onChange={(e) => setBand(i, { max_weight: e.target.value === "" ? null : Number(e.target.value) })}
                          className={`${fieldClass} w-16`}
                          aria-label="ถึง (kg) — ว่าง = ขึ้นไป"
                        />
                        <button
                          type="button"
                          onClick={() => setBands((prev) => prev.filter((_, j) => j !== i))}
                          className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                          aria-label="ลบช่วง"
                          title="ลบช่วงน้ำหนักนี้"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scopeKeys.map((key) => (
                  <tr
                    key={key}
                    className={`border-t border-slate-100 ${key === "all" ? "bg-amber-50/40" : key.startsWith("country:") ? "bg-violet-50/50" : ""}`}
                  >
                    <td className="px-3 py-1.5 font-medium text-slate-700">
                      {key === "all" ? (
                        "ค่าปกติ (ทุก Zone)"
                      ) : key.startsWith("country:") ? (
                        <span className="flex items-center gap-1.5">
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">พิเศษ</span>
                          <span className="truncate" title={countryName(key.slice(8))}>
                            {key.slice(8)} {countryName(key.slice(8))}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeCountry(key.slice(8))}
                            className="ml-auto rounded p-0.5 text-red-400 hover:bg-red-50"
                            aria-label="ลบราคาพิเศษของประเทศนี้"
                            title="ลบราคาพิเศษของประเทศนี้"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ) : (
                        `Zone ${key.slice(5)}`
                      )}
                    </td>
                    {bands.map((band, i) => {
                      // A country without its own price → its zone's, else the default.
                      const zone = key.startsWith("country:") ? countries.find((c) => c.iso2 === key.slice(8))?.[zoneColumn] : null;
                      const zonePrice = zone ? band.rates[`zone:${zone}`]?.trim() : "";
                      const fallback = zonePrice
                        ? `Zone ${zone} ${zonePrice}`
                        : band.rates.all?.trim()
                          ? `ค่าปกติ ${band.rates.all}`
                          : "ใช้ API";
                      return (
                        <td key={i} className="px-3 py-1.5">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={band.rates[key] ?? ""}
                            placeholder={key === "all" ? "ว่าง = ใช้ API" : fallback}
                            onChange={(e) => setRate(i, key, e.target.value)}
                            className={`${fieldClass} w-full`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => {
              const last = bands[bands.length - 1];
              const min = last?.max_weight != null ? last.max_weight + 1 : 71;
              setBands((prev) => [...prev, { min_weight: min, max_weight: null, rates: {} }]);
            }}
            className="mt-3 flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline"
          >
            <Plus className="h-4 w-4" /> เพิ่มช่วงน้ำหนัก
          </button>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SearchPicker
              options={countries
                .filter((c) => !pricedCountries.includes(c.iso2))
                .map((c) => ({ value: c.iso2, label: c.name, hint: c[zoneColumn] ? `Zone ${c[zoneColumn]}` : undefined }))}
              onPick={(iso2) => setExtraCountries((prev) => (prev.includes(iso2) ? prev : [...prev, iso2]))}
              placeholder="+ ราคาพิเศษรายประเทศ… (พิมพ์ชื่อ / รหัส เช่น Japan, US)"
              openUp
            />
            <span className="text-xs text-slate-400">ลำดับ: ราคาประเทศ &gt; ราคา Zone &gt; ค่าปกติ · ช่องว่าง = ใช้ราคาถัดไป</span>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-700">รายการที่ตัดออก (แทนด้วย Heavy Weight Rate)</p>
            <p className="mb-2 text-xs text-slate-400">
              ติ๊ก = ตัดรายการนี้ออก ใช้ราคา บาท/kg แทน · ไม่ติ๊ก = ยังคิดตามปกติ (หลัง Fixed Charges / Mark-up) เช่น ค่าพื้นที่ห่างไกล ·
              บรรทัด % ของยอดรวม (เช่น TOTAL 7%) ที่ไม่ติ๊กจะคิดจากยอดใหม่
            </p>
            {replaced.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {replaced.map((code) => (
                  <span key={code} className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                    ตัด: {codes.find((c) => c.code === code)?.label ?? code} ({code})
                  </span>
                ))}
              </div>
            )}
            <input
              type="text"
              value={codeFilter}
              onChange={(e) => setCodeFilter(e.target.value)}
              placeholder="ค้นหา code หรือชื่อ…"
              className={`${fieldClass} mb-2 w-64`}
            />
            <div className="grid max-h-64 grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto rounded-lg border border-slate-200 p-3 sm:grid-cols-2 lg:grid-cols-3">
              {codes
                .filter((c) => {
                  const q = codeFilter.trim().toLowerCase();
                  return !q || c.code.toLowerCase().includes(q) || c.label.toLowerCase().includes(q);
                })
                .map((c) => (
                  <label key={c.code} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={replaced.includes(c.code)}
                      onChange={(e) => setReplaced((prev) => (e.target.checked ? [...prev, c.code] : prev.filter((x) => x !== c.code)))}
                      className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
                    />
                    <span className="font-mono text-xs text-slate-500">{c.code}</span>
                    <span className="truncate">{c.label}</span>
                  </label>
                ))}
            </div>
          </div>
        </fieldset>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p>
            บรรทัด Heavy Weight Rate = <strong>บาท/kg × น้ำหนักที่คิดเงิน</strong> เช่น 150 × 80 kg = 12,000 บาท — แทนรายการที่ติ๊กตัดออกด้านบน
            รายการอื่นยังคิดตามปกติ
          </p>
          <p className="mt-1 text-slate-500">
            ลำดับ: ราคาพิเศษรายประเทศ &gt; ราคา Zone &gt; ค่าปกติ · ค่าปกติว่าง = ใช้ราคาจาก API ตามเดิม · ยังถามราคา carrier เสมอ (ต้นทุน, รายการที่ไม่ตัด, Book จริง) ·
            Zone ของแต่ละประเทศตั้งที่ Countries
          </p>
        </div>

        {(message || error) && <p className={`mt-3 text-sm ${error ? "text-red-600" : "text-emerald-600"}`}>{error || message}</p>}

        {canEdit && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg bg-brand-amber px-5 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              บันทึก
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
