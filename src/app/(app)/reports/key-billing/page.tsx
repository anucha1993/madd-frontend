"use client";

import { useEffect, useState } from "react";
import { Download, FileBarChart2, Loader2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { listBranches, branchLabel, type Branch } from "@/lib/branches";
import {
  downloadKeyBillingReport,
  listKeyBillingReport,
  type KeyBillingRangePreset,
  type KeyBillingReportResult,
} from "@/lib/keyBillingReport";

const RANGE_OPTIONS: { value: KeyBillingRangePreset; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

function formatNumber(n: number | null) {
  return n === null ? "-" : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function KeyBillingReportPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [range, setRange] = useState<KeyBillingRangePreset>("monthly");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [carrier, setCarrier] = useState<"" | "UPS" | "DHL">("");
  const [result, setResult] = useState<KeyBillingReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const filters = {
    range,
    date_from: range === "custom" ? dateFrom || undefined : undefined,
    date_to: range === "custom" ? dateTo || undefined : undefined,
    branch_id: branchId || undefined,
    carrier: carrier || undefined,
  };

  async function load() {
    setLoading(true);
    setError("");
    try {
      setResult(await listKeyBillingReport(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Key Billing Report");
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      await downloadKeyBillingReport(filters);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export Key Billing Report");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    listBranches()
      .then(setBranches)
      .catch(() => undefined);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = result?.rows ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      selling: acc.selling + r.selling_total,
      costEstimate: acc.costEstimate + r.cost_estimate,
      costInvoice: acc.costInvoice + (r.cost_invoice ?? 0),
      marginEstimate: acc.marginEstimate + r.margin_estimate,
      marginActual: acc.marginActual + (r.margin_actual ?? 0),
    }),
    { selling: 0, costEstimate: 0, costInvoice: 0, marginEstimate: 0, marginActual: 0 },
  );

  return (
    <div>
      <PageHeader title="Key Billing Report" description="แสดง/Export ยอดขายที่กระทบกับต้นทุนจาก Carrier Invoice" />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Range</span>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  range === opt.value
                    ? "bg-brand-navy-dark text-white"
                    : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {range === "custom" && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
              />
            </label>
          </>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Branch</span>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value ? Number(e.target.value) : "")}
            className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          >
            <option value="">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {branchLabel(b)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Carrier</span>
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value as "" | "UPS" | "DHL")}
            className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          >
            <option value="">All</option>
            <option value="UPS">UPS</option>
            <option value="DHL">DHL</option>
          </select>
        </label>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileBarChart2 className="h-4 w-4" />}
          ค้นหา
        </button>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 rounded-lg border border-brand-navy-dark px-4 py-2 text-sm font-medium text-brand-navy-dark hover:bg-brand-navy-dark/5 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export Excel
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Tracking No.</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Carrier</th>
              <th className="px-4 py-3">Dest.</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3 text-right">ยอดขาย</th>
              <th className="px-4 py-3 text-right">ต้นทุน (ประเมิน)</th>
              <th className="px-4 py-3 text-right">ต้นทุน (Invoice จริง)</th>
              <th className="px-4 py-3 text-right">ส่วนต่างต้นทุน</th>
              <th className="px-4 py-3 text-right">Margin (ประเมิน)</th>
              <th className="px-4 py-3 text-right">Margin (จริง)</th>
              <th className="px-4 py-3">Invoice No.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                  {loading ? "กำลังโหลด..." : "ไม่พบข้อมูล"}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.tracking ?? i} className={!r.invoice_matched ? "bg-amber-50/40" : undefined}>
                <td className="px-4 py-3 font-medium text-slate-700">{r.tracking ?? "-"}</td>
                <td className="px-4 py-3">{r.branch ?? "-"}</td>
                <td className="px-4 py-3">{r.carrier}</td>
                <td className="px-4 py-3">{r.destination_country ?? "-"}</td>
                <td className="px-4 py-3">{r.payment_method ?? "-"}</td>
                <td className="px-4 py-3 text-right">{formatNumber(r.selling_total)}</td>
                <td className="px-4 py-3 text-right">{formatNumber(r.cost_estimate)}</td>
                <td className="px-4 py-3 text-right">{formatNumber(r.cost_invoice)}</td>
                <td className={`px-4 py-3 text-right ${r.cost_variance && Math.abs(r.cost_variance) > 0.01 ? "font-semibold text-red-600" : ""}`}>
                  {formatNumber(r.cost_variance)}
                </td>
                <td className="px-4 py-3 text-right">{formatNumber(r.margin_estimate)}</td>
                <td className="px-4 py-3 text-right">{formatNumber(r.margin_actual)}</td>
                <td className="px-4 py-3">{r.invoice_no ?? <span className="text-slate-400">ยังไม่มี Invoice</span>}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="bg-slate-50 font-semibold text-slate-700">
              <tr>
                <td className="px-4 py-3" colSpan={5}>
                  รวม {rows.length} รายการ
                </td>
                <td className="px-4 py-3 text-right">{formatNumber(totals.selling)}</td>
                <td className="px-4 py-3 text-right">{formatNumber(totals.costEstimate)}</td>
                <td className="px-4 py-3 text-right">{formatNumber(totals.costInvoice)}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right">{formatNumber(totals.marginEstimate)}</td>
                <td className="px-4 py-3 text-right">{formatNumber(totals.marginActual)}</td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
