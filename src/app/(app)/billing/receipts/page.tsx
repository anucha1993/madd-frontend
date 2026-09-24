"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FileCheck, FileText, Loader2, MoreVertical, Plus, Printer, Trash2, XCircle } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import { listReceipts, voidReceipt, deleteReceipt, openReceiptPdf, type Receipt } from "@/lib/receipts";

const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";

const money = (n: unknown) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// A Cash Receipt + Tax Invoice issued together (same receipt_group_id) are ONE logical document
// pair — grouped into a single row here instead of two separate rows. `null` groupId covers
// legacy standalone documents issued before paired-issuance (2026-09-23), shown as their own row.
type ReceiptPairRow = {
  key: string;
  cashReceipt?: Receipt;
  taxInvoice?: Receipt;
};

function groupReceipts(receipts: Receipt[]): ReceiptPairRow[] {
  const rows: ReceiptPairRow[] = [];
  const groupIndex = new Map<string, number>();
  for (const r of receipts) {
    if (r.receipt_group_id && groupIndex.has(r.receipt_group_id)) {
      const row = rows[groupIndex.get(r.receipt_group_id)!];
      if (r.type === "CASH_RECEIPT") row.cashReceipt = r;
      else row.taxInvoice = r;
      continue;
    }
    const row: ReceiptPairRow = {
      key: r.receipt_group_id ?? `r-${r.id}`,
      cashReceipt: r.type === "CASH_RECEIPT" ? r : undefined,
      taxInvoice: r.type === "TAX_INVOICE" ? r : undefined,
    };
    if (r.receipt_group_id) groupIndex.set(r.receipt_group_id, rows.length);
    rows.push(row);
  }
  return rows;
}

export default function ReceiptsListPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [voidingId, setVoidingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // All per-row actions live behind a single dropdown, keyed by row key (only one open at a
  // time), rendered via a portal at a fixed position so the table's own overflow never clips it.
  const [actionsMenuKey, setActionsMenuKey] = useState<string | null>(null);
  const [actionsMenuPos, setActionsMenuPos] = useState<{ top: number; right: number } | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (actionsMenuKey == null) return;
    function handleClickOutside(e: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setActionsMenuKey(null);
      }
    }
    function handleScroll() {
      setActionsMenuKey(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [actionsMenuKey]);

  function handleActionsButtonClick(row: ReceiptPairRow, e: React.MouseEvent<HTMLButtonElement>) {
    if (actionsMenuKey === row.key) {
      setActionsMenuKey(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setActionsMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setActionsMenuKey(row.key);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await listReceipts({
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
  }, [status, search]);

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
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase tracking-wide text-white/90">
              <tr>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Receipt</th>
                <th className="px-5 py-3 font-medium">Tax Invoice</th>
                <th className="px-5 py-3 font-medium">Branch</th>
                <th className="px-5 py-3 font-medium">Buyer</th>
                <th className="px-5 py-3 font-medium text-right">Grand Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupReceipts(receipts).map((row) => {
                const rep = (row.cashReceipt ?? row.taxInvoice)!;
                return (
                  <tr key={row.key} className="border-b border-slate-100 align-middle last:border-0 hover:bg-slate-50/70">
                    <td className="px-5 py-4 align-middle text-slate-500">{new Date(rep.issued_date).toLocaleDateString()}</td>
                    <td className="px-5 py-4 align-middle font-medium text-slate-700">
                      {row.cashReceipt ? (
                        <span className="font-mono text-xs whitespace-nowrap">
                          {row.cashReceipt.vol_no} / {row.cashReceipt.no}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle font-medium text-slate-700">
                      {row.taxInvoice ? (
                        <span className="font-mono text-xs whitespace-nowrap">
                          {row.taxInvoice.vol_no} / {row.taxInvoice.no}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                      {rep.is_test && (
                        <span className="ml-1.5 w-fit rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">TEST</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle text-slate-500">
                      {rep.branch ? (
                        <span className="whitespace-nowrap">
                          <span className="font-mono text-xs font-semibold text-slate-600">{rep.branch.code}</span>{" "}
                          {rep.branch.name}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle text-slate-500">{rep.buyer_name}</td>
                    <td className="px-5 py-4 align-middle text-right">
                      <span className="font-semibold text-slate-800">{money(rep.grand_total)}</span>
                      {rep.variance_amount != null && Math.abs(Number(rep.variance_amount)) > 0.01 && (
                        <span
                          className={`ml-1.5 block text-[11px] font-medium ${
                            Number(rep.variance_amount) > 0 ? "text-amber-600" : "text-red-500"
                          }`}
                          title={`ยอด Shipment เดิม ${money(rep.shipment_total_snapshot)}`}
                        >
                          ส่วนต่าง {Number(rep.variance_amount) > 0 ? "+" : ""}
                          {money(rep.variance_amount)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          rep.status === "ISSUED" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {rep.status === "ISSUED" ? "Issued" : "Voided"}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-middle text-right">
                      <button
                        type="button"
                        onClick={(e) => handleActionsButtonClick(row, e)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200"
                        aria-label="Actions"
                        title="Actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {actionsMenuKey === row.key &&
                        actionsMenuPos &&
                        createPortal(
                          <div
                            ref={actionsMenuRef}
                            style={{ position: "fixed", top: actionsMenuPos.top, right: actionsMenuPos.right }}
                            className="z-50 w-60 rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-lg"
                          >
                            {row.cashReceipt && (
                              <>
                                <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Receipt
                                </p>
                                <Link
                                  href={`/billing/receipts/${row.cashReceipt.id}/edit`}
                                  onClick={() => setActionsMenuKey(null)}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  View/Edit
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => {
                                    openReceiptPdf(row.cashReceipt!.id);
                                    setActionsMenuKey(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  <Printer className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  Print PDF
                                </button>
                              </>
                            )}
                            {row.taxInvoice && (
                              <>
                                <p className="mt-1 border-t border-slate-100 px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                  Tax Invoice
                                </p>
                                <Link
                                  href={`/billing/receipts/${row.taxInvoice.id}/edit`}
                                  onClick={() => setActionsMenuKey(null)}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  <FileCheck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  View/Edit
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => {
                                    openReceiptPdf(row.taxInvoice!.id);
                                    setActionsMenuKey(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                                >
                                  <Printer className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  Print PDF
                                </button>
                              </>
                            )}
                            {rep.status === "ISSUED" && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleVoid(rep);
                                  setActionsMenuKey(null);
                                }}
                                disabled={voidingId === rep.id}
                                className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-slate-100 px-2 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {voidingId === rep.id ? (
                                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                                )}
                                Void
                              </button>
                            )}
                            {rep.is_test && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleDelete(rep);
                                  setActionsMenuKey(null);
                                }}
                                disabled={deletingId === rep.id}
                                className="flex w-full items-center gap-2 rounded-md border-t border-slate-100 px-2 py-1.5 text-left text-xs text-purple-600 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {deletingId === rep.id ? (
                                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                                )}
                                Delete
                              </button>
                            )}
                          </div>,
                          document.body,
                        )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
