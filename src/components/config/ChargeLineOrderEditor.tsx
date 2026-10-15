"use client";

import SearchPicker from "@/components/ui/SearchPicker";
import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, GripVertical, Loader2, Save, X } from "lucide-react";
import { invalidateChargeLineOrder } from "@/hooks/useChargeLineOrder";
import type { ChargeCode } from "@/lib/chargeCodes";
import {
  OWN_LINE_CODES,
  getChargeLineOrder,
  saveChargeLineOrder,
  type ChargeLineOrderItem,
  type ChargeLinePin,
} from "@/lib/chargeLineOrder";

// A sensible start: our per-kg price, freight, fuel, surcharges, our markup lines, Total last.
const SUGGESTED: Record<string, ChargeLineOrderItem[]> = {
  UPS: [
    { code: "HEAVY_RATE", pin: null },
    { code: "BASE", pin: null },
    { code: "375", pin: null },
    { code: "434", pin: null },
    { code: "190", pin: null },
    { code: "WEIGHT_MARKUP", pin: null },
    { code: "TOTAL", pin: "bottom" },
  ],
  DHL: [
    { code: "HEAVY_RATE", pin: null },
    { code: "BASE", pin: null },
    { code: "FF", pin: null },
    { code: "NX", pin: null },
    { code: "OF", pin: null },
    { code: "FD", pin: null },
    { code: "WEIGHT_MARKUP", pin: null },
    { code: "TOTAL", pin: "bottom" },
  ],
};

const PIN_RANK = (pin: ChargeLinePin) => (pin === "top" ? 0 : pin === "bottom" ? 2 : 1);
// Pinned-top first, pinned-bottom last — the list always reads in the order quotes will show.
const grouped = (items: ChargeLineOrderItem[]) =>
  items.map((item, i) => ({ item, i })).sort((a, b) => PIN_RANK(a.item.pin) - PIN_RANK(b.item.pin) || a.i - b.i).map((x) => x.item);

type Props = { provider: "UPS" | "DHL"; codes: ChargeCode[]; canEdit?: boolean };

/** /config/charge-names → the order charge lines are listed in on a quote (drag, or pin top / bottom). */
export default function ChargeLineOrderEditor({ provider, codes, canEdit = true }: Props) {
  const [all, setAll] = useState<Record<string, ChargeLineOrderItem[]>>({});
  const [items, setItems] = useState<ChargeLineOrderItem[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    getChargeLineOrder()
      .then((o) => {
        if (!active) return;
        setAll(o);
        setItems(grouped(o[provider] ?? []));
        setMessage(null);
      })
      .catch((e) => active && setMessage({ ok: false, text: e instanceof Error ? e.message : "โหลดไม่สำเร็จ" }));
    return () => {
      active = false;
    };
  }, [provider]);

  const nameOf = (code: string) => {
    const own = OWN_LINE_CODES.find((c) => c.code === code);
    if (own) return own.label;
    const c = codes.find((x) => x.provider === provider && x.code === code);
    return c ? c.display_name || c.label : code;
  };
  const listed = new Set(items.map((i) => i.code));
  const addable = [
    ...OWN_LINE_CODES.map((c) => ({ code: c.code, label: c.label })),
    ...codes
      .filter((c) => c.provider === provider && !["BILLED_WEIGHT", "TOTAL", "COST", "W", "BOX"].includes(c.code))
      .map((c) => ({ code: c.code, label: c.display_name || c.label })),
  ].filter((c) => !listed.has(c.code));
  const dirty = JSON.stringify(grouped(all[provider] ?? [])) !== JSON.stringify(items);

  const update = (next: ChargeLineOrderItem[]) => {
    setMessage(null);
    setItems(grouped(next));
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    // Takes the place — and the top / bottom group — of the line it lands on, so it stays where it was put.
    const target = items[to];
    const next = items.filter((_, i) => i !== from);
    next.splice(to, 0, { ...items[from], pin: target.pin });
    update(next);
  };

  async function handleSave() {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await saveChargeLineOrder(provider, items);
      setAll(saved);
      setItems(grouped(saved[provider] ?? []));
      invalidateChargeLineOrder();
      setMessage({ ok: true, text: "บันทึกแล้ว — การ์ดราคาจะเรียงตามนี้เมื่อเปิดหน้าใหม่" });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">ลำดับการแสดงในการ์ดราคา ({provider})</h2>
          <p className="text-xs text-slate-400">
            ลากเรียงตามต้องการ · ปักหมุด &quot;บนสุดเสมอ&quot; / &quot;ล่างสุดเสมอ&quot; ได้ · Code ที่ไม่อยู่ในรายการจะต่อท้ายตามลำดับจาก Carrier
            (ก่อนกลุ่มล่างสุดเสมอ) · มีผลแค่การแสดง ไม่เปลี่ยนยอดเงิน
          </p>
        </div>
        {canEdit && items.length === 0 && (
          <button
            type="button"
            onClick={() => update(SUGGESTED[provider])}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            เริ่มจากลำดับแนะนำ
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
          ยังไม่ได้กำหนด — การ์ดราคาแสดงตามลำดับที่ Carrier ส่งมา
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li
              key={item.code}
              draggable={canEdit}
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(i);
              }}
              onDragLeave={() => setOverIndex((o) => (o === i ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) move(dragIndex, i);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
                dragIndex === i ? "opacity-40" : ""
              } ${overIndex === i && dragIndex !== i ? "border-brand-amber bg-amber-50" : item.pin ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}
            >
              <GripVertical className={`h-4 w-4 shrink-0 text-slate-300 ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`} />
              <span className="w-6 text-right text-xs tabular-nums text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                {nameOf(item.code)} <span className="font-mono text-xs text-slate-400">({item.code})</span>
              </span>
              {item.pin && (
                <span className="flex items-center gap-1 rounded-full bg-brand-amber/15 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  {item.pin === "top" ? <ArrowUpToLine className="h-3 w-3" /> : <ArrowDownToLine className="h-3 w-3" />}
                  {item.pin === "top" ? "บนสุดเสมอ" : "ล่างสุดเสมอ"}
                </span>
              )}
              {canEdit && (
                <>
                  <select
                    value={item.pin ?? ""}
                    onChange={(e) => update(items.map((x) => (x.code === item.code ? { ...x, pin: (e.target.value || null) as ChargeLinePin } : x)))}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                    aria-label="ตำแหน่ง"
                  >
                    <option value="">ปกติ</option>
                    <option value="top">บนสุดเสมอ</option>
                    <option value="bottom">ล่างสุดเสมอ</option>
                  </select>
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30" aria-label="ขึ้น">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, i + 1)}
                    disabled={i === items.length - 1}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                    aria-label="ลง"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => update(items.filter((x) => x.code !== item.code))}
                    className="rounded p-1 text-red-400 hover:bg-red-50"
                    aria-label="เอาออกจากรายการ"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <SearchPicker
            options={addable.map((c) => ({ value: c.code, label: c.label }))}
            onPick={(code) => update([...items, { code, pin: null }])}
            placeholder="+ ค้นหา Code หรือชื่อเพื่อเพิ่ม… (เช่น fuel, 190)"
            openUp
          />
          <div className="flex items-center gap-3">
            {message && <span className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>{message.text}</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || busy}
              className="flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              บันทึกลำดับ
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
