"use client";

import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { voidShipment, type Shipment } from "@/lib/shipments";

/** Message staff send DHL to cancel a waybill (DHL Express has no cancel API). */
export function dhlCancelMessage(shipment: Pick<Shipment, "tracking_number" | "created_at"> & { agent_account?: { username_acc: string } | null }) {
  const booked = new Date(shipment.created_at).toLocaleDateString("th-TH", { dateStyle: "long" });
  return [
    "เรียน DHL Express Customer Service",
    `ขอยกเลิก Waybill เลขที่ ${shipment.tracking_number} ซึ่งจองผ่าน MyDHL API ภายใต้บัญชี ${shipment.agent_account?.username_acc ?? "-"} เมื่อ ${booked}`,
    "พัสดุยังไม่ได้ส่งมอบให้ Courier และยังไม่มีการ scan",
    "รบกวนยืนยันการยกเลิก และแจ้งว่ามีค่าใช้จ่ายหรือค่าชดเชยหรือไม่",
    "ขอบคุณครับ",
  ].join("\n");
}

export function CopyButton({ text, label = "คัดลอกข้อความ" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked — the text is still selectable in the box.
        }
      }}
      className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "คัดลอกแล้ว" : label}
    </button>
  );
}

type Props = {
  shipment: Shipment;
  onClose: () => void;
  onVoided: (updated: Shipment) => void;
};

/**
 * Void with the consequences spelled out per carrier: UPS really cancels with UPS; DHL only
 * records it in MADD (no cancel API) — after voiding, the DHL steps + a ready-to-send message.
 */
export default function VoidShipmentModal({ shipment, onClose, onVoided }: Props) {
  const isDhl = shipment.carrier === "DHL";
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<(Shipment & { pickup_notice?: string | null }) | null>(null);

  async function handleVoid() {
    setBusy(true);
    setError("");
    try {
      const updated = await voidShipment(shipment.id, reason.trim());
      onVoided(updated);
      if (isDhl || updated.pickup_notice) {
        setResult(updated);
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "ยกเลิก Shipment ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const message = dhlCancelMessage({ ...shipment, ...result });
    return (
      <Modal title={`Void แล้ว — ${shipment.tracking_number}`} onClose={onClose} maxWidthClassName="max-w-xl">
        <div className="flex flex-col gap-4 text-sm">
          {result.pickup_notice && (
            <p className="whitespace-pre-line rounded-lg bg-sky-50 px-3 py-2 text-sky-800">{result.pickup_notice}</p>
          )}
          {isDhl && (
            <>
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
                <b>ยังไม่ได้ยกเลิกกับ DHL</b> — DHL Express ไม่มี API ยกเลิก Waybill สถานะในระบบจะเป็น
                &quot;Voided · รอแจ้ง DHL&quot; จนกว่าจะกด &quot;DHL ยืนยันยกเลิกแล้ว&quot;
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-slate-700">
                <li>อย่าส่งมอบพัสดุ และอย่าให้ Courier scan ลาเบลนี้</li>
                <li>ส่งข้อความด้านล่างให้ DHL (Account Manager หรือ Customer Service)</li>
                <li>เมื่อ DHL ยืนยันแล้ว กลับมากด &quot;DHL ยืนยันยกเลิกแล้ว&quot; ที่ Shipment นี้ พร้อมเลขอ้างอิงจาก DHL</li>
              </ol>
              <div>
                <textarea readOnly value={message} rows={6} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-700" />
                <div className="mt-2 flex justify-end">
                  <CopyButton text={message} />
                </div>
              </div>
            </>
          )}
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90">
              ปิด
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Void ${shipment.carrier} ${shipment.tracking_number}`} onClose={onClose} maxWidthClassName="max-w-lg">
      <div className="flex flex-col gap-4 text-sm">
        {isDhl ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-800">
            <b>DHL Express ไม่มี API ยกเลิก Waybill</b> — การ Void จะบันทึกการยกเลิกในระบบ MADD และยกเลิก Pickup ที่ผูกไว้ (ถ้ามี)
            จากนั้นต้องแจ้ง DHL เพื่อยกเลิก Waybill จริง ระบบจะเตรียมข้อความให้
          </div>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            จะยกเลิก Air Waybill <b>กับ UPS จริงทันที</b> — ย้อนกลับไม่ได้
          </div>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="font-medium text-slate-600">เหตุผลที่ยกเลิก</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="เช่น จองผิด, ลูกค้ายกเลิก"
            maxLength={500}
            className="rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          />
        </label>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50">
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleVoid}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isDhl ? "Void ในระบบ" : "Void กับ UPS"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
