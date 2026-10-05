"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, GitBranch, Loader2, Plus, Search, X } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import { invalidateChargeDisplayNames } from "@/hooks/useChargeDisplayNames";
import {
  addChargeDisplayName,
  CHARGE_DISPLAY_RULE_OPERATORS,
  listChargeCodes,
  updateChargeDisplayName,
  type ChargeCode,
  type ChargeDisplayRule,
} from "@/lib/chargeCodes";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";

type Carrier = "UPS" | "DHL";

const CARRIERS: Carrier[] = ["UPS", "DHL"];

// Formula-only variables (see SpecialFormulaChargeCodeSeeder) — never a real charge line, so
// there's nothing to rename.
const FORMULA_ONLY_CODES = ["BILLED_WEIGHT", "TOTAL", "W", "BOX"];

const EMPTY_RULE: ChargeDisplayRule = { code: "", op: ">", value: 0, name: "" };

function describeRule(rule: ChargeDisplayRule) {
  return `IF {${rule.code}} ${rule.op} ${rule.value} → ${rule.name}`;
}

export default function ChargeDisplayNamesPage() {
  const [codes, setCodes] = useState<ChargeCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState<Carrier>("UPS");
  const [namedOnly, setNamedOnly] = useState(false);
  // Unsaved edits per charge code id; a row is "dirty" while its draft differs from what's saved.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newCode, setNewCode] = useState({ code: "", label: "", display_name: "" });
  const [adding, setAdding] = useState(false);
  // Conditional-name editor (IF {code} op value → name), open under one row at a time.
  const [ruleEditId, setRuleEditId] = useState<number | null>(null);
  const [ruleDraft, setRuleDraft] = useState<ChargeDisplayRule>(EMPTY_RULE);

  useEffect(() => {
    listChargeCodes()
      .then(setCodes)
      .catch((err) => setError(err instanceof Error ? err.message : "โหลด Charge Code ไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  function applySaved(updated: ChargeCode) {
    setCodes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[updated.id];
      return next;
    });
    invalidateChargeDisplayNames();
  }

  async function save(code: ChargeCode, value: string) {
    if (value.trim() === (code.display_name ?? "")) return;
    setSavingId(code.id);
    setError("");
    try {
      applySaved(await updateChargeDisplayName(code.id, { display_name: value.trim() || null }));
      setSavedId(code.id);
      setTimeout(() => setSavedId((id) => (id === code.id ? null : id)), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingId(null);
    }
  }

  function openRuleEditor(code: ChargeCode) {
    setRuleEditId(code.id);
    // Default the checked code to the row's own code — the common case is "this charge's own amount".
    setRuleDraft(code.display_rule ?? { ...EMPTY_RULE, code: code.code });
  }

  async function saveRule(code: ChargeCode, rule: ChargeDisplayRule | null) {
    setSavingId(code.id);
    setError("");
    try {
      const name = drafts[code.id] ?? code.display_name ?? "";
      applySaved(await updateChargeDisplayName(code.id, { display_name: name.trim() || null, display_rule: rule }));
      setRuleEditId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกเงื่อนไขไม่สำเร็จ");
    } finally {
      setSavingId(null);
    }
  }

  async function handleAdd() {
    setAdding(true);
    setError("");
    try {
      const created = await addChargeDisplayName({
        provider,
        code: newCode.code.trim(),
        label: newCode.label.trim() || undefined,
        display_name: newCode.display_name.trim(),
      });
      setCodes((prev) => [...prev, created]);
      setNewCode({ code: "", label: "", display_name: "" });
      setShowAdd(false);
      invalidateChargeDisplayNames();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เพิ่ม Code ไม่สำเร็จ");
    } finally {
      setAdding(false);
    }
  }

  const term = search.trim().toLowerCase();
  const renamable = codes.filter((c) => !FORMULA_ONLY_CODES.includes(c.code));
  const isNamed = (c: ChargeCode) => !!(c.display_name || c.display_rule);
  const visible = renamable
    .filter((c) => c.provider === provider)
    .filter((c) => !namedOnly || c.display_name || c.display_rule)
    .filter(
      (c) =>
        !term ||
        c.code.toLowerCase().includes(term) ||
        c.label.toLowerCase().includes(term) ||
        (c.display_name ?? "").toLowerCase().includes(term)
    )
    // Already-named codes first, then pinned ones (the handful used daily), then by code.
    .sort(
      (a, b) =>
        Number(isNamed(b)) - Number(isNamed(a)) ||
        Number(b.is_pinned) - Number(a.is_pinned) ||
        a.code.localeCompare(b.code, undefined, { numeric: true })
    );
  const namedCount = renamable.filter((c) => c.provider === provider && isNamed(c)).length;

  return (
    <div>
      <PageHeader
        title="Charge Display Names"
        description="ตั้งชื่อแสดงของแต่ละ Charge Code เอง (เช่น BASE → ค่าขนส่ง) — ใช้แทนชื่อจาก Carrier ทุกหน้าที่แสดงรายการค่าบริการ และเป็นชื่อบรรทัดเริ่มต้นของใบเสร็จ / ใบกำกับภาษีที่ออกใหม่ (เอกสารที่ออกไปแล้วไม่เปลี่ยน)"
      />

      {loading ? (
        <PageLoading label="Loading Charge Codes..." />
      ) : (
        <>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200">
            {CARRIERS.map((carrier) => {
              const total = renamable.filter((c) => c.provider === carrier).length;
              const named = renamable.filter((c) => c.provider === carrier && isNamed(c)).length;
              return (
                <button
                  key={carrier}
                  type="button"
                  onClick={() => {
                    setProvider(carrier);
                    setRuleEditId(null);
                  }}
                  className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
                    provider === carrier ? "border-brand-navy text-brand-navy" : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {carrier}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-normal text-slate-500">
                    {named > 0 ? `${named} / ${total}` : total}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Code, ชื่อจาก Carrier, ชื่อที่ตั้งเอง..."
                  className={`${inputClass} pl-9`}
                />
              </div>
            </label>
            <label className="flex items-center gap-2 py-1.5 text-sm text-slate-600">
              <input type="checkbox" checked={namedOnly} onChange={(e) => setNamedOnly(e.target.checked)} />
              เฉพาะที่ตั้งชื่อแล้ว ({namedCount})
            </label>
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              เพิ่ม Code {provider} ที่ไม่มีในรายการ
            </button>
          </div>

          {showAdd && (
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
              <span className="py-1.5 text-sm font-semibold text-slate-600">{provider}</span>
              <label className="flex w-28 flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-600">Code</span>
                <input value={newCode.code} onChange={(e) => setNewCode({ ...newCode, code: e.target.value })} placeholder="เช่น YK" className={inputClass} />
              </label>
              <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-600">ชื่อจาก Carrier (ไม่บังคับ)</span>
                <input value={newCode.label} onChange={(e) => setNewCode({ ...newCode, label: e.target.value })} placeholder="เช่น 12:00 Premium" className={inputClass} />
              </label>
              <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-600">Display Name</span>
                <input
                  value={newCode.display_name}
                  onChange={(e) => setNewCode({ ...newCode, display_name: e.target.value })}
                  placeholder="ชื่อที่ต้องการแสดง"
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={handleAdd}
                disabled={adding || !newCode.code.trim() || !newCode.display_name.trim()}
                className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
              >
                {adding ? "Saving..." : "เพิ่ม"}
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Code</th>
                  <th className="px-5 py-2.5 font-medium">ชื่อจาก Carrier</th>
                  <th className="w-[40%] px-5 py-2.5 font-medium">Display Name</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-6 text-center text-sm text-slate-400">
                      ไม่พบ Charge Code
                    </td>
                  </tr>
                ) : (
                  visible.map((c) => {
                    const value = drafts[c.id] ?? c.display_name ?? "";
                    const dirty = value.trim() !== (c.display_name ?? "");
                    return (
                      <Fragment key={c.id}>
                      <tr className="border-b border-slate-200 last:border-0">
                        <td className="px-5 py-2 font-mono text-slate-700">{c.code}</td>
                        <td className="px-5 py-2 text-slate-500">{c.label}</td>
                        <td className="px-5 py-2">
                          <div className="flex items-center gap-2">
                            <input
                              value={value}
                              onChange={(e) => setDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                              onBlur={() => save(c, value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") {
                                  setDrafts((prev) => ({ ...prev, [c.id]: c.display_name ?? "" }));
                                }
                              }}
                              placeholder="ใช้ชื่อจาก Carrier"
                              className={`${inputClass} ${dirty ? "border-amber-400" : ""}`}
                            />
                            <span className="flex w-5 shrink-0 justify-center">
                              {savingId === c.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                              ) : savedId === c.id ? (
                                <Check className="h-4 w-4 text-emerald-500" />
                              ) : c.display_name && !dirty ? (
                                <button type="button" title="ล้างชื่อ (กลับไปใช้ชื่อจาก Carrier)" onClick={() => save(c, "")}>
                                  <X className="h-4 w-4 text-slate-300 hover:text-red-500" />
                                </button>
                              ) : null}
                            </span>
                            <button
                              type="button"
                              onClick={() => (ruleEditId === c.id ? setRuleEditId(null) : openRuleEditor(c))}
                              title="ตั้งเงื่อนไขชื่อ (IF)"
                              className={`flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${
                                c.display_rule ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 text-slate-500 hover:bg-slate-50"
                              }`}
                            >
                              <GitBranch className="h-3.5 w-3.5" />
                              IF
                            </button>
                          </div>
                          {c.display_rule && ruleEditId !== c.id && (
                            <p className="mt-1 font-mono text-[11px] text-emerald-700">
                              {describeRule(c.display_rule)} · ELSE → {c.display_name || c.label}
                            </p>
                          )}
                        </td>
                      </tr>
                      {ruleEditId === c.id && (
                        <tr className="border-b border-slate-200 bg-emerald-50/40">
                          <td colSpan={3} className="px-5 py-3">
                            <div className="flex flex-wrap items-end gap-2 text-sm">
                              <span className="py-1.5 font-semibold text-slate-600">IF</span>
                              <label className="flex w-24 flex-col gap-1">
                                <span className="text-xs text-slate-500">Code ที่ใช้เช็ค</span>
                                <input
                                  value={ruleDraft.code}
                                  onChange={(e) => setRuleDraft({ ...ruleDraft, code: e.target.value })}
                                  placeholder="เช่น 190"
                                  className={`${inputClass} font-mono`}
                                />
                              </label>
                              <label className="flex w-20 flex-col gap-1">
                                <span className="text-xs text-slate-500">เงื่อนไข</span>
                                <select
                                  value={ruleDraft.op}
                                  onChange={(e) => setRuleDraft({ ...ruleDraft, op: e.target.value as ChargeDisplayRule["op"] })}
                                  className={inputClass}
                                >
                                  {CHARGE_DISPLAY_RULE_OPERATORS.map((op) => (
                                    <option key={op} value={op}>
                                      {op}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="flex w-24 flex-col gap-1">
                                <span className="text-xs text-slate-500">ค่า (THB)</span>
                                <input
                                  type="number"
                                  value={ruleDraft.value}
                                  onChange={(e) => setRuleDraft({ ...ruleDraft, value: Number(e.target.value) })}
                                  className={inputClass}
                                />
                              </label>
                              <span className="py-1.5 font-semibold text-slate-600">→</span>
                              <label className="flex min-w-[180px] flex-1 flex-col gap-1">
                                <span className="text-xs text-slate-500">ชื่อเมื่อเงื่อนไขเป็นจริง</span>
                                <input
                                  value={ruleDraft.name}
                                  onChange={(e) => setRuleDraft({ ...ruleDraft, name: e.target.value })}
                                  placeholder="เช่น BBBBB"
                                  className={inputClass}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => saveRule(c, ruleDraft)}
                                disabled={savingId === c.id || !ruleDraft.code.trim() || !ruleDraft.name.trim()}
                                className="rounded-lg bg-brand-navy-dark px-3 py-1.5 font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
                              >
                                บันทึก
                              </button>
                              {c.display_rule && (
                                <button
                                  type="button"
                                  onClick={() => saveRule(c, null)}
                                  disabled={savingId === c.id}
                                  className="rounded-lg border border-red-200 px-3 py-1.5 font-medium text-red-600 hover:bg-red-50"
                                >
                                  ลบเงื่อนไข
                                </button>
                              )}
                              <button type="button" onClick={() => setRuleEditId(null)} className="px-2 py-1.5 text-slate-500 hover:text-slate-700">
                                ยกเลิก
                              </button>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              ถ้ายอดของ Code {ruleDraft.code || "…"} ใน Quote เดียวกัน {ruleDraft.op} {ruleDraft.value} → แสดง &quot;{ruleDraft.name || "…"}&quot;
                              · ไม่เข้าเงื่อนไข → แสดง &quot;{(drafts[c.id] ?? c.display_name) || c.label}&quot; (Code ที่ไม่มีใน Quote ถือว่า = 0)
                            </p>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">พิมพ์แล้วกด Enter หรือคลิกออกเพื่อบันทึก · Esc เพื่อยกเลิก · ปล่อยว่างเพื่อใช้ชื่อจาก Carrier</p>
        </>
      )}
    </div>
  );
}
