"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccess } from "@/components/auth/AccessProvider";
import VoidShipmentModal, { CopyButton, dhlCancelMessage } from "@/components/shipment/VoidShipmentModal";
import Timeline from "@/components/timeline/Timeline";
import { ArrowLeft, ArrowRight, Download, Loader2, Package, Printer, Receipt, FileCheck, XCircle, Trash2 } from "lucide-react";
import {
  getShipment,
  openShipmentLabel,
  describeShipmentPieces,
  openShipmentWaybill,
  downloadDhlOriginalWaybill,
  openShipmentCommercialInvoice,
  unvoidShipment,
  confirmCarrierCancel,
  markCarrierCancelNotified,
  deleteShipment,
  assignShipmentBranch,
  type Shipment,
} from "@/lib/shipments";
import { listBranches, branchLabel } from "@/lib/branches";
import { getUser } from "@/lib/auth";

/* ---------------------------------------------------------------------------
   Layout

   Left   the frozen air waybill: parties, packages, add-ons
   Right  totals + reference numbers

   Every field on this page is read-only — a booked Shipment is a real carrier
   air waybill already issued; the only lifecycle action left is Void/Cancel,
   then create a brand new Shipment if something needs to change.

   Density: one spacing step (4 / 8 / 12 / 16px), labels 11px, data 13px,
   every field is a single line so a full shipment fits in about one screen.
   --------------------------------------------------------------------------- */

type Party = NonNullable<Shipment["origin"]> & { email?: string | null };

type RateQuote = {
  zone?: string;
  billedWeight?: string | number;
  billedWeightUnit?: string;
  volumetricWeight?: number;
  transitDays?: number;
  estimatedDelivery?: string;
  chargeBreakdown?: { code?: string | null; description: string; amount: number; currency: string }[];
};

const STATUS: Record<string, { label: string; dot: string; chip: string }> = {
  booked: { label: "Booked", dot: "bg-emerald-400", chip: "bg-emerald-400/15 text-emerald-200" },
  pending: { label: "Pending", dot: "bg-amber-400", chip: "bg-amber-400/15 text-amber-200" },
  failed: { label: "Failed", dot: "bg-red-400", chip: "bg-red-400/15 text-red-200" },
  voided: { label: "Voided", dot: "bg-slate-400", chip: "bg-white/10 text-white/60" },
};

const money = (value: unknown) =>
  Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const cityLine = (p?: Party) => [p?.city, p?.country].filter(Boolean).join(", ") || "—";

const addressLine = (p?: Party) =>
  [[p?.address, p?.address2, p?.address3].filter(Boolean).join(" "), p?.city, p?.postcode, p?.country]
    .filter(Boolean)
    .join(", ");

/* --- shared pieces -------------------------------------------------------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <h2 className="border-b border-slate-100 px-4 py-2.5 text-[13px] font-semibold text-slate-900">{title}</h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

// Label left, value right, one line each. Hairline rules keep the eye on track
// across the gap, which is what makes a dense field list readable.
function Row({ label, value, labelWidth = "w-28" }: { label: string; value?: React.ReactNode; labelWidth?: string }) {
  return (
    <div className="flex gap-3 py-1.5">
      <dt className={`${labelWidth} shrink-0 text-[11px] leading-5 text-slate-500`}>{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-[13px] leading-5 text-slate-900">
        {value === null || value === undefined || value === "" ? <span className="text-slate-300">—</span> : value}
      </dd>
    </div>
  );
}

// Ship From and Ship To share one field list and one grid, so the two panels
// line up row for row when they sit side by side.
function PartyPanel({ heading, party }: { heading: string; party?: Party }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-900">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-amber" />
        {heading}
      </h3>
      <dl className="divide-y divide-slate-100">
        <Row label="Contact Name" value={party?.contact_name} />
        <Row label="Company" value={party?.company} />
        <Row label="Tax ID No." value={party?.tax_id} />
        <Row label="Address" value={addressLine(party)} />
        <Row label="Telephone" value={party?.phone} />
        <Row label="Email" value={party?.email} />
        <Row label="Notes" value={party?.notes} />
      </dl>
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] leading-4 text-white/50">{label}</p>
      <p className="truncate text-[13px] font-medium leading-5 text-white/90">{value || "—"}</p>
    </div>
  );
}

const headerBtn =
  "flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-60";

/* --- page ----------------------------------------------------------------- */

