"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Globe2, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import {
  createInsuranceCountryCap,
  deleteInsuranceCountryCap,
  importInsuranceCountryCaps,
  listInsuranceCountryCaps,
  updateInsuranceCountryCap,
  type InsuranceCountryCap,
  type InsuranceCountryCapInput,
} from "@/lib/insuranceCountryCaps";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
const labelClass = "text-sm font-medium text-slate-600";

function CapForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: InsuranceCountryCap | null;
  onSubmit: (data: InsuranceCountryCapInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    country_name: initial?.country_name ?? "",
    country_code: initial?.country_code ?? "",
    ups_max_value: initial?.ups_max_value != null ? String(initial.ups_max_value) : "",
    dhl_max_value: initial?.dhl_max_value != null ? String(initial.dhl_max_value) : "",
    ups_max_declared: initial?.ups_max_declared != null ? String(initial.ups_max_declared) : "",
    dhl_max_declared: initial?.dhl_max_declared != null ? String(initial.dhl_max_declared) : "",
    note: initial?.note ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        country_name: form.country_name.trim(),
        country_code: form.country_code.trim() || undefined,
        ups_max_value: form.ups_max_value ? Number(form.ups_max_value) : undefined,
        dhl_max_value: form.dhl_max_value ? Number(form.dhl_max_value) : undefined,
        ups_max_declared: form.ups_max_declared ? Number(form.ups_max_declared) : undefined,
        dhl_max_declared: form.dhl_max_declared ? Number(form.dhl_max_declared) : undefined,
        note: form.note.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Country Name</span>
          <input
            type="text"
            required
            value={form.country_name}
            onChange={(e) => setForm((p) => ({ ...p, country_name: e.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Country Code</span>
          <input
            type="text"
            maxLength={5}
            value={form.country_code}
            onChange={(e) => setForm((p) => ({ ...p, country_code: e.target.value }))}
            className={inputClass}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>UPS Max Value (THB)</span>
          <input
            type="number"
            min={0}
            value={form.ups_max_value}
            onChange={(e) => setForm((p) => ({ ...p, ups_max_value: e.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>DHL Max Value (THB)</span>
          <input
            type="number"
            min={0}
            value={form.dhl_max_value}
            onChange={(e) => setForm((p) => ({ ...p, dhl_max_value: e.target.value }))}
            className={inputClass}
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>UPS Max Declared (THB)</span>
          <input
            type="number"
            min={0}
            value={form.ups_max_declared}
            onChange={(e) => setForm((p) => ({ ...p, ups_max_declared: e.target.value }))}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>DHL Max Declared (THB)</span>
          <input
            type="number"
            min={0}
            value={form.dhl_max_declared}
            onChange={(e) => setForm((p) => ({ ...p, dhl_max_declared: e.target.value }))}
            className={inputClass}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className={labelClass}>Note (e.g. Sanction / War Exclusion)</span>
        <input
          type="text"
          value={form.note}
          onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
          className={inputClass}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:brightness-95 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

export default function InsuranceCountryCapsPage() {
  const [rows, setRows] = useState<InsuranceCountryCap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalRow, setModalRow] = useState<InsuranceCountryCap | "new" | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load(overrides?: { page?: number }) {
    setLoading(true);
    setError("");
    try {
      const res = await listInsuranceCountryCaps({ q: query || undefined, page: overrides?.page ?? page });
      setRows(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleSearch() {
    setPage(1);
    load({ page: 1 });
  }

  async function handleFormSubmit(data: InsuranceCountryCapInput) {
    if (modalRow && modalRow !== "new") {
      await updateInsuranceCountryCap(modalRow.id, data);
    } else {
      await createInsuranceCountryCap(data);
    }
    setModalRow(null);
    await load();
  }

  async function handleDelete(row: InsuranceCountryCap) {
    if (!confirm(`Delete "${row.country_name}"?`)) return;
    await deleteInsuranceCountryCap(row.id);
    await load();
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError("");
    setUploadMessage("");
    try {
      const res = await importInsuranceCountryCaps(uploadFile);
      setUploadMessage(res.message);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setPage(1);
      await load({ page: 1 });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to import file");
    } finally {
      setUploading(false);
    }
  }

  function fmt(v: string | number | null) {
    if (v === null || v === undefined) return "-";
    return Number(v).toLocaleString();
  }

  return (
    <div className="relative min-h-[360px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Insurance Country Caps"
          description={`Max insurance coverage per box, by country/carrier — ${total.toLocaleString()} countries`}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setShowUpload(true);
              setUploadMessage("");
              setUploadError("");
            }}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            Upload CSV
          </button>
          <button
            type="button"
            onClick={() => setModalRow("new")}
            className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
          >
            <Plus className="h-4 w-4" />
            Add Entry
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Search by country name / code</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. Japan, US"
            className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          />
        </label>
        <button
          type="button"
          onClick={handleSearch}
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <PageLoading label="กำลังโหลดข้อมูล Insurance Country Caps..." />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <Globe2 className="h-10 w-10 text-brand-amber" />
          <p className="font-medium text-slate-600">No results found</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Country</th>
                  <th className="px-5 py-2.5 font-medium">Code</th>
                  <th className="px-5 py-2.5 font-medium text-right">UPS Max Value</th>
                  <th className="px-5 py-2.5 font-medium text-right">DHL Max Value</th>
                  <th className="px-5 py-2.5 font-medium text-right">UPS Max Declared</th>
                  <th className="px-5 py-2.5 font-medium text-right">DHL Max Declared</th>
                  <th className="px-5 py-2.5 font-medium">Note</th>
                  <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-700">{row.country_name}</td>
                    <td className="px-5 py-3 text-slate-500">{row.country_code ?? "-"}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{fmt(row.ups_max_value)}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{fmt(row.dhl_max_value)}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{fmt(row.ups_max_declared)}</td>
                    <td className="px-5 py-3 text-right text-slate-500">{fmt(row.dhl_max_declared)}</td>
                    <td className="px-5 py-3 text-slate-500">{row.note ?? "-"}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setModalRow(row)}
                        className="mr-2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              Page {page} / {lastPage} ({total.toLocaleString()} entries)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page >= lastPage}
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {modalRow && (
        <Modal title={modalRow === "new" ? "Add Country" : "Edit Country"} onClose={() => setModalRow(null)}>
          <CapForm
            initial={modalRow === "new" ? null : modalRow}
            onSubmit={handleFormSubmit}
            onCancel={() => setModalRow(null)}
          />
        </Modal>
      )}

      {showUpload && (
        <Modal title="Upload CSV (Full Replace)" onClose={() => setShowUpload(false)}>
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-400">
              CSV header: country_name, country_code, ups_max_value, dhl_max_value, ups_max_declared,
              dhl_max_declared, note. Uploading a file replaces ALL existing rows in this table.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
            {uploadMessage && <p className="text-sm text-emerald-600">{uploadMessage}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:brightness-95 disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload & Replace"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
