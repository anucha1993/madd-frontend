"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
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

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";

const CARRIERS: WeightMarkupCarrier[] = ["UPS", "DHL"];
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
  const [newScopeType, setNewScopeType] = useState<"zone" | "country">("zone");
  const [newScopeValue, setNewScopeValue] = useState("");

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

  const orderedScopes = sortScopes(scopes, countryName);
  const scopeLabel = (key: string) => {
    const [type, value] = key.split(":");
    return type === "zone" ? `Zone ${value}` : `${value} ${countryName(value)}`;
  };

  function setRate(i: number, key: string, value: string) {
    setBands((prev) => prev.map((b, j) => (j === i ? { ...b, rates: { ...b.rates, [key]: value === "" ? null : Number(value) } } : b)));
  }

  function addScope() {
    const value = newScopeValue.trim().toUpperCase();
    if (!value) return;
    const key = `${newScopeType}:${value}`;
    if (!scopes.includes(key)) setScopes((prev) => [...prev, key]);
    setNewScopeValue("");
  }

  function removeScope(key: string) {
    setScopes((prev) => prev.filter((k) => k !== key));
    setBands((prev) => prev.map((b) => ({ ...b, rates: Object.fromEntries(Object.entries(b.rates).filter(([k]) => k !== key)) })));
  }

  async function handleSave() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const payload = bands.map((b) => ({
        ...b,
        rates: Object.fromEntries(Object.entries(b.rates).filter(([k]) => k === "all" || scopes.includes(k))),
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
        description="บวกราคาขายเป็นบาท/kg ตามช่วงน้ำหนัก — คิดต่อจาก Fixed Charges + Mark-up ทั้งหมด แสดงเป็นบรรทัด Weight Markup ในใบเสนอราคา"
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
            className={`${inputClass} w-64`}
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">ตั้งแต่ (kg)</th>
                <th className="px-3 py-2 text-left font-medium">ถึง (kg) — ว่าง = ขึ้นไป</th>
                <th className="px-3 py-2 text-left font-medium">ทุกประเทศ (บาท/kg)</th>
                {orderedScopes.map((key) => (
                  <th key={key} className="px-3 py-2 text-left font-medium">
                    <span className="inline-flex items-center gap-1">
                      {scopeLabel(key)}
                      <button type="button" onClick={() => removeScope(key)} className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-red-500" aria-label="ลบคอลัมน์">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {bands.map((band, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={band.min_weight}
                      onChange={(e) => setBands((prev) => prev.map((b, j) => (j === i ? { ...b, min_weight: Number(e.target.value) } : b)))}
                      className={`${inputClass} w-24`}
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      step="0.01"
                      value={band.max_weight ?? ""}
                      onChange={(e) =>
                        setBands((prev) => prev.map((b, j) => (j === i ? { ...b, max_weight: e.target.value === "" ? null : Number(e.target.value) } : b)))
                      }
                      className={`${inputClass} w-24`}
                    />
                  </td>
                  {["all", ...orderedScopes].map((key) => (
                    <td key={key} className="px-3 py-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={band.rates[key] ?? ""}
                        placeholder={key === "all" ? "0" : "ใช้ค่าปกติ"}
                        onChange={(e) => setRate(i, key, e.target.value)}
                        className={`${inputClass} w-28`}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => setBands((prev) => prev.filter((_, j) => j !== i))}
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

        <div className="mt-3 flex flex-wrap items-center gap-3">
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
          <span className="mx-1 h-6 w-px bg-slate-200" />
          <span className="text-sm text-slate-600">เพิ่มคอลัมน์ราคาพิเศษ:</span>
          <select value={newScopeType} onChange={(e) => { setNewScopeType(e.target.value as "zone" | "country"); setNewScopeValue(""); }} className={`${inputClass} w-28`}>
            <option value="zone">ราย Zone</option>
            <option value="country">รายประเทศ</option>
          </select>
          <select value={newScopeValue} onChange={(e) => setNewScopeValue(e.target.value)} className={`${inputClass} w-56`}>
            <option value="">— เลือก —</option>
            {newScopeType === "zone"
              ? zones.map((z) => (
                  <option key={z} value={z}>
                    Zone {z}
                  </option>
                ))
              : countries.map((c) => (
                  <option key={c.iso2} value={c.iso2}>
                    {c.iso2} — {c.name}
                    {c[zoneColumn] ? ` (Zone ${c[zoneColumn]})` : ""}
                  </option>
                ))}
          </select>
          <button type="button" onClick={addScope} disabled={!newScopeValue} className="flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline disabled:opacity-40">
            <Plus className="h-4 w-4" /> เพิ่ม
          </button>
        </div>

        </fieldset>

        <p className="mt-4 text-xs text-slate-400">
          คิดเงิน = บาท/kg × น้ำหนักที่ carrier คิดเงิน · ลำดับการใช้: รายประเทศ &gt; ราย Zone &gt; ทุกประเทศ · ช่องว่างในคอลัมน์ราคาพิเศษ = ใช้ค่าปกติ ·
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
