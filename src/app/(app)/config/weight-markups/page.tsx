"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useAccess } from "@/components/auth/AccessProvider";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import { listAgentAccounts, type AgentAccount } from "@/lib/agentAccounts";
import { listCountries, type Country } from "@/lib/countries";
import {
  deleteWeightMarkupSet,
  getWeightMarkups,
  saveWeightMarkups,
  type WeightMarkupBand,
  type WeightMarkupCarrier,
  type WeightMarkupPackageType,
} from "@/lib/weightMarkups";

const fieldClass =
  "rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";

const CARRIERS: WeightMarkupCarrier[] = ["UPS", "DHL"];

const isNumber = (v: string) => v.trim() !== "" && !Number.isNaN(Number(v));
const TYPES: { key: WeightMarkupPackageType; label: string }[] = [
  { key: "box", label: "Non-document" },
  { key: "document", label: "Document" },
];

// Column order: default first, then zones (numeric), then countries (by name).
function sortScopes(keys: string[], countryName: (iso2: string) => string): string[] {
  return [...keys].sort((a, b) => {
    const [ta, va] = a.split(":");
    const [tb, vb] = b.split(":");
    if (ta !== tb) return ta === "zone" ? -1 : 1;
    return ta === "zone" ? va.localeCompare(vb, undefined, { numeric: true }) : countryName(va).localeCompare(countryName(vb));
  });
}

