"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { FileCheck, FileText, History, Loader2, MoreVertical, Plus, Printer, Trash2, XCircle, Columns3, SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { TimelineModal } from "@/components/timeline/Timeline";
import PageHeader from "@/components/layout/PageHeader";
import { useAccess } from "@/components/auth/AccessProvider";
import PageLoading from "@/components/ui/PageLoading";
import ManageColumnsModal from "@/components/ui/ManageColumnsModal";
import ColumnProfileSelect from "@/components/ui/ColumnProfileSelect";
import { useManageColumns, type ColumnDef } from "@/hooks/useManageColumns";
import { listReceipts, voidReceipt, deleteReceipt, openReceiptPdf, printReceiptsBatch, type Receipt, type ReceiptType } from "@/lib/receipts";
import { listBranches, branchLabel, type Branch } from "@/lib/branches";

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

// The Actions column is structural (not data), so it's always shown and left out of this list —
// every other field the Receipt record can supply is offered here, incl. ones not shown by
// default, so the user can turn any of them on via Manage Columns.
type ReceiptColumn = ColumnDef & { align?: "right"; render: (row: ReceiptPairRow, rep: Receipt) => ReactNode };

const RECEIPT_COLUMNS: ReceiptColumn[] = [
  { id: "date", label: "Date", render: (_row, rep) => new Date(rep.issued_date).toLocaleDateString() },
  {
    id: "receipt",
    label: "Receipt",
    render: (row) =>
      row.cashReceipt ? (
        <span className="font-mono text-xs whitespace-nowrap">
          {row.cashReceipt.vol_no} / {row.cashReceipt.no}
        </span>
      ) : (
        <span className="text-slate-300">-</span>
      ),
  },
  {
    id: "tax_invoice",
    label: "Tax Invoice",
    render: (row, rep) => (
      <>
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
      </>
    ),
  },
  {
    id: "branch",
    label: "Branch",
    render: (_row, rep) =>
      rep.branch ? (
        <span className="whitespace-nowrap">{branchLabel(rep.branch)}</span>
      ) : (
        "-"
      ),
  },
  { id: "buyer", label: "Buyer", render: (_row, rep) => rep.buyer_name },
  {
    id: "sell_price",
    label: "Sell Price",
    align: "right",
    render: (_row, rep) => (rep.shipment_total_snapshot != null ? money(rep.shipment_total_snapshot) : "-"),
  },
  {
    id: "grand_total",
    label: "Grand Total",
    align: "right",
    render: (_row, rep) => (
      <>
        <span className="font-semibold text-slate-800">{money(rep.grand_total)}</span>
        {rep.variance_amount != null && Math.abs(Number(rep.variance_amount)) > 0.01 && (
          <span
            className={`ml-1.5 block text-[11px] font-medium ${Number(rep.variance_amount) > 0 ? "text-amber-600" : "text-red-500"}`}
            title={`ยอด Shipment เดิม ${money(rep.shipment_total_snapshot)}`}
          >
            ส่วนต่าง {Number(rep.variance_amount) > 0 ? "+" : ""}
            {money(rep.variance_amount)}
          </span>
        )}
      </>
    ),
  },
  {
    id: "cost_price",
    label: "Cost",
    align: "right",
    render: (_row, rep) => {
      const withCost = (rep.shipments ?? []).filter((s) => s.cost_amount != null);
      if (withCost.length === 0) return <span className="text-slate-300">-</span>;
      const total = withCost.reduce((sum, s) => sum + Number(s.cost_amount), 0);
      const partial = withCost.length !== (rep.shipments?.length ?? 0);
      return (
        <>
          {money(total)} {withCost[0].cost_currency ?? ""}
          {partial && (
            <span className="ml-1 text-amber-600" title="บาง Shipment ในใบนี้ยังไม่มีข้อมูลต้นทุน">
              *
            </span>
          )}
        </>
      );
    },
  },
  {
    id: "status",
    label: "Status",
    render: (_row, rep) => (
      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          rep.status === "ISSUED" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
        }`}
      >
        {rep.status === "ISSUED" ? "Issued" : "Voided"}
      </span>
    ),
  },
  { id: "buyer_tax_id", label: "Buyer Tax ID", render: (_row, rep) => rep.buyer_tax_id ?? "-" },
  { id: "buyer_address", label: "Buyer Address", render: (_row, rep) => rep.buyer_address ?? "-" },
  { id: "subtotal_non_vat", label: "Subtotal (Non-VAT)", align: "right", render: (_row, rep) => money(rep.subtotal_non_vat) },
  { id: "subtotal_vat", label: "Subtotal (VAT)", align: "right", render: (_row, rep) => money(rep.subtotal_vat) },
  { id: "vat_rate", label: "VAT Rate", align: "right", render: (_row, rep) => `${Number(rep.vat_rate ?? 0)}%` },
  { id: "vat_amount", label: "VAT Amount", align: "right", render: (_row, rep) => money(rep.vat_amount) },
  {
    id: "variance",
    label: "Variance",
    align: "right",
    render: (_row, rep) => (rep.variance_amount != null ? money(rep.variance_amount) : "-"),
  },
  { id: "payment_method", label: "Payment Method", render: (_row, rep) => rep.payment_method ?? "-" },
  { id: "payment_reference", label: "Payment Reference", render: (_row, rep) => rep.payment_reference ?? "-" },
  {
    id: "voided",
    label: "Voided",
    render: (_row, rep) => (rep.voided_at ? `${new Date(rep.voided_at).toLocaleDateString()}${rep.void_note ? ` — ${rep.void_note}` : ""}` : "-"),
  },
  { id: "created_at", label: "Created At", render: (_row, rep) => new Date(rep.created_at).toLocaleDateString() },
  { id: "test_mode", label: "Test Mode", render: (_row, rep) => (rep.is_test ? "Yes" : "No") },
  {
    id: "shipments",
    label: "Linked Shipments",
    render: (_row, rep) => {
      const list = rep.shipments ?? [];
      if (list.length === 0) {
        const manual = rep.manual_shipment_refs ?? [];
        if (manual.length === 0) return "-";
        const first = `${manual[0]} (manual)`;
        if (manual.length === 1) return first;
        return (
          <>
            {first} <span className="text-slate-400" title={manual.slice(1).join(", ")}>+{manual.length - 1} more</span>
          </>
        );
      }
      const first = list[0].tracking_number ?? `#${list[0].id}`;
      if (list.length === 1) return first;
      const rest = list.slice(1).map((s) => s.tracking_number ?? `#${s.id}`).join(", ");
      return (
        <>
          {first} <span className="text-slate-400" title={rest}>+{list.length - 1} more</span>
        </>
      );
    },
  },
  { id: "grand_total_words", label: "Grand Total (Words)", render: (_row, rep) => rep.grand_total_words ?? "-" },
];

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
  const { can } = useAccess();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [voidTarget, setVoidTarget] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [voidingId, setVoidingId] = useState<number | null>(null);
  const [timelineReceipt, setTimelineReceipt] = useState<Receipt | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  // Mass Print — keyed by row.key (the Cash Receipt + Tax Invoice pair, or a standalone document's
  // own key) so selecting one row grabs BOTH documents in that pair for the combined PDF.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [printingBatch, setPrintingBatch] = useState(false);

  // Advanced filters — collapsed by default so the page doesn't look cluttered until staff
  // actually need them (see billing/receipts/new layout lesson: don't cram controls up front).
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [type, setType] = useState<"" | ReceiptType>("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [branches, setBranches] = useState<Branch[]>([]);
  // No quick-range preset selected by default means no date filter at all. Picking a manual
  // date clears the active preset and vice versa (same pattern as shipment/list).
  const [quickRange, setQuickRange] = useState<"" | "today" | "week" | "month">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [minTotal, setMinTotal] = useState("");
  const [maxTotal, setMaxTotal] = useState("");

  const advancedFilterCount = [type, branchId, dateFrom, dateTo, paymentMethod, minTotal, maxTotal].filter(
    (v) => v !== "" && v != null,
  ).length;

  // All per-row actions live behind a single dropdown, keyed by row key (only one open at a
  // time), rendered via a portal at a fixed position so the table's own overflow never clips it.
  const [actionsMenuKey, setActionsMenuKey] = useState<string | null>(null);
  const [actionsMenuPos, setActionsMenuPos] = useState<{ top: number; right: number } | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const columnsMgr = useManageColumns("receipts-list", RECEIPT_COLUMNS);

  useEffect(() => {
    listBranches()
      .then(setBranches)
      .catch(() => {});
  }, []);

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
        type: type || undefined,
        branch_id: branchId ? Number(branchId) : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        payment_method: paymentMethod || undefined,
        min_total: minTotal ? Number(minTotal) : undefined,
        max_total: maxTotal ? Number(maxTotal) : undefined,
        page,
        per_page: perPage,
      });
      setReceipts(res.data);
      setLastPage(res.last_page ?? 1);
      setTotal(res.total ?? res.data.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  // Any filter change starts again from page 1 (adjusted during render, not in an effect).
  const filterKey = JSON.stringify([status, search, type, branchId, dateFrom, dateTo, paymentMethod, minTotal, maxTotal, perPage]);
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (lastFilterKey !== filterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search, type, branchId, dateFrom, dateTo, paymentMethod, minTotal, maxTotal, page, perPage]);

  // Quick presets fill in dateFrom/dateTo (Y-m-d) — picking a manual date input instead clears
  // the active preset (see the date <input> onChange handlers below).
  function applyQuickRange(range: "" | "today" | "week" | "month") {
    setQuickRange(range);
    const now = new Date();
    const toYmd = (d: Date) => d.toISOString().slice(0, 10);
    if (range === "today") {
      setDateFrom(toYmd(now));
      setDateTo(toYmd(now));
    } else if (range === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      setDateFrom(toYmd(start));
      setDateTo(toYmd(now));
    } else if (range === "month") {
      setDateFrom(toYmd(new Date(now.getFullYear(), now.getMonth(), 1)));
      setDateTo(toYmd(now));
    } else {
      setDateFrom("");
      setDateTo("");
    }
  }

  function resetFilters() {
    setStatus("");
    setSearch("");
    setType("");
    setBranchId("");
    setQuickRange("");
    setDateFrom("");
    setDateTo("");
    setPaymentMethod("");
    setMinTotal("");
    setMaxTotal("");
  }

  // Opens the confirm dialog — nothing is voided until "Void" is pressed there.
  function handleVoid(receipt: Receipt) {
    setVoidTarget(receipt);
  }

  async function confirmVoid(receipt: Receipt, note: string) {
    setVoidingId(receipt.id);
    try {
      await voidReceipt(receipt.id, note.trim() || undefined);
      setVoidTarget(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Void ไม่สำเร็จ");
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

  const groupedRows = groupReceipts(receipts);
  const selectedCashReceiptCount = groupedRows.filter((r) => selectedKeys.has(r.key) && r.cashReceipt).length;
  const selectedTaxInvoiceCount = groupedRows.filter((r) => selectedKeys.has(r.key) && r.taxInvoice).length;

  function toggleRowSelected(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedKeys((prev) => (prev.size === groupedRows.length ? new Set() : new Set(groupedRows.map((r) => r.key))));
  }

  async function handlePrintSelected(docType: "CASH_RECEIPT" | "TAX_INVOICE") {
    // Kept as two SEPARATE print jobs (never combined) — Cash Receipt is half-A4 and Tax Invoice
    // is full A4, so mixing them into one PDF means the physical printer's loaded paper size is
    // wrong for half the pages.
    const ids = groupedRows
      .filter((row) => selectedKeys.has(row.key))
      .map((row) => (docType === "CASH_RECEIPT" ? row.cashReceipt?.id : row.taxInvoice?.id))
      .filter((id): id is number => id != null);
    if (ids.length === 0) return;
    setPrintingBatch(true);
    try {
      await printReceiptsBatch(ids);
    } finally {
      setPrintingBatch(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <PageHeader title="Receipts & Tax Invoices" description="All documents issued so far" />
        {can("receipt.create") && (
          <Link
            href="/shipment/list"
            className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
          >
            <Plus className="h-4 w-4" />
            Issue New Document
          </Link>
        )}
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Advanced Filters
              {advancedFilterCount > 0 && (
                <span className="rounded-full bg-brand-navy px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {advancedFilterCount}
                </span>
              )}
              {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <ColumnProfileSelect mgr={columnsMgr} />
            <button
              type="button"
              onClick={columnsMgr.openModal}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Columns3 className="h-4 w-4" />
              Manage Columns
            </button>
          </div>
        </div>

        {advancedOpen && (
          <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Document Type</span>
              <select value={type} onChange={(e) => setType(e.target.value as "" | ReceiptType)} className={inputClass}>
                <option value="">All</option>
                <option value="CASH_RECEIPT">Cash Receipt</option>
                <option value="TAX_INVOICE">Tax Invoice</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Branch</span>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
                className={inputClass}
              >
                <option value="">All</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {branchLabel(b)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setQuickRange("");
                  setDateFrom(e.target.value);
                }}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setQuickRange("");
                  setDateTo(e.target.value);
                }}
                className={inputClass}
              />
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Quick Range</span>
              <div className="flex gap-1">
                {(
                  [
                    ["", "All"],
                    ["today", "Today"],
                    ["week", "This Week"],
                    ["month", "This Month"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => applyQuickRange(value)}
                    className={`rounded-lg border px-2.5 py-2 text-xs font-medium ${
                      quickRange === value ? "border-brand-navy bg-brand-navy/10 text-brand-navy" : "border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Payment Method / Bank</span>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="e.g. Bangkok Bank"
                className={`${inputClass} w-44`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Grand Total Min</span>
              <input
                type="number"
                value={minTotal}
                onChange={(e) => setMinTotal(e.target.value)}
                placeholder="0"
                className={`${inputClass} w-28`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Grand Total Max</span>
              <input
                type="number"
                value={maxTotal}
                onChange={(e) => setMaxTotal(e.target.value)}
                placeholder="999999"
                className={`${inputClass} w-28`}
              />
            </label>
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        )}
      </div>

      {columnsMgr.isOpen && (
        <ManageColumnsModal
          columns={columnsMgr.orderedColumns}
          visible={columnsMgr.visible}
          groupOf={columnsMgr.groupOf}
          onCancel={columnsMgr.closeModal}
          onSave={columnsMgr.save}
          lockVisibility={!columnsMgr.canManage}
          onReset={columnsMgr.resetLayout}
          profileEditor={
            columnsMgr.canManage
              ? {
                  profile: columnsMgr.activeProfile,
                  roles: columnsMgr.roles,
                  onSaveProfile: columnsMgr.saveProfile,
                  onDeleteProfile: columnsMgr.deleteProfile,
                }
              : undefined
          }
        />
      )}

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {receipts.length > 0 && can("receipt.print") && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2">
          <span className="text-sm text-slate-500">
            {selectedKeys.size > 0 ? `${selectedKeys.size} selected` : "Select documents to Mass Print"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePrintSelected("CASH_RECEIPT")}
              disabled={selectedCashReceiptCount === 0 || printingBatch}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {printingBatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              Mass Print Receipts{selectedCashReceiptCount > 0 ? ` (${selectedCashReceiptCount})` : ""}
            </button>
            <button
              type="button"
              onClick={() => handlePrintSelected("TAX_INVOICE")}
              disabled={selectedTaxInvoiceCount === 0 || printingBatch}
              className="flex items-center gap-1.5 rounded-lg bg-brand-navy-dark px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy-dark/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {printingBatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              Mass Print Tax Invoices{selectedTaxInvoiceCount > 0 ? ` (${selectedTaxInvoiceCount})` : ""}
            </button>
          </div>
        </div>
      )}

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
                {can("receipt.print") && (
                  <th className="w-10 px-5 py-3">
                    <input
                      type="checkbox"
                      checked={groupedRows.length > 0 && selectedKeys.size === groupedRows.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-white/40"
                      aria-label="Select all"
                    />
                  </th>
                )}
                {columnsMgr.columnSlots.map((slot) => (
                  <th
                    key={slot.map((c) => c.id).join("+")}
                    className={`px-5 py-3 font-medium ${slot.length === 1 && slot[0].align === "right" ? "text-right" : ""}`}
                  >
                    {slot.map((c) => c.label).join(" / ")}
                  </th>
                ))}
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupedRows.map((row) => {
                const rep = (row.cashReceipt ?? row.taxInvoice)!;
                return (
                  <tr key={row.key} className="border-b border-slate-100 align-middle last:border-0 hover:bg-slate-50/70">
                    {can("receipt.print") && (
                      <td className="px-5 py-4 align-middle">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(row.key)}
                          onChange={() => toggleRowSelected(row.key)}
                          className="h-4 w-4 rounded border-slate-300"
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {columnsMgr.columnSlots.map((slot) => (
                      <td
                        key={slot.map((c) => c.id).join("+")}
                        className={`px-5 py-4 align-middle text-slate-500 ${slot.length === 1 && slot[0].align === "right" ? "text-right" : ""}`}
                      >
                        {slot.length === 1 ? (
                          slot[0].render(row, rep)
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {slot.map((c) => (
                              <div key={c.id}>{c.render(row, rep)}</div>
                            ))}
                          </div>
                        )}
                      </td>
                    ))}
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
                                {can("receipt.print") && (
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
                                )}
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
                                {can("receipt.print") && (
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
                                )}
                              </>
                            )}
                            {can("receipt.timeline") && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTimelineReceipt(rep);
                                  setActionsMenuKey(null);
                                }}
                                className="mt-1 flex w-full items-center gap-2 rounded-md border-t border-slate-100 px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                              >
                                <History className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                Timeline
                              </button>
                            )}
                            {rep.status === "ISSUED" && can("receipt.void") && (
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
                            {rep.is_test && can("receipt.delete") && (
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>
              ทั้งหมด {total.toLocaleString()} เอกสาร
              <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="ml-3 rounded-lg border border-slate-300 px-2 py-1 text-xs">
                {[20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} / หน้า
                  </option>
                ))}
              </select>
            </span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
                ก่อนหน้า
              </button>
              <span>
                {page} / {lastPage}
              </span>
              <button type="button" disabled={page >= lastPage || loading} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      )}

      {voidTarget && (
        <VoidReceiptDialog
          receipt={voidTarget}
          busy={voidingId === voidTarget.id}
          onCancel={() => setVoidTarget(null)}
          onConfirm={(note) => confirmVoid(voidTarget, note)}
        />
      )}

      {timelineReceipt && (
        <TimelineModal
          subject="receipts"
          id={timelineReceipt.id}
          title={`Timeline — ${[timelineReceipt.vol_no, timelineReceipt.no].filter(Boolean).join("/")}`}
          onClose={() => setTimelineReceipt(null)}
        />
      )}
    </div>
  );
}

function VoidReceiptDialog({ receipt, busy, onCancel, onConfirm }: { receipt: Receipt; busy: boolean; onCancel: () => void; onConfirm: (note: string) => void }) {
  const [note, setNote] = useState("");
  const number = [receipt.vol_no, receipt.no].filter(Boolean).join("/");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900">Void เอกสาร {number}?</h2>
        <p className="mt-1 text-sm text-slate-500">
          เอกสารจะถูกยกเลิกถาวร (เลขที่เอกสารจะไม่ถูกนำกลับมาใช้) — ถ้าเป็นคู่ใบเสร็จ / ใบกำกับภาษี จะถูก Void ทั้งคู่
        </p>
        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">เหตุผล</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} autoFocus placeholder="เช่น ออกผิดลูกค้า / ยอดผิด" className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy" />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            ยกเลิก
          </button>
          <button type="button" onClick={() => onConfirm(note)} disabled={busy} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Void
          </button>
        </div>
      </div>
    </div>
  );
}
