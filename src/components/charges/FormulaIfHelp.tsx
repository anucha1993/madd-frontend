"use client";

import { useState } from "react";
import { ChevronDown, GitBranch } from "lucide-react";

// What the backend ChargeFormulaEvaluator accepts on top of + - * / ( ) % — shared by Markup
// Rules (/config/markup) and Fixed Charges (/config/agent-accounts).
const EXAMPLES: { title: string; formula: string; note: string }[] = [
  {
    title: "Remote (190)",
    formula: "IF({190} > 0, IF({W} > 1 & {W} <= 26, 800, IF({W} > 26, 30 * {W}, {190})), 0)",
    note: "ถ้ามี 190 ใน Quote: 1–26 kg คิด 800 THB, เกิน 26 kg คิด 30 THB × kg — ไม่มี 190 = 0",
  },
  {
    title: "คิดตามน้ำหนักเฉพาะกล่องที่เกิน",
    formula: "IF(BOX_OVER(30) > 0, 30 * BOX_KG_OVER(30), 0)",
    note: "กล่อง 20 kg + 33 kg → คิดแค่กล่อง 33 kg: 30 × 33 = 990 THB (ไม่ใช่น้ำหนักรวม 53 kg)",
  },
  {
    title: "AHC Loop Box (100)",
    formula: "IF(BOX_OVER(30) > 0, 1200 * BOX_OVER(30), {100})",
    note: "1,200 THB × จำนวนกล่องที่หนักเกิน 30 kg — ไม่มีกล่องเกิน = ใช้ยอดเดิมของ Carrier",
  },
];

export default function FormulaIfHelp({ onInsert }: { onInsert?: (formula: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 text-xs text-slate-600">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-1.5 px-3 py-2 font-medium text-emerald-700">
        <GitBranch className="h-3.5 w-3.5" />
        สูตรแบบมีเงื่อนไข (IF)
        <ChevronDown className={`ml-auto h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-emerald-200 px-3 py-2">
          <ul className="list-disc space-y-0.5 pl-4">
            <li>
              <code className="font-mono">IF(เงื่อนไข, ค่าเมื่อจริง, ค่าเมื่อไม่จริง)</code> — ซ้อน IF ได้, ไม่ใส่ค่าเมื่อไม่จริง = 0
            </li>
            <li>
              เปรียบเทียบ <code className="font-mono">&gt; &gt;= &lt; &lt;= = &lt;&gt;</code> · และ <code className="font-mono">&amp;</code> /{" "}
              <code className="font-mono">AND</code> · หรือ <code className="font-mono">|</code> / <code className="font-mono">OR</code>
            </li>
            <li>
              <code className="font-mono">{"{W}"}</code> = น้ำหนักที่คิดเงิน (kg) · <code className="font-mono">{"{BOX}"}</code> = จำนวนกล่อง ·{" "}
              <code className="font-mono">BOX_OVER(30)</code> = จำนวนกล่องที่หนักเกิน 30 kg
            </li>
            <li>
              <code className="font-mono">BOX_KG_OVER(30)</code> = น้ำหนักรวม<b>เฉพาะกล่องที่หนักเกิน</b> 30 kg (คนละอย่างกับ{" "}
              <code className="font-mono">{"{W}"}</code> ที่เป็นน้ำหนักทั้ง Shipment)
            </li>
            <li>
              <code className="font-mono">{"{ZONE_PRICE}"}</code> = ราคาที่ตั้งเองตาม Zone ของประเทศปลายทาง สำหรับ Code ที่กำลังคำนวณ (หน้า Countries → ราคาตาม Zone) ·{" "}
              <code className="font-mono">{"{ZONE}"}</code> = เลข Zone ที่ตั้งเอง — ปลายทางที่ไม่มีราคา จะใช้ราคาจาก API
            </li>
            <li>
              ในเงื่อนไขของ IF, Charge Code ที่ไม่มีใน Quote ถือว่า = 0 · ใส่หน่วยหลังตัวเลขได้ เช่น 26kg, 800THB
            </li>
            <li>
              อื่นๆ: <code className="font-mono">MIN(a, b)</code> <code className="font-mono">MAX(a, b)</code>{" "}
              <code className="font-mono">ROUNDUP({"{W}"})</code> (ปัดขึ้น)
            </li>
          </ul>
          {EXAMPLES.map((ex) => (
            <div key={ex.title} className="rounded-md border border-slate-200 bg-white p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700">{ex.title}</span>
                {onInsert && (
                  <button type="button" onClick={() => onInsert(ex.formula)} className="text-[11px] font-medium text-brand-navy hover:underline">
                    ใช้สูตรนี้
                  </button>
                )}
              </div>
              <code className="mt-1 block break-all font-mono text-[11px] text-slate-700">{ex.formula}</code>
              <p className="mt-0.5 text-[11px] text-slate-500">{ex.note}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
