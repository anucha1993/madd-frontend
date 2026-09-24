"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ClipboardList, Download, Search, Loader2, ChevronRight } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { listBranches, type Branch } from "@/lib/branches";
import {
  listManifestReport,
  downloadManifestReport,
  type ManifestRangePreset,
  type ManifestReportResult,
} from "@/lib/manifestReport";

const RANGE_OPTIONS: { value: ManifestRangePreset; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "custom", label: "Custom" },
];

const COLUMN_LABELS = [
  "Tracking", "Vol./No.", "Zone", "Act", "Dim", "Pay", "Dest", "Type", "Pkg", "Shipper", "Consignee",
  "Freight", "Sur", "Accs", "Ins.", "Ins-Co", "Metal", "Form", "Other", "Total Charge", "Remark", "Inv.Value",
];

function formatNumber(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ManifestPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [range, setRange] = useState<ManifestRangePreset>("daily");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [carrier, setCarrier] = useState<"" | "UPS" | "DHL">("");
  const [result, setResult] = useState<ManifestReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  // null = show the list of Accounts; a group index = drill into that Account's manifest table.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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
    setSelectedIndex(null);
    try {
      setResult(await listManifestReport(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load manifest report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    listBranches()
      .then(setBranches)
      .catch(() => undefined);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadManifestReport(filters);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to export manifest report");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Manifest" description="จัดทำใบนำส่งพัสดุ (Manifest) และ Export เป็น Excel" />

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
                {b.name} ({b.code})
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
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !result || result.total_shipments === 0}
          className="flex items-center gap-2 rounded-lg border border-brand-navy-dark px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-navy-dark/5 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export Excel
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {!loading && result && result.total_shipments === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-slate-400">
          <ClipboardList className="mb-3 h-10 w-10" />
          <p className="text-sm">ไม่พบข้อมูล Shipment สำหรับช่วงเวลา/ตัวกรองที่เลือก</p>
        </div>
      )}

      {result && result.groups.length > 0 && selectedIndex === null && (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {result.groups.map((group, gi) => (
            <button
              key={gi}
              type="button"
              onClick={() => setSelectedIndex(gi)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy/10 text-brand-navy">
                  <ClipboardList className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-800">
                    {group.header.carrier} — {group.header.account_number}
                  </p>
                  <p className="text-sm text-slate-500">
                    {group.header.branch_name} ({group.header.branch_code}) · {group.rows.length} shipment(s) · {group.header.date}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      )}

      {result && selectedIndex !== null && result.groups[selectedIndex] && (
        <div>
          <button
            type="button"
            onClick={() => setSelectedIndex(null)}
            className="mb-4 flex items-center gap-2 text-sm font-medium text-brand-navy-dark hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Accounts
          </button>

          {(() => {
            const group = result.groups[selectedIndex];
            return (
              <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-slate-200 px-4 py-3 text-sm">
                  <span className="text-base font-bold text-slate-800">MANIFEST</span>
                  <span className="text-slate-500">
                    Date: <span className="font-medium text-slate-700">{group.header.date}</span>
                  </span>
                  <span className="text-slate-500">
                    Account: <span className="font-medium text-slate-700">{group.header.account_number}</span>
                  </span>
                  <span className="text-slate-500">
                    Branch: <span className="font-medium text-slate-700">{group.header.branch_name} ({group.header.branch_code})</span>
                  </span>
                  <span className="text-slate-500">
                    Carrier: <span className="font-medium text-slate-700">{group.header.carrier}</span>
                  </span>
                </div>
                <table className="w-full min-w-[1400px] border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      {COLUMN_LABELS.map((label) => (
                        <th key={label} className="whitespace-nowrap border border-slate-700 px-2 py-1.5 font-semibold">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row, ri) => (
                      <tr key={ri} className="odd:bg-white even:bg-slate-50">
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1">{row.tracking}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1">{row.ref}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1">{row.zone}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1 text-right">{formatNumber(row.weight_act)}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1 text-right">{formatNumber(row.weight_dim)}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1">{row.pay}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1">{row.dest}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1">{row.type}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1 text-right">{row.pkg}</td>
                        <td className="max-w-[160px] truncate border border-slate-200 px-2 py-1">{row.shipper}</td>
                        <td className="max-w-[160px] truncate border border-slate-200 px-2 py-1">{row.consignee}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1 text-right">{formatNumber(row.freight)}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1 text-right">{formatNumber(row.sur)}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1 text-right">{formatNumber(row.accs)}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1 text-right">{formatNumber(row.ins)}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1">{row.ins_co}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1 text-right">{formatNumber(row.metal)}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1 text-right">{formatNumber(row.form)}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1 text-right">{formatNumber(row.other)}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1 text-right font-semibold">{formatNumber(row.total_charge)}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1">{row.remark}</td>
                        <td className="whitespace-nowrap border border-slate-200 px-2 py-1 text-right">{formatNumber(row.inv_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
