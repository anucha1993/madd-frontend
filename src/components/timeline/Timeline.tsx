"use client";

import { useEffect, useState } from "react";
import { Bot, ChevronDown, History } from "lucide-react";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import { getTimeline, type TimelineEntry, type TimelineSubject } from "@/lib/timeline";

const FIELD_LABEL: Record<string, string> = {
  status: "สถานะ",
  void_reason: "เหตุผลที่ Void",
  void_note: "หมายเหตุ Void",
  carrier_cancel_status: "สถานะยกเลิกกับ Carrier",
  carrier_cancel_requested_to: "แจ้งยกเลิกกับ",
  carrier_cancel_reference: "เลขอ้างอิงยกเลิก",
  tracking_status: "สถานะ Tracking",
  delivered_at: "ส่งถึงเมื่อ",
  picked_up_at: "รับของเมื่อ",
  picked_up_source: "ยืนยันรับของโดย",
  order_total: "ยอดรวม",
  freight_amount: "ค่าขนส่ง",
  addon_total: "ยอด Add-on",
  cost_amount: "ต้นทุน",
  buyer_name: "ชื่อผู้ซื้อ",
  buyer_tax_id: "เลขผู้เสียภาษี",
  buyer_address: "ที่อยู่ผู้ซื้อ",
  grand_total: "ยอดรวม",
  payment_method: "วิธีชำระเงิน",
  lines: "รายการ",
  pickup_date: "วันที่นัด",
  ready_time: "เวลาพร้อม",
  close_time: "เวลาปิด",
  carrier_reference: "เลขอ้างอิง Carrier",
  document: "เอกสาร",
  quantity: "จำนวน",
  balance_after: "คงเหลือหลังรายการ",
  batch: "พิมพ์หลายใบพร้อมกัน",
};

const DOCUMENT_LABEL: Record<string, string> = {
  label: "Label",
  all_labels: "Label ทั้งหมด",
  waybill: "Waybill",
  commercial_invoice: "Commercial Invoice",
};

const SOURCE_LABEL: Record<string, string> = { Pickup: "Pickup", Receipt: "ใบเสร็จ/ใบกำกับ", Stock: "Stock" };

function describe(e: TimelineEntry): { title: string; tone: string } {
  const c = e.changes ?? {};
  const to = (field: string) => (c[field] ? String(c[field].new ?? "") : undefined);
  if (e.event === "created") return { title: e.source === "Shipment" ? "จอง Shipment" : e.source === "Pickup" ? "นัด Pickup" : e.source === "Receipt" ? "ออกเอกสาร" : "สร้าง", tone: "bg-emerald-500" };
  if (e.event === "deleted") return { title: "ลบ", tone: "bg-red-500" };
  if (e.event === "document_viewed") return { title: `เปิดเอกสาร ${DOCUMENT_LABEL[to("document") ?? ""] ?? ""}`.trim(), tone: "bg-slate-300" };
  if (e.event === "printed") return { title: "พิมพ์เอกสาร", tone: "bg-slate-300" };
  if (e.event === "lines_changed") return { title: "แก้ไขรายการในเอกสาร", tone: "bg-sky-500" };
  if (e.event === "stock_shipment") return { title: "ตัด Stock วัสดุห่อ", tone: "bg-violet-500" };
  if (e.event === "stock_shipment_return") return { title: "คืน Stock วัสดุห่อ", tone: "bg-violet-500" };
  if (e.event === "updated") {
    const status = to("status")?.toLowerCase();
    if (status === "voided") return { title: e.source === "Receipt" ? "Void เอกสาร" : "Void Shipment", tone: "bg-red-500" };
    if (status === "cancelled") return { title: "ยกเลิก Pickup", tone: "bg-red-500" };
    if (status === "booked" && c.status?.old && String(c.status.old).toLowerCase() === "voided") return { title: "ยกเลิก Void", tone: "bg-amber-500" };
    if (to("carrier_cancel_status") === "confirmed") return { title: "DHL ยืนยันการยกเลิก", tone: "bg-emerald-500" };
    if (c.carrier_cancel_requested_at?.new) return { title: "บันทึกว่าแจ้ง DHL แล้ว", tone: "bg-amber-500" };
    if (c.picked_up_at?.new) return { title: "Courier รับของแล้ว", tone: "bg-emerald-500" };
    if (c.tracking_status) return { title: `สถานะ Tracking: ${to("tracking_status")}`, tone: "bg-sky-500" };
    return { title: "แก้ไขข้อมูล", tone: "bg-sky-500" };
  }
  return { title: e.event, tone: "bg-slate-400" };
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map(formatValue).join("\n");
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(value)) return new Date(value.replace(" ", "T")).toLocaleString();
  return String(value);
}

