"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Package, Printer, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { getShipment, updateShipmentRefs, openShipmentLabel, printShipmentReceipt, type Shipment } from "@/lib/shipments";

const STATUS_STYLE: Record<string, string> = {
  booked: "bg-emerald-50 text-emerald-600",
  pending: "bg-amber-50 text-amber-600",
  failed: "bg-red-50 text-red-600",
};

const STATUS_LABEL: Record<string, string> = { booked: "Booked", pending: "Pending", failed: "Failed" };

const editableInputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
const labelClass = "text-sm font-medium text-slate-600";

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-3.5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

// Plain text, not an input — every field here is permanently immutable (a real carrier air
// waybill already exists), only the 3 Ref numbers below are ever editable (see editableInputClass).
function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className="text-sm font-medium leading-tight text-slate-700">{value || "-"}</span>
    </div>
  );
}

// Read-only view of a booked Shipment — mirrors /shipment/create's field styling/sections
// (Ship Info / Product & Rate / Add On / Payment Info) but as ONE page (no step wizard) since
// there's nothing left to "do" step by step, just review. Only the 3 Ref numbers are editable —
// everything else on a booked Shipment is a real carrier air waybill already, fully immutable.
export default function ShipmentViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const shipmentId = Number(params.id);

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [refInvoiceNo, setRefInvoiceNo] = useState("");
  const [refInsuranceNo, setRefInsuranceNo] = useState("");
  const [refPurchaseNo, setRefPurchaseNo] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [openingLabel, setOpeningLabel] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(shipmentId)) return;
    setLoading(true);
    getShipment(shipmentId)
      .then((s) => {
        setShipment(s);
        setRefInvoiceNo(s.ref_invoice_no ?? "");
        setRefInsuranceNo(s.ref_insurance_no ?? "");
        setRefPurchaseNo(s.ref_purchase_no ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "โหลดข้อมูล Shipment ไม่สำเร็จ"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipmentId]);

  async function handleSaveRefs() {
    setSaving(true);
    setSaveMessage("");
    try {
      const updated = await updateShipmentRefs(shipmentId, {
        ref_invoice_no: refInvoiceNo.trim() || undefined,
        ref_insurance_no: refInsuranceNo.trim() || undefined,
        ref_purchase_no: refPurchaseNo.trim() || undefined,
      });
      setShipment(updated);
      setSaveMessage("บันทึกเรียบร้อย");
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleOpenLabel() {
    if (!shipment) return;
    setOpeningLabel(true);
    try {
      await openShipmentLabel(shipment.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "เปิด Label ไม่สำเร็จ");
    } finally {
      setOpeningLabel(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !shipment) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error || "ไม่พบ Shipment"}</p>;
  }

  const s = shipment;
  const rateQuote = s.rate_quote as
    | {
        zone?: string;
        billedWeight?: string | number;
        billedWeightUnit?: string;
        volumetricWeight?: number;
        transitDays?: number;
        estimatedDelivery?: string;
        chargeBreakdown?: { code?: string | null; description: string; amount: number; currency: string }[];
      }
    | null
    | undefined;
  const addressLine = (addr?: Shipment["origin"]) =>
    [[addr?.address, addr?.address2, addr?.address3].filter(Boolean).join(" "), addr?.city, addr?.country, addr?.postcode].filter(Boolean).join(", ") || "-";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/shipment/list")}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> กลับไป My Shipments
        </button>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[s.status] ?? "bg-slate-50 text-slate-500"}`}>
          {STATUS_LABEL[s.status] ?? s.status}
        </span>
      </div>

      <PageHeader
        title={`Shipment — ${s.tracking_number ?? "ไม่มีเลข Tracking"}`}
        description="ข้อมูลทั้งหมดที่ใช้ตอนสร้าง Shipment นี้ — แก้ไขได้เฉพาะเลขอ้างอิงด้านล่างสุดเท่านั้น"
      />

      <div className="flex flex-col gap-3">
        <Card title="Ship Info">
          <div className="mb-2 flex flex-wrap gap-6">
            <Field label="Customer Type" value={s.customer_type} />
            <Field label="Individual Category" value={s.entity_type} />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="flex flex-col gap-2 rounded-xl border border-slate-100 p-2.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ship From</h3>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Contact Name" value={s.origin?.contact_name} />
                <Field label="Company" value={s.origin?.company} />
                <Field label="Tax ID No." value={s.origin?.tax_id} />
              </div>
              <Field label="Address" value={addressLine(s.origin)} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Telephone" value={s.origin?.phone} />
                <Field label="Notes" value={s.origin?.notes} />
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-slate-100 p-2.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ship To</h3>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Contact Name" value={s.destination?.contact_name} />
                <Field label="Company" value={s.destination?.company} />
                <Field label="Tax ID No." value={s.destination?.tax_id} />
              </div>
              <Field label="Address" value={addressLine(s.destination)} />
              <div className="grid grid-cols-3 gap-2">
                <Field label="Telephone" value={s.destination?.phone} />
                <Field label="Email" value={s.destination?.email} />
                <Field label="Notes" value={s.destination?.notes} />
              </div>
            </div>
          </div>
        </Card>

        <Card title="Product & Rate">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Packages</h3>
              {(s.packages ?? []).map((p, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-xl border border-slate-100 p-2.5">
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Type" value={p.is_document ? "Document" : "Box"} />
                    <Field label="Weight (kg)" value={String(p.weight)} />
                    <Field label="Qty" value={String(p.quantity ?? 1)} />
                    {!p.is_document && <Field label="Dimensions (LxWxH cm)" value={`${p.length} x ${p.width} x ${p.height}`} />}
                    <Field label="Declared Value" value={p.declared_value ? Number(p.declared_value).toLocaleString() : "-"} />
                    <Field label="Insurance" value={p.insured ? "Yes" : "No"} />
                    <Field label="Product Type" value={p.product_type === "OTHER" ? p.product_type_other || "Other" : p.product_type} />
                  </div>
                  <Field label="Description of Goods" value={p.description} />
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ขนส่งที่ Shipment นี้ไป (Shipped Via)</h3>
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                {s.agent_account?.agent?.logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.agent_account.agent.logo_url} alt={s.carrier} className="h-8 w-8 rounded object-contain" />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {s.carrier} — {s.service_label ?? s.service_code}
                  </p>
                  <p className="text-xs text-slate-500">
                    Account: {s.agent_account?.username_acc ?? "-"}
                    {rateQuote?.zone ? ` · Zone ${rateQuote.zone}` : ""}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Tracking No." value={s.tracking_number} />
                <Field
                  label="Billed Weight"
                  value={rateQuote?.billedWeight != null ? `${rateQuote.billedWeight} ${rateQuote.billedWeightUnit ?? ""}` : "-"}
                />
                <Field label="Transit Days" value={rateQuote?.transitDays != null ? String(rateQuote.transitDays) : "-"} />
                <Field label="Estimated Delivery" value={rateQuote?.estimatedDelivery} />
              </div>
              {(rateQuote?.chargeBreakdown?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-slate-100 p-2.5 text-sm">
                  {rateQuote!.chargeBreakdown!.map((c, i) => (
                    <div key={i} className="flex justify-between py-0.5 text-slate-600">
                      <span>
                        {c.description}
                        {c.code ? ` (${c.code})` : ""}
                      </span>
                      <span>{Number(c.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} {c.currency}</span>
                    </div>
                  ))}
                </div>
              )}
              {s.label_storage_key && (
                <button
                  type="button"
                  onClick={handleOpenLabel}
                  disabled={openingLabel}
                  className="flex items-center justify-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:opacity-60"
                >
                  {openingLabel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                  เปิด Label
                </button>
              )}
              {s.error_message && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{s.error_message}</p>}
            </div>
          </div>
        </Card>

        <Card title="Add On">
          {(s.addon_lines?.length ?? 0) > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-1 font-medium">Item</th>
                  <th className="py-1 font-medium">Category</th>
                  <th className="py-1 font-medium text-right">Qty</th>
                  <th className="py-1 font-medium text-right">Unit Price</th>
                  <th className="py-1 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {s.addon_lines!.map((line, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1">{line.name}</td>
                    <td className="py-1 text-slate-500">{line.category ?? "-"}</td>
                    <td className="py-1 text-right">{line.quantity}</td>
                    <td className="py-1 text-right">{Number(line.unit_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className="py-1 text-right">
                      {(line.quantity * Number(line.unit_price)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-400">ไม่มีรายการ Add-on</p>
          )}
        </Card>

        <Card title="Payment Info">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="Payment Method" value={s.payment_method} />
            <Field label="Bill Transportation to" value={s.bill_transportation_to} />
            <Field label="Bill Duty and Tax to" value={s.bill_duty_tax_to} />
          </div>
          {/* Only these 3 reference numbers stay editable on an already-booked Shipment. */}
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Ref. Invoice No.</span>
              <input
                type="text"
                value={refInvoiceNo}
                onChange={(e) => setRefInvoiceNo(e.target.value)}
                placeholder="e.g. INV-2026-00123"
                className={editableInputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Ref. Insurance No.</span>
              <input
                type="text"
                value={refInsuranceNo}
                onChange={(e) => setRefInsuranceNo(e.target.value)}
                placeholder="e.g. INS-2026-00123"
                className={editableInputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Ref. Purchase No.</span>
              <input
                type="text"
                value={refPurchaseNo}
                onChange={(e) => setRefPurchaseNo(e.target.value)}
                placeholder="e.g. PO-2026-00123"
                className={editableInputClass}
              />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveRefs}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark shadow-sm hover:bg-brand-amber/90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              บันทึกเลขอ้างอิง
            </button>
            <button
              type="button"
              onClick={() => printShipmentReceipt(s)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" /> พิมพ์ใบเสร็จ
            </button>
            {saveMessage && <span className="text-sm text-slate-500">{saveMessage}</span>}
          </div>

          <div className="mt-4 flex flex-col gap-1 border-t border-slate-100 pt-3 text-sm">
            <div className="flex justify-between text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Freight
              </span>
              <span>{Number(s.freight_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })} {s.currency}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Add-ons</span>
              <span>{Number(s.addon_total).toLocaleString(undefined, { maximumFractionDigits: 2 })} {s.currency}</span>
            </div>
            <div className="flex justify-between pt-1 text-base font-semibold text-slate-800">
              <span>Total</span>
              <span>{Number(s.order_total).toLocaleString(undefined, { maximumFractionDigits: 2 })} {s.currency}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
