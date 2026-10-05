"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { useAccess } from "@/components/auth/AccessProvider";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import {
  getCarrierInvoice,
  reparseCarrierInvoice,
  updateCarrierInvoice,
  updateCarrierInvoiceLine,
  type CarrierInvoice,
  type CarrierInvoiceLine,
} from "@/lib/carrierInvoices";

const inputClass =
  "rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-xs outline-none focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

type LineGroup = {
  key: string;
  trackingNumber: string | null;
  lines: CarrierInvoiceLine[];
};

function groupLines(lines: CarrierInvoiceLine[]): LineGroup[] {
  const groups: LineGroup[] = [];
  const indexByKey = new Map<string, number>();

  lines.forEach((line) => {
    // Lines with no tracking number can't be meaningfully grouped — keep each as its own group.
    const key = line.tracking_number ?? `__line-${line.id}`;
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, groups.length);
      groups.push({ key, trackingNumber: line.tracking_number ?? null, lines: [line] });
    } else {
      groups[existingIndex].lines.push(line);
    }
  });

  return groups;
}


export default function CarrierInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const { can } = useAccess();
  const [invoice, setInvoice] = useState<CarrierInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingLineId, setSavingLineId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { override_amount: string; override_note: string }>>({});
  const [invoiceDraft, setInvoiceDraft] = useState({ invoice_no: "", invoice_date: "" });
  const [savingInvoice, setSavingInvoice] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await getCarrierInvoice(Number(params.id));
      setInvoice(res);
      setInvoiceDraft({ invoice_no: res.invoice_no ?? "", invoice_date: res.invoice_date ? res.invoice_date.slice(0, 10) : "" });
      const nextDrafts: Record<number, { override_amount: string; override_note: string }> = {};
      (res.lines ?? []).forEach((line) => {
        nextDrafts[line.id] = { override_amount: line.override_amount ?? "", override_note: line.override_note ?? "" };
      });
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (invoice?.status !== "parsing" && invoice?.status !== "uploaded") return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.status]);

  const groups = useMemo(() => groupLines(invoice?.lines ?? []), [invoice?.lines]);

  const totals = useMemo(() => {
    return groups.reduce(
      (acc, group) => {
        const bookAmount = toNumber(group.lines[0]?.shipment?.cost_amount ?? null);
        const groupInvoiceTotal = group.lines.reduce((sum, l) => sum + (toNumber(l.amount) ?? 0), 0);
        const groupCharges = group.lines.reduce((sum, l) => sum + (toNumber(l.charges) ?? 0), 0);
        const groupDiscount = group.lines.reduce((sum, l) => sum + (toNumber(l.discount) ?? 0), 0);
        acc.invoiceTotal += groupInvoiceTotal;
        acc.chargesTotal += groupCharges;
        acc.discountTotal += groupDiscount;
        if (bookAmount !== null) acc.bookTotal += bookAmount;
        return acc;
      },
      { invoiceTotal: 0, chargesTotal: 0, discountTotal: 0, bookTotal: 0 }
    );
  }, [groups]);

  async function handleReparse() {
    if (!invoice) return;
    try {
      await reparseCarrierInvoice(invoice.id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reparse invoice");
    }
  }

  async function handleSaveLine(line: CarrierInvoiceLine) {
    const draft = drafts[line.id];
    if (!draft) return;
    setSavingLineId(line.id);
    try {
      await updateCarrierInvoiceLine(line.id, {
        override_amount: draft.override_amount || undefined,
        override_note: draft.override_note || undefined,
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save line");
    } finally {
      setSavingLineId(null);
    }
  }

  async function handleSaveInvoice() {
    if (!invoice) return;
    setSavingInvoice(true);
    try {
      await updateCarrierInvoice(invoice.id, {
        invoice_no: invoiceDraft.invoice_no || undefined,
        invoice_date: invoiceDraft.invoice_date || undefined,
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save invoice");
    } finally {
      setSavingInvoice(false);
    }
  }

  if (loading) return <PageLoading />;
  if (!invoice) return <p className="text-sm text-red-600">{error || "ไม่พบใบแจ้งหนี้"}</p>;

  return (
    <div>
      <PageHeader
        title={`${invoice.carrier} — ${invoice.invoice_no || invoice.original_filename || `#${invoice.id}`}`}
        description={`สถานะ: ${invoice.status}${invoice.invoice_date ? ` · วันที่ ${new Date(invoice.invoice_date).toLocaleDateString("th-TH")}` : ""}`}
        actions={
          can("carrier_invoice.upload") ? (
            <button
              type="button"
              onClick={handleReparse}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> อ่านใหม่ (OCR)
            </button>
          ) : undefined
        }
      />

      {can("carrier_invoice.edit") && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">เลขที่ Invoice</label>
            <input
              type="text"
              value={invoiceDraft.invoice_no}
              onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, invoice_no: e.target.value }))}
              placeholder="เลขที่ Invoice"
              className={`${inputClass} w-48`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">วันที่ Invoice</label>
            <input
              type="date"
              value={invoiceDraft.invoice_date}
              onChange={(e) => setInvoiceDraft((prev) => ({ ...prev, invoice_date: e.target.value }))}
              className={`${inputClass} w-40`}
            />
          </div>
          <button
            type="button"
            onClick={handleSaveInvoice}
            disabled={savingInvoice}
            className="flex items-center gap-1 rounded-lg bg-brand-amber px-3 py-1.5 text-xs font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
          >
            <Save className="h-3 w-3" /> บันทึก
          </button>
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {invoice.status === "parsing" && (
        <p className="mb-3 flex items-center gap-2 text-sm text-amber-600">
          <Loader2 className="h-4 w-4 animate-spin" /> กำลังอ่านใบแจ้งหนี้ด้วย OCR...
        </p>
      )}
      {invoice.status === "failed" && invoice.error_message && (
        <p className="mb-3 text-sm text-red-600">อ่านไม่สำเร็จ: {invoice.error_message}</p>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Tracking No.</th>
              <th className="px-3 py-2">รายละเอียด</th>
              <th className="px-3 py-2">Charges</th>
              <th className="px-3 py-2">Discount</th>
              <th className="px-3 py-2">ยอดจาก Invoice (Net)</th>
              <th className="px-3 py-2">ยอด Rate Quote (ตอน book)</th>
              <th className="px-3 py-2">แก้ไขยอด</th>
              <th className="px-3 py-2">หมายเหตุ</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((group) => {
              const bookAmount = toNumber(group.lines[0]?.shipment?.cost_amount ?? null);
              const groupInvoiceTotal = group.lines.reduce((sum, l) => sum + (toNumber(l.amount) ?? 0), 0);
              const groupCharges = group.lines.reduce((sum, l) => sum + (toNumber(l.charges) ?? 0), 0);
              const groupDiscount = group.lines.reduce((sum, l) => sum + (toNumber(l.discount) ?? 0), 0);
              const groupMismatch = bookAmount !== null && Math.abs(groupInvoiceTotal - bookAmount) > 0.01;
              const isGroup = group.lines.length > 1;

              return (
                <Fragment key={group.key}>
                  {isGroup && (
                    <tr key={`${group.key}-header`} className={`font-semibold ${groupMismatch ? "bg-red-50" : "bg-slate-50"}`}>
                      <td className="px-3 py-2 font-mono">{group.trackingNumber ?? "-"}</td>
                      <td className="px-3 py-2 text-slate-700">{group.lines.length} รายการ</td>
                      <td className="px-3 py-2 text-slate-700">{groupCharges.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-700">{groupDiscount.toFixed(2)}</td>
                      <td className={`px-3 py-2 ${groupMismatch ? "text-red-600" : "text-slate-700"}`}>{groupInvoiceTotal.toFixed(2)}</td>
                      <td className={`px-3 py-2 ${groupMismatch ? "text-red-600" : "text-slate-600"}`}>
                        {bookAmount !== null ? bookAmount.toFixed(2) : group.lines[0]?.shipment_id ? "-" : "ยังไม่จับคู่ shipment"}
                      </td>
                      <td className="px-3 py-2" colSpan={3}></td>
                    </tr>
                  )}
                  {group.lines.map((line) => {
                    const invoiceAmount = toNumber(line.amount);
                    const charges = toNumber(line.charges);
                    const discount = toNumber(line.discount);
                    const lineBookAmount = toNumber(line.shipment?.cost_amount ?? null);
                    const mismatch = !isGroup && invoiceAmount !== null && lineBookAmount !== null && Math.abs(invoiceAmount - lineBookAmount) > 0.01;
                    const draft = drafts[line.id] ?? { override_amount: "", override_note: "" };
                    return (
                      <tr key={line.id} className={mismatch ? "bg-red-50/60" : ""}>
                        <td className="px-3 py-2 font-mono text-slate-500">{isGroup ? "" : line.tracking_number ?? "-"}</td>
                        <td className={`max-w-xs px-3 py-2 text-slate-600 ${isGroup ? "pl-6" : ""}`}>
                          {isGroup && <span className="mr-1 text-slate-300">└</span>}
                          {line.description ?? line.reference_text ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{charges !== null ? charges.toFixed(2) : "-"}</td>
                        <td className="px-3 py-2 text-slate-600">{discount !== null ? discount.toFixed(2) : "-"}</td>
                        <td className={`px-3 py-2 font-medium ${mismatch ? "text-red-600" : "text-slate-700"}`}>
                          {invoiceAmount !== null ? invoiceAmount.toFixed(2) : "-"}
                        </td>
                        <td className={`px-3 py-2 ${mismatch ? "text-red-600" : "text-slate-600"}`}>
                          {isGroup ? "" : lineBookAmount !== null ? lineBookAmount.toFixed(2) : line.shipment_id ? "-" : "ยังไม่จับคู่ shipment"}
                        </td>
                        <td className="px-3 py-2">
                          {can("carrier_invoice.edit") ? (
                            <input
                              type="text"
                              value={draft.override_amount}
                              onChange={(e) => setDrafts((prev) => ({ ...prev, [line.id]: { ...prev[line.id], override_amount: e.target.value } }))}
                              placeholder="แก้ไขยอด"
                              className={`${inputClass} w-24`}
                            />
                          ) : (
                            line.override_amount ?? "-"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {can("carrier_invoice.edit") ? (
                            <input
                              type="text"
                              value={draft.override_note}
                              onChange={(e) => setDrafts((prev) => ({ ...prev, [line.id]: { ...prev[line.id], override_note: e.target.value } }))}
                              placeholder="หมายเหตุ"
                              className={`${inputClass} w-32`}
                            />
                          ) : (
                            line.override_note ?? "-"
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {can("carrier_invoice.edit") && (
                            <button
                              type="button"
                              onClick={() => handleSaveLine(line)}
                              disabled={savingLineId === line.id}
                              className="flex items-center gap-1 rounded-lg bg-brand-amber px-2 py-1 text-xs font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
                            >
                              <Save className="h-3 w-3" /> บันทึก
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
            {groups.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                  ยังไม่มีรายการ (อาจกำลังอ่าน OCR อยู่ หรืออ่านไม่สำเร็จ)
                </td>
              </tr>
            )}
          </tbody>
          {groups.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  รวมทั้งหมด ({groups.length} shipment)
                </td>
                <td className="px-3 py-2 text-slate-800">{totals.chargesTotal.toFixed(2)}</td>
                <td className="px-3 py-2 text-slate-800">{totals.discountTotal.toFixed(2)}</td>
                <td className="px-3 py-2 text-slate-800">{totals.invoiceTotal.toFixed(2)}</td>
                <td className="px-3 py-2 text-slate-800">{totals.bookTotal.toFixed(2)}</td>
                <td className="px-3 py-2" colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
