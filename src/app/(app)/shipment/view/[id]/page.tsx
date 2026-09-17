"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Package, Printer, Receipt, FileCheck, XCircle } from "lucide-react";
import {
  getShipment,
  openShipmentLabel,
  printShipmentReceipt,
  describeShipmentPieces,
  openShipmentWaybill,
  openShipmentCommercialInvoice,
  voidShipment,
  type Shipment,
} from "@/lib/shipments";

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
  const [voiding, setVoiding] = useState(false);

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
  async function handleVoid() {
    if (!shipment) return;
    const confirmMsg =
      shipment.carrier === "UPS"
        ? "ยืนยันยกเลิก Shipment นี้กับ UPS จริง? (จะยกเลิก Air Waybill กับ UPS ทันที ย้อนกลับไม่ได้)"
        : "DHL ไม่มี API ยกเลิก Shipment — การกดนี้จะแค่มาร์คสถานะในระบบเราเป็น Voided เท่านั้น ต้องติดต่อ DHL โดยตรงเพื่อยกเลิกจริง ดำเนินการต่อไหม?";
    if (!confirm(confirmMsg)) return;

    setVoiding(true);
    try {
      const updated = await voidShipment(shipment.id);
      setShipment(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : "ยกเลิก Shipment ไม่สำเร็จ");
    } finally {
      setVoiding(false);
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
                <img src={s.agent_account.agent.logo_url} alt="" className="h-7 w-7 rounded bg-white object-contain p-0.5" />
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
            </div>

            <div className="flex items-center gap-2">
              {s.label_storage_key && (
                <button type="button" onClick={handleOpenLabel} disabled={openingLabel} className={headerBtn}>
                  {openingLabel ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
                  Open label
                </button>
              )}
              {s.waybill_storage_key && (
                <button type="button" onClick={handleOpenWaybill} disabled={openingWaybill} className={headerBtn}>
                  {openingWaybill ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                  Open waybill
                </button>
              )}
              {s.commercial_invoice_storage_key && (
                <button type="button" onClick={handleOpenInvoice} disabled={openingInvoice} className={headerBtn}>
                  {openingInvoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck className="h-3.5 w-3.5" />}
                  Open invoice
                </button>
              )}
              <button type="button" onClick={() => printShipmentReceipt(s)} className={headerBtn}>
                <Printer className="h-3.5 w-3.5" /> Print receipt
              </button>
              {s.status === "booked" && (
                <button
                  type="button"
                  onClick={handleVoid}
                  disabled={voiding}
                  className="flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-1.5 text-[13px] font-medium text-red-200 transition hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:opacity-60"
                >
                  {voiding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                  Void / Cancel
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
          <Meta
            label="Billed Weight"
            value={
              rateQuote?.billedWeight != null
                ? `${rateQuote.billedWeight} ${rateQuote.billedWeightUnit ?? ""}`.trim()
                : undefined
            }
          />
          <Meta label="Transit Days" value={rateQuote?.transitDays != null ? String(rateQuote.transitDays) : undefined} />
          <Meta label="Estimated Delivery" value={rateQuote?.estimatedDelivery} />
          <Meta
            label="Account"
            value={
              rateQuote?.zone
                ? `${s.agent_account?.username_acc ?? "—"} · Zone ${rateQuote.zone}`
                : s.agent_account?.username_acc
            }
          />
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
                    <tr key={piece.tracking_number ?? i}>
                      <td className="py-1.5 tabular-nums text-slate-400">{i + 1}</td>
                      <td className="py-1.5 tabular-nums text-slate-900">{piece.tracking_number ?? "—"}</td>
                      <td className="py-1.5 text-slate-500">{piece.description}</td>
                      <td className="py-1.5 text-right">
                        {piece.label_storage_key && (
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

            {charges.length > 0 && (
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
    </div>
  );
}
