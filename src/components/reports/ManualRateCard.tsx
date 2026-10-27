"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAccess } from "@/components/auth/AccessProvider";
import { getManualRateCards, manualCardPrice, saveManualRateCards, type ManualRateCard as Card } from "@/lib/rateBook";
import { listAgentAccounts, type AgentAccount } from "@/lib/agentAccounts";

const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const HEAD = "#1F4E79";
const cellBorder = "border border-slate-800";
const inputClass = "w-full rounded border border-slate-300 bg-white px-2 py-1 text-right text-sm outline-none focus:border-brand-navy";

/**
 * A hand-typed rate card (no API, e.g. SAGAWA → Japan) in the Rate Book — laid out like the brand's
 * own sheet, with a quick price check. For checking prices only; nothing is booked through it.
 */
export default function ManualRateCard({ cardKey }: { cardKey: string }) {
  const { can } = useAccess();
  const canEdit = can("report.rate_book_settings");
  const [cards, setCards] = useState<Card[] | null>(null);
  const [draft, setDraft] = useState<Card | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [weight, setWeight] = useState("");
  // Accounts to link the card to (who sees it in Check Rate follows the account's branches).
  const [accounts, setAccounts] = useState<AgentAccount[]>([]);

  useEffect(() => {
    getManualRateCards()
      .then((r) => setCards(r.cards))
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ"));
    if (canEdit) {
      listAgentAccounts()
        .then(setAccounts)
        .catch(() => {});
    }
  }, [canEdit]);

  const card = cards?.find((c) => c.key === cardKey) ?? null;
  if (error && !cards) return <p className="text-sm text-red-600">{error}</p>;
  if (!cards) {
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
      </p>
    );
  }
  if (!card) return <p className="py-6 text-sm text-slate-400">ไม่พบตารางราคา {cardKey}</p>;

  const shown = draft ?? card;
  const check = weight !== "" && Number(weight) > 0 ? manualCardPrice(card, Number(weight)) : null;

  async function save() {
    if (!draft || !cards) return;
    setSaving(true);
    setError("");
    try {
      const res = await saveManualRateCards(cards.map((c) => (c.key === draft.key ? draft : c)));
      setCards(res.cards);
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  const setStep = (i: number, patch: Partial<Card["steps"][number]>) =>
    setDraft((d) => d && { ...d, steps: d.steps.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const setBand = (i: number, patch: Partial<Card["per_kg"][number]>) =>
    setDraft((d) => d && { ...d, per_kg: d.per_kg.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
  const num = (v: string) => (v === "" ? 0 : Number(v));

  // Two columns of step prices, like the sheet.
  const half = Math.ceil(shown.steps.length / 2);
  const columns = [shown.steps.slice(0, half), shown.steps.slice(half)];

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            เช็คราคา น้ำหนัก
            <input
              type="number"
              min={0}
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="kg"
              className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            />
            kg
          </label>
          {check && (
            <p className="mt-1.5 text-sm">
              {check.price == null ? (
                <span className="text-red-600">ไม่มีราคาสำหรับน้ำหนักนี้</span>
              ) : (
                <>
                  <span className="text-lg font-bold text-slate-900">
                    {money(check.price)} {card.currency}
                  </span>
                  <span className="ml-2 text-xs text-slate-500">{check.how}</span>
                </>
              )}
            </p>
          )}
        </div>
        <p className="text-xs text-slate-400">
          ราคาที่พิมพ์เอง (ไม่มี API) — เช็คราคาได้ทั้งที่นี่และหน้า Create Shipment{card.country ? ` (ปลายทาง ${card.country})` : ""} แต่ไม่ออก Shipment ผ่านระบบ
        </p>
        {canEdit && !draft && (
          <button
            type="button"
            onClick={() => setDraft(structuredClone(card))}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4" /> แก้ไขราคา
          </button>
        )}
        {draft && (
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-brand-navy-dark px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        )}
      </div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="mb-2 flex items-center px-3 py-2 text-white" style={{ background: HEAD }}>
        <span className="text-3xl font-black">{shown.name.slice(0, 1)}</span>
        <span className="ml-3 text-lg font-bold">{shown.name}</span>
      </div>
      {draft ? (
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <label className="text-xs text-slate-500">
            ปลายทาง
            <input value={draft.destination} onChange={(e) => setDraft({ ...draft, destination: e.target.value })} className={`${inputClass} text-left`} />
          </label>
          <label className="text-xs text-slate-500 sm:col-span-3">
            บัญชี Agent — สาขาที่ติ๊กบัญชีนี้ (หน้า Branches) จึงเห็นราคาใน Check Rate
            <select
              value={draft.agent_account_id ?? ""}
              onChange={(e) => setDraft({ ...draft, agent_account_id: e.target.value ? Number(e.target.value) : null })}
              className={`${inputClass} text-left`}
            >
              <option value="">อัตโนมัติ (บัญชี SGW แรก)</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.agent?.agent_name ?? a.agent?.agent_code} · {a.username_acc}
                  {a.status ? "" : " (ปิดใช้งาน)"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            แสดงใน Check Rate เมื่อส่งไปประเทศ (ISO2, ว่าง = ไม่แสดง)
            <input
              value={draft.country ?? ""}
              maxLength={2}
              onChange={(e) => setDraft({ ...draft, country: e.target.value.toUpperCase() })}
              placeholder="JP"
              className={`${inputClass} text-left`}
            />
          </label>
          <label className="text-xs text-slate-500">
            หมายเหตุ / ช่วงเวลาที่ใช้
            <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className={`${inputClass} text-left`} />
          </label>
        </div>
      ) : (
        <p className="mb-2 text-center text-xl font-bold text-slate-900">
          {shown.note || `Rate to ${shown.destination}`}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {columns.map((col, ci) => (
          <table key={ci} className="w-full border-collapse self-start text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-white" style={{ background: HEAD }}>
                <th className={`${cellBorder} w-28 px-2 py-1`}>WEIGHT (KG)</th>
                <th className={`${cellBorder} px-2 py-1`}>PRICE {shown.currency}</th>
                {draft && <th className={`${cellBorder} w-8`} />}
              </tr>
            </thead>
            <tbody>
              {col.map((s, k) => {
                const i = ci * half + k;
                return (
                  <tr key={i}>
                    <td className={`${cellBorder} px-2 py-0.5 text-center text-white`} style={{ background: HEAD }}>
                      {draft ? (
                        <input type="number" step="0.5" value={s.weight} onChange={(e) => setStep(i, { weight: num(e.target.value) })} className={`${inputClass} text-center text-slate-800`} />
                      ) : (
                        s.weight.toFixed(1)
                      )}
                    </td>
                    <td className={`${cellBorder} px-2 py-0.5 text-center font-semibold`}>
                      {draft ? <input type="number" value={s.price} onChange={(e) => setStep(i, { price: num(e.target.value) })} className={inputClass} /> : money(s.price)}
                    </td>
                    {draft && (
                      <td className={`${cellBorder} text-center`}>
                        <button type="button" onClick={() => setDraft({ ...draft, steps: draft.steps.filter((_, x) => x !== i) })} className="p-1 text-red-500" aria-label="ลบ">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
      {draft && (
        <button
          type="button"
          onClick={() => {
            const last = draft.steps[draft.steps.length - 1]?.weight ?? 0;
            setDraft({ ...draft, steps: [...draft.steps, { weight: last >= 10 ? last + 1 : last + 0.5, price: 0 }] });
          }}
          className="mt-2 flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline"
        >
          <Plus className="h-4 w-4" /> เพิ่มน้ำหนัก
        </button>
      )}

      <p className="mb-1 mt-5 font-semibold text-slate-800">Price / Kg</p>
      <table className="w-full max-w-md border-collapse text-sm tabular-nums">
        <tbody>
          {shown.per_kg.map((b, i) => (
            <tr key={i}>
              <td className={`${cellBorder} w-44 px-2 py-1 font-semibold text-white`} style={{ background: HEAD }}>
                {draft ? (
                  <span className="flex items-center gap-1">
                    <input type="number" value={b.min} onChange={(e) => setBand(i, { min: num(e.target.value) })} className={`${inputClass} text-slate-800`} />–
                    <input
                      type="number"
                      value={b.max ?? ""}
                      placeholder="ขึ้นไป"
                      onChange={(e) => setBand(i, { max: e.target.value === "" ? null : Number(e.target.value) })}
                      className={`${inputClass} text-slate-800`}
                    />
                  </span>
                ) : b.max == null ? (
                  `${b.min} Kg Up`
                ) : (
                  `${b.min} - ${b.max} Kg`
                )}
              </td>
              <td className={`${cellBorder} px-2 py-1 text-center font-semibold`}>
                {draft ? <input type="number" value={b.price} onChange={(e) => setBand(i, { price: num(e.target.value) })} className={inputClass} /> : money(b.price)}
              </td>
              {draft && (
                <td className={`${cellBorder} w-8 text-center`}>
                  <button type="button" onClick={() => setDraft({ ...draft, per_kg: draft.per_kg.filter((_, x) => x !== i) })} className="p-1 text-red-500" aria-label="ลบ">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {draft && (
        <button
          type="button"
          onClick={() => {
            const last = draft.per_kg[draft.per_kg.length - 1];
            const min = last ? (last.max ?? last.min) + 1 : (draft.steps[draft.steps.length - 1]?.weight ?? 20) + 1;
            setDraft({ ...draft, per_kg: [...draft.per_kg, { min, max: null, price: 0 }] });
          }}
          className="mt-2 flex items-center gap-1 text-sm font-medium text-brand-navy hover:underline"
        >
          <Plus className="h-4 w-4" /> เพิ่มช่วงราคาต่อ kg
        </button>
      )}
    </div>
  );
}
