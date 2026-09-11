"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Pencil, Plus, Search, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import ThaiSubdistrictForm from "@/components/config/ThaiSubdistrictForm";
import {
  createThaiSubdistrict,
  deleteThaiSubdistrict,
  listThaiRegions,
  listThaiSubdistricts,
  updateThaiSubdistrict,
  type ThaiSubdistrict,
  type ThaiSubdistrictInput,
} from "@/lib/thaiSubdistricts";

export default function ThaiSubdistrictsPage() {
  const [rows, setRows] = useState<ThaiSubdistrict[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [regions, setRegions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalRow, setModalRow] = useState<ThaiSubdistrict | "new" | null>(null);

  async function load(overrides?: { region?: string; page?: number }) {
    setLoading(true);
    setError("");
    try {
      const res = await listThaiSubdistricts({
        zip_code: zipCode || undefined,
        q: query || undefined,
        region: (overrides?.region ?? region) || undefined,
        page: overrides?.page ?? page,
      });
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
    listThaiRegions().then(setRegions).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleSearch() {
    setPage(1);
    load();
  }

  async function handleSubmit(data: ThaiSubdistrictInput) {
    if (modalRow && modalRow !== "new") {
      await updateThaiSubdistrict(modalRow.id, data);
    } else {
      await createThaiSubdistrict(data);
    }
    setModalRow(null);
    await load();
  }

  async function handleDelete(row: ThaiSubdistrict) {
    if (!confirm(`Delete "${row.name_th}" (${row.zip_code})?`)) return;
    await deleteThaiSubdistrict(row.id);
    await load();
  }

  return (
    <div className="relative min-h-[360px]">
      <div className="mb-6 flex items-start justify-between">
        <PageHeader
          title="Thai Address Database (Subdistrict / District / Province / Zip Code)"
          description={`Thailand address reference data — ${total.toLocaleString()} entries total (edit by referencing zip code)`}
        />
        <button
          type="button"
          onClick={() => setModalRow("new")}
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Plus className="h-4 w-4" />
          Add Entry
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Search by zip code</span>
          <input
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. 10200"
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Search by subdistrict / district / province name</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="e.g. Bang Rak"
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Filter by region</span>
          <select
            value={region}
            onChange={(e) => {
              const value = e.target.value;
              setRegion(value);
              setPage(1);
              load({ region: value, page: 1 });
            }}
            className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          >
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
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
        <PageLoading label="กำลังโหลดข้อมูลที่อยู่..." />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <MapPin className="h-10 w-10 text-brand-amber" />
          <p className="font-medium text-slate-600">No results found</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Zip Code</th>
                  <th className="px-5 py-2.5 font-medium">Subdistrict</th>
                  <th className="px-5 py-2.5 font-medium">District</th>
                  <th className="px-5 py-2.5 font-medium">Province</th>
                  <th className="px-5 py-2.5 font-medium">Region</th>
                  <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-700">{row.zip_code}</td>
                    <td className="px-5 py-3 text-slate-500">
                      <div className="text-slate-700">{row.name_th}</div>
                      {row.name_en && <div className="text-xs text-slate-400">{row.name_en}</div>}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      <div>{row.district_name_th}</div>
                      {row.district_name_en && <div className="text-xs text-slate-400">{row.district_name_en}</div>}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      <div>{row.province_name_th}</div>
                      {row.province_name_en && <div className="text-xs text-slate-400">{row.province_name_en}</div>}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{row.region ?? "-"}</td>
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
                className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page >= lastPage}
                className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {modalRow && (
        <Modal
          title={modalRow === "new" ? "Add Address Entry" : `Edit ${modalRow.name_th} (${modalRow.zip_code})`}
          onClose={() => setModalRow(null)}
        >
          <ThaiSubdistrictForm
            initial={modalRow === "new" ? null : modalRow}
            onSubmit={handleSubmit}
            onCancel={() => setModalRow(null)}
          />
        </Modal>
      )}
    </div>
  );
}
