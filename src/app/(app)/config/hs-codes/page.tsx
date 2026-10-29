"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import {
  createHsCode,
  deleteHsCode,
  importHsCodes,
  listHsCodes,
  updateHsCode,
  type HsCode,
  type HsCodeInput,
} from "@/lib/hsCodes";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
const labelClass = "text-sm font-medium text-slate-600";

type CodeForm = { code: string; description: string; chapter: string; status: boolean };
const emptyForm: CodeForm = { code: "", description: "", chapter: "", status: true };

/** HS / HTS code list — feeds the HS Code dropdown of the Commercial Invoice on /shipment/create. */
export default function HsCodesPage() {
  const [codes, setCodes] = useState<HsCode[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<HsCode | null>(null);
  const [form, setForm] = useState<CodeForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    listHsCodes({ q: search.trim() || undefined, page })
      .then((res) => {
        setCodes(res.data);
        setTotal(res.total);
        setLastPage(res.last_page);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load HS codes"))
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  }

  function openEdit(code: HsCode) {
    setEditing(code);
    setForm({ code: code.code_formatted, description: code.description, chapter: code.chapter ?? "", status: code.status });
    setFormError("");
    setShowModal(true);
  }

  async function handleSave() {
    setSaving(true);
    setFormError("");
    try {
      const payload: HsCodeInput = { code: form.code.trim(), description: form.description.trim(), chapter: form.chapter.trim() || null, status: form.status };
      if (editing) await updateHsCode(editing.id, payload);
      else await createHsCode(payload);
      setShowModal(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save HS code");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(code: HsCode) {
    if (!confirm(`Delete HS Code ${code.code_formatted} — ${code.description}?`)) return;
    await deleteHsCode(code.id);
    load();
  }

  async function handleImport(file: File | null) {
    if (!file) return;
    setImporting(true);
    setError("");
    setNotice("");
    try {
      const res = await importHsCodes(file);
      setNotice(`นำเข้าแล้ว: เพิ่มใหม่ ${res.created} · อัปเดต ${res.updated} · ข้าม ${res.skipped} แถว`);
      setPage(1);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader
        title="HS Code"
        description="ฐานข้อมูล HS / HTS Code สำหรับช่อง HS Code ใน Commercial Invoice (/shipment/create) — เริ่มต้นจาก CPSC eFiling HTS List (Jan 2026)"
      />

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      {notice && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="ค้นหา HS Code หรือสินค้า..."
            className={`${inputClass} pl-9`}
          />
        </div>
        <span className="text-xs text-slate-400">{total} รายการ</span>
        <div className="ml-auto flex gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleImport(e.target.files?.[0] ?? null)} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            title='Excel ที่มีคอลัมน์ "HS Code" (หรือ "HTS Code (10-digit)") และ "Description" (หรือ "Product Category") — รายการเดิมจะอัปเดต ไม่ซ้ำ'
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <Upload className="h-4 w-4" /> {importing ? "Importing..." : "Import Excel"}
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
          >
            <Plus className="h-4 w-4" /> Add HS Code
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
            <tr>
              <th className="px-5 py-2.5 font-medium">HS Code</th>
              <th className="px-5 py-2.5 font-medium">Description</th>
              <th className="px-5 py-2.5 font-medium">Chapter</th>
              <th className="px-5 py-2.5 font-medium">Source</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && codes.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-sm text-slate-400">
                  ไม่พบ HS Code
                </td>
              </tr>
            ) : (
              codes.map((code) => (
                <tr key={code.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-5 py-2.5 font-mono font-medium text-slate-700">{code.code_formatted}</td>
                  <td className="px-5 py-2.5 text-slate-600">{code.description}</td>
                  <td className="px-5 py-2.5 text-slate-500">{code.chapter ?? "-"}</td>
                  <td className="px-5 py-2.5 text-xs text-slate-400">{code.source ?? "-"}</td>
                  <td className="px-5 py-2.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${code.status ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                      {code.status ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => openEdit(code)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(code)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50" aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
            ก่อนหน้า
          </button>
          <span className="text-slate-500">
            {page} / {lastPage}
          </span>
          <button type="button" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
            ถัดไป
          </button>
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit HS Code" : "Add HS Code"} onClose={() => setShowModal(false)}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>HS Code</span>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="e.g. 6109.10.0012"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>Chapter (optional)</span>
                <input type="text" value={form.chapter} onChange={(e) => setForm((prev) => ({ ...prev, chapter: e.target.value }))} placeholder="e.g. 61" className={inputClass} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Description</span>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. T-shirts, cotton"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Status</span>
              <select value={form.status ? "1" : "0"} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value === "1" }))} className={inputClass}>
                <option value="1">Active</option>
                <option value="0">Inactive (ไม่ขึ้นในช่องค้นหา)</option>
              </select>
            </label>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.code.trim() || !form.description.trim()}
                className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
              >
                {saving ? "Saving..." : editing ? "Save Changes" : "Add"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