export default function WeightMarkupsPage() {
  const { can } = useAccess();
  // View-only users (config.weight_markups without _edit) see the matrix but can't change it.
  const canEdit = can("config.weight_markups_edit");
  const [carrier, setCarrier] = useState<WeightMarkupCarrier>("UPS");
  const [packageType, setPackageType] = useState<WeightMarkupPackageType>("box");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [accounts, setAccounts] = useState<AgentAccount[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [bands, setBands] = useState<WeightMarkupBand[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [accountSets, setAccountSets] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newCountry, setNewCountry] = useState("");
  // Which price list is being edited: "all" (default for every zone), "zone:5" or "country:US".
  const [editing, setEditing] = useState("all");

  const countryName = useCallback((iso2: string) => countries.find((c) => c.iso2 === iso2)?.name ?? iso2, [countries]);
  const carrierAccounts = accounts.filter((a) => a.agent?.agent_code === carrier);
  const zoneColumn = carrier === "UPS" ? "ups_zone" : "dhl_zone";
  const zones = useMemo(
    () =>
      Array.from(new Set(countries.map((c) => c[zoneColumn]).filter((z): z is string => !!z))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true }),
      ),
    [countries, zoneColumn],
  );
  // An account without its own set is priced by the carrier-wide one — show that, read-only until copied.
  const usingCarrierSet = accountId != null && !accountSets.includes(accountId);

  // The matrix shown for the current selection: an account without its own set shows the carrier-wide one.
  const fetchMatrix = useCallback(async () => {
    const own = await getWeightMarkups({ carrier, package_type: packageType, agent_account_id: accountId });
    const shown =
      accountId != null && !own.account_sets.includes(accountId)
        ? await getWeightMarkups({ carrier, package_type: packageType, agent_account_id: null })
        : own;
    return { accountSets: own.account_sets, bands: shown.bands };
  }, [carrier, packageType, accountId]);

  const applyMatrix = (m: { accountSets: number[]; bands: WeightMarkupBand[] }) => {
    setError("");
    setMessage("");
    setAccountSets(m.accountSets);
    setBands(m.bands);
    setScopes(Array.from(new Set(m.bands.flatMap((b) => Object.keys(b.rates).filter((k) => k !== "all")))));
  };

  useEffect(() => {
    Promise.all([listAgentAccounts(), listCountries()])
      .then(([a, c]) => {
        setAccounts(a);
        setCountries(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchMatrix()
      .then((m) => !cancelled && applyMatrix(m))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [fetchMatrix]);

  if (loading) return <PageLoading label="Loading Weight Markup..." />;

  const zoneKeys = zones.map((z) => `zone:${z}`);
  const countryKeys = sortScopes(
    scopes.filter((k) => k.startsWith("country:")),
    countryName,
  );
  const scopeKeys = ["all", ...zoneKeys, ...countryKeys];
  const current = scopeKeys.includes(editing) ? editing : "all";
  // A zone / country has its own prices when any band has a value for it.
  const hasValues = (key: string) => bands.some((b) => b.rates[key] != null && String(b.rates[key]).trim() !== "");
  const scopeLabel = (key: string) => {
    const [type, value] = key.split(":");
    return type === "zone" ? `Zone ${value}` : `${value} ${countryName(value)}`;
  };

  function setRate(i: number, key: string, value: string) {
    setBands((prev) => prev.map((b, j) => (j === i ? { ...b, rates: { ...b.rates, [key]: value === "" ? null : value } } : b)));
  }

  function addCountry(iso2: string) {
    if (!iso2) return;
    const key = `country:${iso2.toUpperCase()}`;
    if (!scopes.includes(key)) setScopes((prev) => [...prev, key]);
    setNewCountry("");
    setEditing(key);
  }

  // Copies the default prices into the zone / country being edited, as a starting point.
  function copyDefault() {
    setBands((prev) => prev.map((b) => ({ ...b, rates: { ...b.rates, [current]: b.rates.all ?? null } })));
  }

  // Clears this zone / country's own prices (back to the default); a country also loses its button.
  function clearScope(key: string) {
    setBands((prev) => prev.map((b) => ({ ...b, rates: Object.fromEntries(Object.entries(b.rates).filter(([k]) => k !== key)) })));
    if (key.startsWith("country:")) {
      setScopes((prev) => prev.filter((k) => k !== key));
      setEditing("all");
    }
  }

  async function handleSave() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = bands.map((b) => ({
        ...b,
        rates: Object.fromEntries(
          Object.entries(b.rates)
            .filter(([k]) => scopeKeys.includes(k))
            .map(([k, v]) => {
              const text = v == null ? "" : String(v).trim();
              return [k, text === "" ? null : isNumber(text) ? Number(text) : text];
            }),
        ),
      }));
      const res = await saveWeightMarkups({ carrier, package_type: packageType, agent_account_id: accountId }, payload);
      setAccountSets(res.account_sets);
      setBands(res.bands);
      setMessage("บันทึกแล้ว — มีผลกับราคาขาย (Check Rate / Create Shipment) ทันที");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSet() {
    if (accountId == null || !confirm("ลบชุดของบัญชีนี้? บัญชีจะกลับไปใช้ชุดกลางของ Carrier")) return;
    setBusy(true);
    try {
      await deleteWeightMarkupSet({ carrier, package_type: packageType, agent_account_id: accountId });
      applyMatrix(await fetchMatrix());
      setMessage("ลบแล้ว — บัญชีนี้ใช้ชุดกลางของ Carrier");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-1.5 text-sm font-semibold ${active ? "bg-brand-navy-dark text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"}`;

  return (
    <div>
      <PageHeader
        title="Weight Markup"
        description="บวกราคาขายตามช่วงน้ำหนัก (บาท/kg หรือสูตร เช่น {BASE}*5%) — คิดต่อจาก Fixed Charges + Mark-up ทั้งหมด แสดงเป็นบรรทัด Weight Markup ในใบเสนอราคา"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {CARRIERS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCarrier(c);
              setAccountId(null);
            }}
            className={tabClass(carrier === c)}
          >
            {c}
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-slate-200" />
        {TYPES.map((t) => (
          <button key={t.key} type="button" onClick={() => setPackageType(t.key)} className={tabClass(packageType === t.key)}>
            {t.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          ใช้กับ
          <select
            value={accountId ?? ""}
            onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : null)}
            className={`${fieldClass} w-64`}
          >
            <option value="">ทุกบัญชีของ {carrier} (ชุดกลาง)</option>
            {carrierAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.username_acc}
                {accountSets.includes(a.id) ? " • มีชุดของตัวเอง" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {!canEdit && (
          <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">ดูได้อย่างเดียว — ต้องมีสิทธิ์ &quot;Weight Markup: แก้ไข&quot; เพื่อเปลี่ยนราคา</p>
        )}
        {canEdit && usingCarrierSet && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            บัญชีนี้ยังใช้<strong>ชุดกลางของ {carrier}</strong> (ตารางด้านล่าง) — ถ้าแก้แล้วกดบันทึก จะกลายเป็นชุดเฉพาะของบัญชีนี้ ชุดกลางไม่เปลี่ยน
          </p>
        )}

        <fieldset disabled={!canEdit} className="min-w-0">
        {/* 1) pick what to price */}
        <div className="mb-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">1. เลือกราคาที่จะแก้</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {scopeKeys.map((key) => {
              const active = current === key;
              const label = key === "all" ? "ค่าปกติ (ทุก Zone)" : scopeLabel(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setEditing(key)}
                  className={`relative rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    active
                      ? "bg-brand-navy-dark text-white"
                      : key.startsWith("country:")
                        ? "border border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100"
                        : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {label}
                  {key !== "all" && hasValues(key) && (
                    <span className={`ml-1.5 inline-block h-2 w-2 rounded-full ${active ? "bg-brand-amber" : "bg-emerald-500"}`} title="มีราคาของตัวเอง" />
                  )}
                </button>
              );
            })}
            <select value={newCountry} onChange={(e) => addCountry(e.target.value)} className={`${fieldClass} ml-2 w-64`}>
              <option value="">+ ราคาพิเศษรายประเทศ…</option>
              {countries.map((c) => (
                <option key={c.iso2} value={c.iso2} disabled={scopes.includes(`country:${c.iso2}`)}>
                  {c.iso2} — {c.name}
                  {c[zoneColumn] ? ` (Zone ${c[zoneColumn]})` : ""}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            ● = Zone / ประเทศที่ตั้งราคาของตัวเองไว้ · ที่เหลือใช้ค่าปกติ · ลำดับ: รายประเทศ &gt; ราย Zone &gt; ค่าปกติ
          </p>
        </div>

        {/* 2) the bands for that choice */}
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <p className="text-sm font-semibold text-slate-700">
            2. ราคา{current === "all" ? "ค่าปกติ (ใช้กับทุก Zone ที่ไม่ได้ตั้งเอง)" : ` ${scopeLabel(current)}`}
          </p>
          {current !== "all" && (
            <>
              <button type="button" onClick={copyDefault} className="text-xs font-medium text-brand-navy hover:underline">
                คัดลอกจากค่าปกติ
              </button>
              {hasValues(current) || current.startsWith("country:") ? (
                <button type="button" onClick={() => clearScope(current)} className="text-xs font-medium text-red-600 hover:underline">
                  {current.startsWith("country:") ? "ลบราคาพิเศษของประเทศนี้" : "ล้างราคา Zone นี้ (กลับไปใช้ค่าปกติ)"}
                </button>
              ) : null}
            </>
          )}
        </div>
        <table className="w-full table-fixed text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="w-[18%] px-3 py-2 text-left font-medium">ตั้งแต่ (kg)</th>
              <th className="w-[18%] px-3 py-2 text-left font-medium">ถึง (kg) — ว่าง = ขึ้นไป</th>
              <th className="px-3 py-2 text-left font-medium">{current === "all" ? "ค่าปกติ" : scopeLabel(current)} — บาท/kg หรือสูตร</th>
              <th className="w-14" />
            </tr>
          </thead>
          <tbody>
            {bands.map((band, i) => {
              const cell = band.rates[current];
              const text = cell == null ? "" : String(cell);
              const formula = text.trim() !== "" && !isNumber(text);
              const fallback = band.rates.all == null || String(band.rates.all).trim() === "" ? "ไม่บวก" : String(band.rates.all);
              return (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 align-top">
                    <input
                      type="number"
                      step="0.01"
                      value={band.min_weight}
                      onChange={(e) => setBands((prev) => prev.map((b, j) => (j === i ? { ...b, min_weight: Number(e.target.value) } : b)))}
                      className={`${fieldClass} w-full`}
                    />
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    <input
                      type="number"
                      step="0.01"
                      value={band.max_weight ?? ""}
                      onChange={(e) =>
                        setBands((prev) => prev.map((b, j) => (j === i ? { ...b, max_weight: e.target.value === "" ? null : Number(e.target.value) } : b)))
                      }
                      className={`${fieldClass} w-full`}
                    />
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    <input
                      type="text"
                      value={text}
                      title={text}
                      placeholder={current === "all" ? "บาท/kg หรือสูตร" : `ใช้ค่าปกติ: ${fallback}`}
                      onChange={(e) => setRate(i, current, e.target.value)}
                      className={`${fieldClass} w-full ${formula ? "font-mono text-violet-700" : ""}`}
                    />
                    <div className="mt-0.5 text-[10px] text-slate-400">{formula ? "สูตร = บาท/Shipment" : text !== "" ? "บาท/kg" : ""}</div>
                  </td>
                  <td className="px-3 py-1.5 text-right align-top">
                    <button
                      type="button"
                      onClick={() => setBands((prev) => prev.filter((_, j) => j !== i))}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                      aria-label="ลบช่วง"
                      title="ลบช่วงน้ำหนักนี้ (ทุก Zone)"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              const last = bands[bands.length - 1];
              const min = last?.max_weight != null ? Number((last.max_weight + 0.01).toFixed(2)) : 0.1;
              setBands((prev) => [...prev, { min_weight: min, max_weight: null, rates: {} }]);
            }}
            className="flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline"
          >
            <Plus className="h-4 w-4" /> เพิ่มช่วงน้ำหนัก
          </button>
          <p className="mt-1 text-xs text-slate-400">ช่วงน้ำหนักใช้ร่วมกันทุก Zone — แก้ / เพิ่ม / ลบช่วง มีผลกับทุก Zone ในชุดนี้</p>
        </div>

        </fieldset>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="mb-1 font-semibold text-slate-700">ใส่ได้ 2 แบบในแต่ละช่อง</p>
          <p>
            <strong>ตัวเลข</strong> = บาท/kg × น้ำหนักที่ carrier คิดเงิน เช่น <code className="font-mono">15</code> (10 kg → 150 บาท)
          </p>
          <p className="mt-0.5">
            <strong>สูตร</strong> = ยอดบาทของทั้ง Shipment เช่น <code className="font-mono">{"{BASE}*5%"}</code>,{" "}
            <code className="font-mono">{"{W}*20"}</code>, <code className="font-mono">{"IF({W} > 10, {W}*15, 100)"}</code>,{" "}
            <code className="font-mono">{"{TOTAL}*3%"}</code>
          </p>
          <p className="mt-1 text-slate-500">
            ตัวแปร: <code className="font-mono">{"{BASE}"}</code> ค่าขนส่งของ carrier, <code className="font-mono">{"{375}"}</code> /{" "}
            <code className="font-mono">{"{FF}"}</code> ฯลฯ = ค่าตาม Charge Code (ต้นทุน carrier),{" "}
            <code className="font-mono">{"{TOTAL}"}</code> ยอดสุดท้ายของทุกบรรทัด (หลัง Fixed Charges + Mark-up ทั้งหมด), <code className="font-mono">{"{COST}"}</code> ต้นทุนรวมของ carrier, <code className="font-mono">{"{W}"}</code> น้ำหนักที่คิดเงิน,{" "}
            <code className="font-mono">{"{BOX}"}</code> จำนวนกล่อง, <code className="font-mono">{"{ZONE}"}</code> · ฟังก์ชันเดียวกับสูตร Fixed Charges (IF, MIN, MAX, ROUNDUP, BOX_OVER …)
          </p>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          ช่องว่างของ Zone / ประเทศ = ใช้ค่าปกติ · ใส่ 0 = ไม่บวกสำหรับ Zone / ประเทศนั้น ·
          ค่าปกติว่างหรือ 0 = ไม่บวก · ช่วงน้ำหนักชุดนี้ใช้เฉพาะ Weight Markup (ไม่เกี่ยวกับ Rate Book)
        </p>

        {(message || error) && <p className={`mt-3 text-sm ${error ? "text-red-600" : "text-emerald-600"}`}>{error || message}</p>}

        {canEdit && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {accountId != null && accountSets.includes(accountId) && (
            <button
              type="button"
              onClick={handleDeleteSet}
              disabled={busy}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              ลบชุดของบัญชีนี้ (กลับไปใช้ชุดกลาง)
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-brand-amber px-5 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {usingCarrierSet ? "บันทึกเป็นชุดของบัญชีนี้" : "บันทึก"}
          </button>
        </div>
        )}
      </div>
    </div>
  );
}