// Fields already said by the headline, or only noise for staff.
const QUIET_FIELDS = new Set(["document", "carrier_cancel_requested_at", "updated_at", "voided_at", "voided_by", "carrier_cancel_confirmed_by", "picked_up_by"]);

function Entry({ entry, showSource }: { entry: TimelineEntry; showSource: boolean }) {
  const [open, setOpen] = useState(false);
  const { title, tone } = describe(entry);
  const fields = Object.entries(entry.changes ?? {}).filter(([f]) => !QUIET_FIELDS.has(f));
  const isCreate = entry.event === "created";

  return (
    <li className="group relative pb-5 pl-6 last:pb-0">
      <span className="absolute left-[5px] top-2 h-full w-px bg-slate-200 group-last:hidden" aria-hidden />
      <span className={`absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full ring-2 ring-white ${tone}`} aria-hidden />
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[13px] font-semibold text-slate-800">{title}</span>
        {showSource && entry.source !== "Shipment" && entry.source !== "Stock" && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
            {SOURCE_LABEL[entry.source] ?? entry.source} {entry.label}
          </span>
        )}
        {entry.source === "Stock" && entry.label && <span className="text-[12px] text-slate-500">{entry.label}</span>}
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-slate-500">
        <span>{new Date(entry.at).toLocaleString()}</span>
        <span>·</span>
        {entry.is_system ? (
          <span className="inline-flex items-center gap-1 text-slate-400">
            <Bot className="h-3.5 w-3.5" />
            System
          </span>
        ) : (
          <span className="font-medium text-slate-600">{entry.actor ?? "—"}</span>
        )}
        {entry.ip && <span className="text-slate-400">({entry.ip})</span>}
      </div>
      {entry.source === "Stock" && entry.changes?.quantity && (
        <p className="mt-1 text-[12px] text-slate-600">
          {Number(entry.changes.quantity.new) > 0 ? "+" : ""}
          {String(entry.changes.quantity.new)} ชิ้น · คงเหลือ {String(entry.changes.balance_after?.new ?? "—")}
        </p>
      )}
      {entry.source !== "Stock" && fields.length > 0 && (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 flex items-center gap-1 text-[12px] text-brand-navy hover:underline">
            {isCreate ? "ข้อมูลตอนสร้าง" : `รายละเอียด (${fields.length})`}
            <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
          </button>
          {open && (
            <table className="mt-1.5 w-full text-[12px]">
              <tbody>
                {fields.map(([field, diff]) => (
                  <tr key={field} className="align-top">
                    <td className="w-40 py-0.5 pr-3 text-slate-500">{FIELD_LABEL[field] ?? field}</td>
                    {!isCreate && <td className="whitespace-pre-line break-all py-0.5 pr-3 text-red-600 line-through decoration-red-300">{formatValue(diff.old)}</td>}
                    <td className="whitespace-pre-line break-all py-0.5 text-emerald-700">{formatValue(diff.new)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </li>
  );
}

/** Chronological history of one Shipment / Receipt / Pickup. Change `reloadKey` to refetch. */
export default function Timeline({ subject, id, reloadKey }: { subject: TimelineSubject; id: number; reloadKey?: string | number }) {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);
  const [error, setError] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getTimeline(subject, id)
      .then((res) => {
        if (cancelled) return;
        setEntries(res.entries);
        setError("");
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "โหลด Timeline ไม่สำเร็จ"));
    return () => {
      cancelled = true;
    };
  }, [subject, id, reloadKey]);

  if (error) return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>;
  if (!entries) return <PageLoading label="Loading Timeline..." />;
  if (entries.length === 0)
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <History className="h-4 w-4" />
        ยังไม่มีประวัติ (ประวัติเริ่มบันทึกตั้งแต่เปิดใช้ Audit Log)
      </div>
    );

  const ordered = newestFirst ? [...entries].reverse() : entries;
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={() => setNewestFirst((v) => !v)} className="text-[12px] text-slate-500 hover:text-slate-700">
          {newestFirst ? "ล่าสุดก่อน ▾" : "เก่าสุดก่อน ▴"}
        </button>
      </div>
      <ol>
        {ordered.map((entry) => (
          <Entry key={entry.id} entry={entry} showSource={subject === "shipments"} />
        ))}
      </ol>
    </div>
  );
}

export function TimelineModal({ subject, id, title, onClose }: { subject: TimelineSubject; id: number; title: string; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose} maxWidthClassName="max-w-2xl">
      <Timeline subject={subject} id={id} />
    </Modal>
  );
}
