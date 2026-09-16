"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import {
  createProductWeightBand,
  deleteProductWeightBand,
  listProductWeightBands,
  updateProductWeightBand,
  type ProductWeightBand,
  type ProductWeightBandInput,
} from "@/lib/productWeightBands";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
const labelClass = "text-sm font-medium text-slate-600";

type BandForm = {
  code: string;
  label: string;
  package_type: "box" | "document";
  min_weight: string;
  max_weight: string;
  status: boolean;
};

const emptyForm: BandForm = {
  code: "",
  label: "",
  package_type: "box",
  min_weight: "",
  max_weight: "",
  status: true,
};

export default function WeightBandsPage() {
  const [bands, setBands] = useState<ProductWeightBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingBand, setEditingBand] = useState<ProductWeightBand | null>(null);
  const [form, setForm] = useState<BandForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      setBands(await listProductWeightBands());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load weight bands");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingBand(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  }

  function openEdit(band: ProductWeightBand) {
    setEditingBand(band);
    setForm({
      code: band.code,
      label: band.label,
      package_type: band.package_type,
      min_weight: band.min_weight != null ? String(band.min_weight) : "",
      max_weight: band.max_weight != null ? String(band.max_weight) : "",
      status: band.status,
    });
    setFormError("");
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.code.trim() || !form.label.trim()) return;
    setSaving(true);
    setFormError("");
    try {
      const payload: ProductWeightBandInput = {
        code: form.code.trim(),
        label: form.label.trim(),
        package_type: form.package_type,
        min_weight: form.min_weight ? Number(form.min_weight) : null,
        max_weight: form.max_weight ? Number(form.max_weight) : null,
        status: form.status,
      };

      if (editingBand) {
        const updated = await updateProductWeightBand(editingBand.id, payload);
        setBands((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      } else {
        const created = await createProductWeightBand(payload);
        setBands((prev) => [...prev, created]);
      }
      setShowModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save weight band");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(band: ProductWeightBand) {
    if (!confirm(`Delete weight band "${band.label}"?`)) return;
    await deleteProductWeightBand(band.id);
    setBands((prev) => prev.filter((b) => b.id !== band.id));
  }

  return (
    <div>
      <PageHeader
        title="Shipment Weight Bands"
        description="กำหนดช่วงน้ำหนักที่ใช้จัดกลุ่ม Shipment อัตโนมัติ (ใช้แสดงในหน้า Create Shipment และรายงาน)"
      />

      {loading ? (
        <PageLoading label="Loading Weight Bands..." />
      ) : (
        <>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
            >
              <Plus className="h-4 w-4" /> Add Weight Band
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Code</th>
                  <th className="px-5 py-2.5 font-medium">Label</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 font-medium text-right">Min (kg)</th>
                  <th className="px-5 py-2.5 font-medium text-right">Max (kg)</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bands.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-6 text-center text-sm text-slate-400">
                      No weight bands yet.
                    </td>
                  </tr>
                ) : (
                  bands.map((band) => (
                    <tr key={band.id} className="border-b border-slate-200 last:border-0">
                      <td className="px-5 py-3 font-medium text-slate-700">{band.code}</td>
                      <td className="px-5 py-3 text-slate-500">{band.label}</td>
                      <td className="px-5 py-3 text-slate-500">{band.package_type === "document" ? "Document" : "Box"}</td>
                      <td className="px-5 py-3 text-right text-slate-500">{band.min_weight ?? "-"}</td>
                      <td className="px-5 py-3 text-right text-slate-500">{band.max_weight ?? "-"}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            band.status ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {band.status ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(band)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(band)}
                            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                            aria-label="Delete"
                          >
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

          {showModal && (
            <Modal title={editingBand ? "Edit Weight Band" : "Add Weight Band"} onClose={() => setShowModal(false)}>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>Code</span>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                      placeholder="e.g. REG_5.1-20KG"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>Label</span>
                    <input
                      type="text"
                      value={form.label}
                      onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                      placeholder="e.g. REG 5.1-20KG"
                      className={inputClass}
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Package Type</span>
                  <select
                    value={form.package_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, package_type: e.target.value as "box" | "document" }))}
                    className={inputClass}
                  >
                    <option value="box">Box</option>
                    <option value="document">Document</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>Min Weight (kg, optional)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={form.min_weight}
                      onChange={(e) => setForm((prev) => ({ ...prev, min_weight: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>Max Weight (kg, optional)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={form.max_weight}
                      onChange={(e) => setForm((prev) => ({ ...prev, max_weight: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                </div>
                <p className="text-xs text-slate-400">
                  ปล่อยว่าง Min/Max ไว้ได้สำหรับหมวดพิเศษที่ไม่ได้อิงตามน้ำหนัก (เช่น CPM10, CPM25, F/C) — ระบบจะไม่จับคู่อัตโนมัติให้กับหมวดเหล่านี้
                </p>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Status</span>
                  <select
                    value={form.status ? "1" : "0"}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value === "1" }))}
                    className={inputClass}
                  >
                    <option value="1">Active</option>
                    <option value="0">Inactive</option>
                  </select>
                </label>

                {formError && <p className="text-sm text-red-600">{formError}</p>}

                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !form.code.trim() || !form.label.trim()}
                    className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : editingBand ? "Save Changes" : "Add"}
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
