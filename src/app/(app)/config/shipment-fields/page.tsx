"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import { getShipmentFieldRules, saveShipmentFieldRules, type ShipmentFieldRules } from "@/lib/shipmentFields";

const STEP_LABEL: Record<number, string> = {
  1: "Ship Info",
  2: "Product & Rate",
  3: "Commercial Invoice",
  4: "Add On",
  5: "Payment Info",
};

export default function ShipmentFieldsPage() {
  const [config, setConfig] = useState<ShipmentFieldRules | null>(null);
  const [rules, setRules] = useState<Record<string, string[]>>({});
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getShipmentFieldRules()
      .then((res) => {
        if (cancelled) return;
        setConfig(res);
        setRules(res.rules);
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : "โหลดการตั้งค่าไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    if (!config) return [];
    return Object.entries(config.groups)
      .map(([key, label]) => ({ key, label, fields: config.fields.filter((f) => f.group === key) }))
      .filter((g) => g.fields.length);
  }, [config]);

  const dirty = !!config && JSON.stringify(config.rules) !== JSON.stringify(rules);

  function toggle(carrier: string, key: string) {
    setMessage(null);
    setRules((prev) => {
      const list = prev[carrier] ?? [];
      return { ...prev, [carrier]: list.includes(key) ? list.filter((k) => k !== key) : [...list, key] };
    });
  }

  function toggleGroup(carrier: string, keys: string[], on: boolean) {
    setMessage(null);
    setRules((prev) => {
      const list = (prev[carrier] ?? []).filter((k) => !keys.includes(k));
      return { ...prev, [carrier]: on ? [...list, ...keys] : list };
    });
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await saveShipmentFieldRules(rules);
      setConfig(res);
      setRules(res.rules);
      setMessage({ ok: true, text: "บันทึกแล้ว — มีผลกับการจองครั้งถัดไปทันที" });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "บันทึกไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>;
  if (!config) return <PageLoading />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Shipment Required Fields"
        description="กำหนดช่องที่ต้องกรอกก่อนจอง Shipment แยกตาม Carrier — ระบบเช็คทั้งบนหน้าจอและตอนส่งจองจริง"
      />

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">ช่องข้อมูล</th>
                <th className="px-4 py-3">อยู่ในขั้นตอน</th>
                {config.carriers.map((c) => (
                  <th key={c} className="w-28 px-4 py-3 text-center">
                    {c}
                    <span className="ml-1 font-normal normal-case text-slate-400">({(rules[c] ?? []).length})</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const keys = g.fields.map((f) => f.key);
                return [
                  <tr key={`g-${g.key}`} className="border-b border-slate-100 bg-slate-50/60">
                    <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-slate-700">
                      {g.label}
                    </td>
                    {config.carriers.map((c) => {
                      const all = keys.every((k) => (rules[c] ?? []).includes(k));
                      return (
                        <td key={c} className="px-4 py-2 text-center">
                          <button type="button" onClick={() => toggleGroup(c, keys, !all)} className="text-[11px] font-medium text-brand-navy hover:underline">
                            {all ? "ไม่บังคับทั้งหมด" : "บังคับทั้งหมด"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>,
                  ...g.fields.map((f) => (
                    <tr key={f.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-800">{f.label}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">
                        {f.step}. {STEP_LABEL[f.step]}
                      </td>
                      {config.carriers.map((c) => (
                        <td key={c} className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            aria-label={`${c}: ${f.label}`}
                            checked={(rules[c] ?? []).includes(f.key)}
                            onChange={() => toggle(c, f.key)}
                            className="h-4 w-4 cursor-pointer accent-brand-amber"
                          />
                        </td>
                      ))}
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">
            ช่องที่ Carrier บังคับอยู่แล้ว (ที่อยู่ผู้ส่ง, ประเทศ / เมืองผู้รับ, น้ำหนัก ฯลฯ) ไม่อยู่ในรายการนี้ — ระบบบังคับให้เสมอ
          </p>
          <div className="flex items-center gap-3">
            {message && <span className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              บันทึก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