export default function ShipmentViewPage() {
  const { can, canSeeField } = useAccess();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const shipmentId = Number(params.id);

  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openingLabel, setOpeningLabel] = useState(false);
  const [labelError, setLabelError] = useState("");
  const [openingPiece, setOpeningPiece] = useState<string | null>(null);
  const [openingWaybill, setOpeningWaybill] = useState(false);
  const [openingInvoice, setOpeningInvoice] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showRawResponse, setShowRawResponse] = useState(false);
  const [showRawRequest, setShowRawRequest] = useState(false);
  useEffect(() => {
    // Was: return early without clearing loading, so a non-numeric id left the
    // spinner running forever.
    if (!Number.isFinite(shipmentId)) {
      setError("That link is missing a valid shipment number.");
      setLoading(false);
      return;
    }
    setLoading(true);
    getShipment(shipmentId)
      .then((s) => setShipment(s))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this shipment."))
      .finally(() => setLoading(false));
  }, [shipmentId]);

  async function handleOpenLabel() {
    if (!shipment) return;
    setOpeningLabel(true);
    setLabelError("");
    try {
      await openShipmentLabel(shipment.id);
    } catch (err) {
      // Was an alert(), while every other failure on this page renders inline.
      setLabelError(err instanceof Error ? err.message : "Couldn't open the label.");
    } finally {
      setOpeningLabel(false);
    }
  }

  async function handleOpenPieceLabel(trackingNumber: string | null) {
    if (!shipment || !trackingNumber) return;
    setOpeningPiece(trackingNumber);
    setLabelError("");
    try {
      await openShipmentLabel(shipment.id, trackingNumber);
    } catch (err) {
      setLabelError(err instanceof Error ? err.message : "Couldn't open the label.");
    } finally {
      setOpeningPiece(null);
    }
  }

  async function handleDownloadOriginalWaybill() {
    if (!shipment) return;
    setLabelError("");
    try {
      await downloadDhlOriginalWaybill(shipment);
    } catch (err) {
      setLabelError(err instanceof Error ? err.message : "ดาวน์โหลด Waybill ต้นฉบับไม่สำเร็จ");
    }
  }

  async function handleOpenWaybill() {
    if (!shipment) return;
    setOpeningWaybill(true);
    setLabelError("");
    try {
      await openShipmentWaybill(shipment.id);
    } catch (err) {
      setLabelError(err instanceof Error ? err.message : "Couldn't open the waybill.");
    } finally {
      setOpeningWaybill(false);
    }
  }

  async function handleOpenInvoice() {
    if (!shipment) return;
    setOpeningInvoice(true);
    setLabelError("");
    try {
      await openShipmentCommercialInvoice(shipment.id);
    } catch (err) {
      setLabelError(err instanceof Error ? err.message : "Couldn't open the commercial invoice.");
    } finally {
      setOpeningInvoice(false);
    }
  }

  // UPS: really cancels the air waybill with UPS. DHL: DHL has no cancel API at all — this only
  // flips our own status locally, staff must still contact DHL directly to actually stop it.
  function handleVoid() {
    setVoidOpen(true);
  }

  async function handleConfirmCarrierCancel() {
    if (!shipment) return;
    const reference = prompt(`DHL ยืนยันการยกเลิก Waybill ${shipment.tracking_number} แล้ว?\nใส่เลขอ้างอิง / ชื่อผู้ยืนยันจาก DHL (ถ้ามี):`, "");
    if (reference === null) return;
    try {
      const updated = await confirmCarrierCancel(shipment.id, reference.trim());
      setShipment({ ...shipment, ...updated });
    } catch (err) {
      alert(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  async function handleMarkNotified() {
    if (!shipment) return;
    const notifiedTo = prompt(`บันทึกว่าแจ้ง DHL ให้ยกเลิก ${shipment.tracking_number} แล้ว\nแจ้งใคร / ช่องทางไหน (เช่น คุณเอ DHL ทางโทรศัพท์):`, shipment.carrier_cancel_requested_to ?? "");
    if (notifiedTo === null) return;
    try {
      const updated = await markCarrierCancelNotified(shipment.id, notifiedTo.trim());
      setShipment({ ...shipment, ...updated });
    } catch (err) {
      alert(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  async function handleUnvoid() {
    if (!shipment) return;
    if (!confirm(`คืนสถานะ ${shipment.tracking_number} เป็น Booked?\n(ใช้เมื่อกด Void ผิด — Waybill ที่ DHL ยังใช้ได้ แต่ Pickup ที่ถูกยกเลิกไปแล้วต้องนัดใหม่)`)) return;
    try {
      const updated = await unvoidShipment(shipment.id);
      setShipment({ ...shipment, ...updated });
    } catch (err) {
      alert(err instanceof Error ? err.message : "คืนสถานะไม่สำเร็จ");
    }
  }

  // Only ever allowed by the backend when `is_test` is true (booked via a Test-mode Agent
  // Account). Real production bookings must use Void instead.
  async function handleDelete() {
    if (!shipment) return;
    if (!confirm("Permanently delete this TEST shipment? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteShipment(shipment.id);
      router.push("/shipment/list");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete shipment");
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl animate-pulse space-y-3">
        <div className="h-32 rounded-xl bg-slate-200/70" />
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <div className="h-64 rounded-xl bg-slate-200/70" />
            <div className="h-40 rounded-xl bg-slate-200/70" />
          </div>
          <div className="h-72 rounded-xl bg-slate-200/70" />
        </div>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-[13px] font-medium text-slate-900">{error || "Shipment not found."}</p>
        <p className="mt-1 text-[13px] text-slate-500">Pick it again from the shipment list.</p>
        <button
          type="button"
          onClick={() => router.push("/shipment/list")}
          className="mt-4 rounded-lg bg-brand-navy-dark px-3 py-1.5 text-[13px] font-semibold text-white hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy focus-visible:ring-offset-2"
        >
          Back to My Shipments
        </button>
      </div>
    );
  }

  const s = shipment;
  const rateQuote = s.rate_quote as RateQuote | null | undefined;
  const status = STATUS[s.status] ?? { label: s.status, dot: "bg-slate-400", chip: "bg-white/10 text-white/70" };
  const packages = s.packages ?? [];
  const addons = s.addon_lines ?? [];
  const charges = rateQuote?.chargeBreakdown ?? [];
  const pieces = describeShipmentPieces(s);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3">
      <button
        type="button"
        onClick={() => router.push("/shipment/list")}
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to My Shipments
      </button>

      {/* Everything you need in two seconds: carrier, tracking number, status,
          route, actions. This is the only dark surface on the page. */}
      <header className="overflow-hidden rounded-xl bg-brand-navy-dark text-white">
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {s.agent_account?.agent?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.agent_account.agent.logo_url} alt="" className="h-10 w-30 rounded bg-white object-contain p-0.5" />
              )}
              <p className="truncate text-[13px]">
                <span className="font-semibold">{s.carrier}</span>
                <span className="px-1.5 text-white/30">/</span>
                <span className="text-white/60">{s.service_label ?? s.service_code}</span>
              </p>
              <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              {s.is_test && (
                <span className="shrink-0 rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[11px] font-semibold text-purple-200">
                  TEST
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {s.label_storage_key && can("shipment.label") && (
                <button type="button" onClick={handleOpenLabel} disabled={openingLabel} className={headerBtn}>
                  {openingLabel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
                  Open label
                </button>
              )}
              {s.label_storage_key && can("shipment.waybill") && (
                <button type="button" onClick={handleOpenWaybill} disabled={openingWaybill} className={headerBtn}>
                  {openingWaybill ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                  Open waybill
                </button>
              )}
              {s.carrier === "DHL" && s.waybill_storage_key && can("shipment.waybill_original") && (
                <button type="button" onClick={handleDownloadOriginalWaybill} className={headerBtn} title="ไฟล์ Waybill Doc จาก DHL โดยตรง (ไม่มีส่วน Payment of Charges ของ MADD)">
                  <Download className="h-3.5 w-3.5" /> DHL original waybill
                </button>
              )}
              {s.commercial_invoice_storage_key && can("shipment.invoice") && (
                <button type="button" onClick={handleOpenInvoice} disabled={openingInvoice} className={headerBtn}>
                  {openingInvoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck className="h-3.5 w-3.5" />}
                  Open invoice
                </button>
              )}
              {can("shipment.issue_receipt") && can("receipt.create") && s.status === "booked" && (
                <button type="button" onClick={() => router.push(`/billing/receipts/new?shipment_ids=${s.id}`)} className={headerBtn}>
                  <Printer className="h-3.5 w-3.5" /> Issue Receipt
                </button>
              )}
              {s.status === "booked" && can("shipment.void") && (
                <button
                  type="button"
                  onClick={handleVoid}
                  disabled={voidOpen}
                  className="flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-1.5 text-[13px] font-medium text-red-200 transition hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:opacity-60"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Void / Cancel
                </button>
              )}
              {s.is_test && can("shipment.delete") && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-500/15 px-3 py-1.5 text-[13px] font-medium text-purple-200 transition hover:bg-purple-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete TEST shipment
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] leading-4 text-white/50">Tracking No.</p>
              <p className="text-2xl font-semibold leading-8 tabular-nums tracking-[0.04em]">
                {s.tracking_number ?? <span className="text-white/40">Not issued</span>}
              </p>
              {s.status === "voided" && s.void_note && <p className="mt-1 text-[11px] text-white/50">{s.void_note}</p>}
            </div>
            <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
              <span className="truncate font-medium">{cityLine(s.origin as Party | undefined)}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/40" />
              <span className="truncate font-medium">{cityLine(s.destination as Party | undefined)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-white/10 bg-white/5 px-4 py-2.5 sm:grid-cols-4">
          {canSeeField("rate", "weight") && (
            <Meta
              label="Billed Weight"
              value={
                rateQuote?.billedWeight != null
                  ? `${rateQuote.billedWeight} ${rateQuote.billedWeightUnit ?? ""}`.trim()
                  : undefined
              }
            />
          )}
          {canSeeField("rate", "transit") && (
            <>
              <Meta label="Transit Days" value={rateQuote?.transitDays != null ? String(rateQuote.transitDays) : undefined} />
              <Meta label="Estimated Delivery" value={rateQuote?.estimatedDelivery} />
            </>
          )}
          {canSeeField("rate", "account") && (
            <Meta
              label="Account"
              value={
                rateQuote?.zone
                  ? `${s.agent_account?.username_acc ?? "—"} · Zone ${rateQuote.zone}`
                  : s.agent_account?.username_acc
              }
            />
          )}
        </div>

        {s.status === "booked" && (
          <p className="border-t border-white/10 bg-white/5 px-4 py-2 text-[11px] text-white/50">
            {s.carrier === "UPS"
              ? "UPS: เลื่อนวันได้เองถ้ายังไม่ End of Day (ยังไม่ปิดงาน) — หากเลย EOD แล้ว ต้อง Void แล้วจองใหม่แทน"
              : `DHL: เลข Tracking นี้ใช้งานได้ต่อไปอีกประมาณ 1 เดือนนับจากวันจอง (ถึง ~${new Date(
                  new Date(s.created_at).getTime() + 30 * 24 * 60 * 60 * 1000,
                ).toLocaleDateString()}) ไม่ต้องเลื่อนวันแบบ UPS`}
          </p>
        )}
      </header>

      {s.status === "booked" && !s.branch_id && can("shipment.assign_branch") && (
        <AssignBranchBanner shipmentId={s.id} onAssigned={(updated) => setShipment({ ...s, ...updated })} />
      )}

      {s.status === "voided" && (
        <section
          className={`rounded-xl border px-4 py-3 text-[13px] ${
            s.carrier_cancel_status === "pending" ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-700"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-0.5">
              <p className="font-semibold">
                ยกเลิกแล้ว
                {s.carrier_cancel_status === "pending" && (s.carrier_cancel_requested_at ? " — แจ้ง DHL แล้ว รอ DHL ยืนยัน" : " — ยังไม่ได้แจ้ง DHL")}
                {s.carrier_cancel_status === "confirmed" && " — DHL ยืนยันการยกเลิกแล้ว"}
                {s.carrier === "UPS" && " — ยกเลิกกับ UPS ผ่าน API แล้ว"}
              </p>
              <p>
                โดย {typeof s.voided_by === "object" && s.voided_by ? s.voided_by.name : "—"}
                {s.voided_at && ` · ${new Date(s.voided_at).toLocaleString()}`}
                {s.void_reason && ` · เหตุผล: ${s.void_reason}`}
              </p>
              {s.carrier_cancel_requested_at && (
                <p>
                  แจ้ง DHL แล้ว{s.carrier_cancel_requested_to && ` (${s.carrier_cancel_requested_to})`} · {new Date(s.carrier_cancel_requested_at).toLocaleString()}
                </p>
              )}
              {s.carrier_cancel_status === "confirmed" && (
                <p>
                  DHL ยืนยันโดย {typeof s.carrier_cancel_confirmed_by === "object" && s.carrier_cancel_confirmed_by ? s.carrier_cancel_confirmed_by.name : "—"}
                  {s.carrier_cancel_confirmed_at && ` · ${new Date(s.carrier_cancel_confirmed_at).toLocaleString()}`}
                  {s.carrier_cancel_reference && ` · อ้างอิง: ${s.carrier_cancel_reference}`}
                </p>
              )}
            </div>
            {s.carrier_cancel_status === "pending" && can(["shipment.cancel_copy", "shipment.cancel_notified", "shipment.cancel_confirmed", "shipment.unvoid"]) && (
              <div className="flex flex-wrap gap-2">
                {can("shipment.cancel_copy") && <CopyButton text={dhlCancelMessage(s)} label="คัดลอกข้อความแจ้ง DHL" />}
                {can("shipment.cancel_notified") && (
                    <button type="button" onClick={handleMarkNotified} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                      {s.carrier_cancel_requested_at ? "แก้ไขบันทึกการแจ้ง DHL" : "บันทึกว่าแจ้ง DHL แล้ว"}
                    </button>
                )}
                {can("shipment.cancel_confirmed") && (
                    <button type="button" onClick={handleConfirmCarrierCancel} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                      DHL ยืนยันยกเลิกแล้ว
                    </button>
                )}
                {can("shipment.unvoid") && (
                  <button type="button" onClick={handleUnvoid} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                    ยกเลิก Void (กดผิด)
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {voidOpen && <VoidShipmentModal shipment={s} onClose={() => setVoidOpen(false)} onVoided={(updated) => setShipment({ ...s, ...updated })} />}

      {(s.error_message || labelError) && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {labelError || s.error_message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* --- left: locked record --- */}
        <div className="flex min-w-0 flex-col gap-3">
          {/* A multi-piece shipment (several boxes booked in one carrier request) gets its own
              tracking number per box — only worth a section once there's more than one. */}
          {pieces.length > 1 && (
            <Section title={`Tracking Numbers (${pieces.length})`}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                    <th className="w-8 pb-1.5 text-left font-medium">#</th>
                    <th className="pb-1.5 text-left font-medium">Tracking No.</th>
                    <th className="pb-1.5 text-left font-medium">Package</th>
                    <th className="pb-1.5 text-right font-medium">Label</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pieces.map((piece, i) => (
                    // Index-suffixed key: Test-mode bookings reuse the same placeholder tracking
                    // number for every piece, which otherwise collides as a React key.
                    <tr key={`${piece.tracking_number ?? "piece"}-${i}`}>
                      <td className="py-1.5 tabular-nums text-slate-400">{i + 1}</td>
                      <td className="py-1.5 tabular-nums text-slate-900">{piece.tracking_number ?? "—"}</td>
                      <td className="py-1.5 text-slate-500">{piece.description}</td>
                      <td className="py-1.5 text-right">
                        {piece.label_storage_key && can("shipment.label") && (
                          <button
                            type="button"
                            onClick={() => handleOpenPieceLabel(piece.tracking_number)}
                            disabled={openingPiece === piece.tracking_number}
                            className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-navy-dark hover:underline disabled:opacity-60"
                          >
                            {openingPiece === piece.tracking_number ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Package className="h-3.5 w-3.5" />
                            )}
                            Open label
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          <Section title="Ship Info">
            <dl className="mb-3 flex flex-wrap gap-x-8 border-b border-slate-100 pb-2">
              <Row label="Customer Type" value={s.customer_type} labelWidth="w-28" />
              <Row label="Individual Category" value={s.entity_type} labelWidth="w-32" />
            </dl>
            {/* A hairline between the panels instead of a box inside a box. */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 lg:divide-x lg:divide-slate-100">
              <PartyPanel heading="Ship From" party={s.origin as Party | undefined} />
              <div className="lg:pl-6">
                <PartyPanel heading="Ship To" party={s.destination as Party | undefined} />
              </div>
            </div>
          </Section>

          <Section title={`Packages${packages.length > 1 ? ` (${packages.length})` : ""}`}>
            {packages.length ? (
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[560px] text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                      <th className="w-8 pb-1.5 text-left font-medium">#</th>
                      <th className="pb-1.5 text-left font-medium">Type</th>
                      <th className="pb-1.5 text-right font-medium">Weight</th>
                      <th className="pb-1.5 text-right font-medium">Qty</th>
                      <th className="pb-1.5 text-right font-medium">L×W×H cm</th>
                      <th className="pb-1.5 text-right font-medium">Declared</th>
                      <th className="pb-1.5 text-center font-medium">Ins.</th>
                      <th className="pb-1.5 text-left font-medium">Product Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {packages.map((p, i) => (
                      <tr key={i} className="align-top">
                        <td className="py-2 tabular-nums text-slate-400">{i + 1}</td>
                        <td className="py-2 text-slate-900">{p.is_document ? "Document" : "Box"}</td>
                        <td className="py-2 text-right tabular-nums text-slate-900">{p.weight} kg</td>
                        <td className="py-2 text-right tabular-nums text-slate-900">{p.quantity ?? 1}</td>
                        <td className="py-2 text-right tabular-nums text-slate-600">
                          {p.is_document ? <span className="text-slate-300">—</span> : `${p.length}×${p.width}×${p.height}`}
                        </td>
                        <td className="py-2 text-right tabular-nums text-slate-600">
                          {p.declared_value ? Number(p.declared_value).toLocaleString("en-US") : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2 text-center text-slate-600">{p.insured ? "Yes" : "No"}</td>
                        <td className="py-2 text-slate-900">
                          <span className="block">
                            {p.product_type === "OTHER" ? p.product_type_other || "Other" : p.product_type}
                          </span>
                          {p.description && <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{p.description}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[13px] text-slate-400">No package details on this shipment.</p>
            )}
          </Section>

          <Section title="Add On">
            {addons.length ? (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                    <th className="pb-1.5 text-left font-medium">Item</th>
                    <th className="pb-1.5 text-left font-medium">Category</th>
                    <th className="pb-1.5 text-right font-medium">Qty</th>
                    <th className="pb-1.5 text-right font-medium">Unit Price</th>
                    <th className="pb-1.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {addons.map((line, i) => (
                    <tr key={i}>
                      <td className="py-2 text-slate-900">{line.name}</td>
                      <td className="py-2 text-slate-500">{line.category ?? "—"}</td>
                      <td className="py-2 text-right tabular-nums text-slate-900">{line.quantity}</td>
                      <td className="py-2 text-right tabular-nums text-slate-600">{money(line.unit_price)}</td>
                      <td className="py-2 text-right font-medium tabular-nums text-slate-900">
                        {money(line.quantity * Number(line.unit_price))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-[13px] text-slate-400">No add-ons on this shipment.</p>
            )}
          </Section>
        </div>

        {/* --- right: money, then the only editable block --- */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
          <Section title="Payment Info">
            <dl className="divide-y divide-slate-100">
              <Row label="Payment Method" value={s.payment_method} labelWidth="w-24" />
              <Row label="Bill Transport to" value={s.bill_transportation_to} labelWidth="w-24" />
              <Row label="Bill Duty/Tax to" value={s.bill_duty_tax_to} labelWidth="w-24" />
            </dl>

            {canSeeField("rate", "breakdown") && charges.length > 0 && (
              <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 text-[13px]">
                {charges.map((c, i) => (
                  <div key={i} className="flex justify-between gap-3 text-slate-500">
                    <span className="min-w-0 truncate">{c.description}</span>
                    <span className="shrink-0 tabular-nums">{money(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 text-[13px]">
              <div className="flex justify-between text-slate-500">
                <span>Freight</span>
                <span className="tabular-nums">{money(s.freight_amount)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Add-ons</span>
                <span className="tabular-nums">{money(s.addon_total)}</span>
              </div>
              {/* The total ends the column, so it is the one number set larger. */}
              <div className="mt-1 flex items-baseline justify-between border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-lg font-semibold tabular-nums text-slate-900">
                  {money(s.order_total)} <span className="text-[13px] font-medium text-slate-500">{s.currency}</span>
                </span>
              </div>
            </div>
          </Section>

          <Section title="Reference Numbers">
            <dl className="divide-y divide-slate-100">
              <Row label="Invoice No." value={s.ref_invoice_no} labelWidth="w-24" />
              <Row label="Insurance No." value={s.ref_insurance_no} labelWidth="w-24" />
              <Row label="Purchase No." value={s.ref_purchase_no} labelWidth="w-24" />
            </dl>
          </Section>
        </aside>
      </div>

      {s.raw_request && (
        <Section title="Raw Request Sent to Carrier">
          {s.carrier_http_status && (
            <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {s.carrier} accepted the request — HTTP {s.carrier_http_status}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">
              Exact request body sent to {s.carrier} when booking — dispute evidence proving what
              billing party/account was actually requested (e.g. Bill Duty and Tax to Receiver),
              in case {s.carrier} bills it differently on their end.
            </p>
            <button
              type="button"
              onClick={() => setShowRawRequest((v) => !v)}
              className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
            >
              {showRawRequest ? "Hide" : "Show"}
            </button>
          </div>
          {showRawRequest && (
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-5 text-slate-100">
              {JSON.stringify(s.raw_request, null, 2)}
            </pre>
          )}
        </Section>
      )}

      {can("shipment.timeline") && (
        <Section title="Timeline">
          <Timeline subject="shipments" id={s.id} reloadKey={`${s.status}-${s.carrier_cancel_status}-${s.carrier_cancel_requested_at}-${s.picked_up_at}`} />
        </Section>
      )}

      {s.raw_response && (
        <Section title="Raw Carrier Response">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-500">
              Full {s.carrier} API response from when this shipment was booked — kept as evidence.
            </p>
            <button
              type="button"
              onClick={() => setShowRawResponse((v) => !v)}
              className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
            >
              {showRawResponse ? "Hide" : "Show"}
            </button>
          </div>
          {showRawResponse && (
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-5 text-slate-100">
              {JSON.stringify(s.raw_response, null, 2)}
            </pre>
          )}
        </Section>
      )}
    </div>
  );
}

// Bookings made before the branch became mandatory have none — and can't be billed until they
// do. Lets a user who books for several/all branches set it once.
function AssignBranchBanner({ shipmentId, onAssigned }: { shipmentId: number; onAssigned: (s: Shipment) => void }) {
  const user = getUser();
  const [options, setOptions] = useState<{ id: number; name: string; code?: string | null; nickname?: string | null }[]>(user?.can_access_all_branches ? [] : (user?.branches ?? []));
  const [branchId, setBranchId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.can_access_all_branches) return;
    listBranches()
      .then((rows) => setOptions(rows.filter((b) => b.status)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (options.length === 0) return null;

  async function save() {
    if (!branchId) return;
    setSaving(true);
    setError("");
    try {
      onAssigned(await assignShipmentBranch(shipmentId, branchId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
      <span className="font-semibold">Shipment นี้ยังไม่มีสาขา — ต้องกำหนดก่อนออกใบเสร็จ / ใบกำกับภาษี</span>
      <select value={branchId ?? ""} onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : null)} className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[13px]">
        <option value="">— เลือกสาขา —</option>
        {options.map((b) => (
          <option key={b.id} value={b.id}>
            {branchLabel(b)}
          </option>
        ))}
      </select>
      <button type="button" disabled={!branchId || saving} onClick={save} className="rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
        {saving ? "กำลังบันทึก..." : "บันทึกสาขา"}
      </button>
      {error && <span className="text-red-600">{error}</span>}
    </section>
  );
}
