"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import { listReceipts, voidReceipt, deleteReceipt, openReceiptPdf, type Receipt, type ReceiptType } from "@/lib/receipts";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";

const TYPE_LABEL: Record<ReceiptType, string> = { CASH_RECEIPT: "Cash Receipt", TAX_INVOICE: "Tax Invoice" };
const TYPE_BADGE: Record<ReceiptType, string> = {
  CASH_RECEIPT: "bg-slate-100 text-slate-600",
  TAX_INVOICE: "bg-brand-amber/15 text-amber-700",
};

const money = (n: unknown) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReceiptsListPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [type, setType] = useState<"" | ReceiptType>("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [voidingId, setVoidingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await listReceipts({
        type: type || undefined,
        status: status || undefined,
        search: search || undefined,
      });
      setReceipts(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, status, search]);

  async function handleVoid(receipt: Receipt) {
    const note = prompt("Reason for voiding (optional):") ?? undefined;
    setVoidingId(receipt.id);
    try {
      await voidReceipt(receipt.id, note);
      await load();
    } finally {
      setVoidingId(null);
    }
  }

  // Only ever allowed by the backend for a Test document (every shipment on it was booked via a
  // Test-mode Agent Account) — releases the shipment lock too, unlike Void.
  async function handleDelete(receipt: Receipt) {
    if (!confirm("Permanently delete this TEST document? Its shipment(s) will become billable again. This cannot be undone.")) return;
    setDeletingId(receipt.id);
    try {
      await deleteReceipt(receipt.id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <PageHeader title="Receipts & Tax Invoices" description="All documents issued so far" />
        <Link
          href="/shipment/list"
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Plus className="h-4 w-4" />
          Issue New Document
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as "" | ReceiptType)} className={inputClass}>
            <option value="">All</option>
            <option value="CASH_RECEIPT">Cash Receipt</option>
            <option value="TAX_INVOICE">Tax Invoice</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            <option value="">All</option>
            <option value="ISSUED">Issued</option>
            <option value="VOIDED">Voided</option>
          </select>
        </label>
        <label className="flex flex-1 min-w-[200px] flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Vol.No / No. / Buyer name..."
            className={inputClass}
          />
        </label>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <PageLoading label="Loading..." />
      ) : receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <FileText className="h-10 w-10 text-brand-amber" />
          <p className="font-medium text-slate-600">No documents yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
              <tr>
                <th className="px-5 py-2.5 font-medium">Type</th>
                <th className="px-5 py-2.5 font-medium">Vol.No / No.</th>
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-5 py-2.5 font-medium">Buyer</th>
                <th className="px-5 py-2.5 font-medium text-right">Total</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_BADGE[r.type]}`}>
                      {TYPE_LABEL[r.type]}
                    </span>
                    {r.is_test && (
                      <span className="ml-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-600">TEST</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-700">
                    {r.vol_no} / {r.no}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{r.issued_date}</td>
                  <td className="px-5 py-3 text-slate-500">{r.buyer_name}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{money(r.grand_total)}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.status === "ISSUED" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {r.status === "ISSUED" ? "Issued" : "Voided"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/billing/receipts/${r.id}/edit`}
                      className="mr-2 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      View/Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => openReceiptPdf(r.id)}
                      className="mr-2 rounded-lg bg-brand-navy-dark/10 px-2.5 py-1 text-xs font-medium text-brand-navy-dark hover:bg-brand-navy-dark/20"
                    >
                      Print PDF
                    </button>
                    {r.status === "ISSUED" && (
                      <button
                        type="button"
                        onClick={() => handleVoid(r)}
                        disabled={voidingId === r.id}
                        className="mr-2 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        Void
                      </button>
                    )}
                    {r.is_test && (
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        disabled={deletingId === r.id}
                        className="rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-600 hover:bg-purple-100 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
