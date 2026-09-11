"use client";

import { useEffect, useState } from "react";
import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import SupplyForm from "@/components/config/SupplyForm";
import { createSupply, deleteSupply, listSupplies, updateSupply, type Supply, type SupplyInput } from "@/lib/supplies";

function formatBaht(value: string | number) {
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SuppliesPage() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalSupply, setModalSupply] = useState<Supply | "new" | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      setSupplies(await listSupplies());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSubmit(data: SupplyInput) {
    if (modalSupply && modalSupply !== "new") {
      await updateSupply(modalSupply.id, data);
    } else {
      await createSupply(data);
    }
    setModalSupply(null);
    await loadAll();
  }

  async function handleDelete(supply: Supply) {
    if (!confirm(`Delete "${supply.name}"?`)) return;
    await deleteSupply(supply.id);
    await loadAll();
  }

  async function handleToggleStatus(supply: Supply) {
    setTogglingId(supply.id);
    const nextStatus = !supply.status;
    setSupplies((prev) => prev.map((s) => (s.id === supply.id ? { ...s, status: nextStatus } : s)));
    try {
      await updateSupply(supply.id, { status: nextStatus });
    } catch {
      setSupplies((prev) => prev.map((s) => (s.id === supply.id ? { ...s, status: !nextStatus } : s)));
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="relative min-h-[360px]">
      <div className="mb-6 flex items-start justify-between">
        <PageHeader title="Packaging Supplies" description="Manage box/envelope stock — size, cost, and sale price" />
        <button
          type="button"
          onClick={() => setModalSupply("new")}
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Plus className="h-4 w-4" />
          Add Supply
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {loading ? (
        <PageLoading label="กำลังโหลดข้อมูลอุปกรณ์..." />
      ) : supplies.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <Boxes className="h-10 w-10 text-brand-amber" />
          <p className="font-medium text-slate-600">No supplies yet</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
              <tr>
                <th className="px-5 py-2.5 font-medium">Icon</th>
                <th className="px-5 py-2.5 font-medium">Name</th>
                <th className="px-5 py-2.5 font-medium">Type</th>
                <th className="px-5 py-2.5 font-medium">Dimensions</th>
                <th className="px-5 py-2.5 font-medium">Cost Price</th>
                <th className="px-5 py-2.5 font-medium">Sale Price</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {supplies.map((supply) => (
                <tr key={supply.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    {supply.icon_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={supply.icon_url} alt={supply.name} className="h-8 w-8 object-contain" />
                    ) : (
                      <Boxes className="h-8 w-8 text-slate-300" />
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-700">{supply.name}</div>
                    {supply.description && <div className="text-xs text-slate-400">{supply.description}</div>}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{supply.type ?? "-"}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {supply.length && supply.width && supply.height
                      ? `${supply.length}x${supply.width}x${supply.height} cm`
                      : "-"}
                    {supply.weight ? ` / ${supply.weight} kg` : ""}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{formatBaht(supply.cost_price)}</td>
                  <td className="px-5 py-3 font-medium text-slate-700">{formatBaht(supply.sale_price)}</td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(supply)}
                      disabled={togglingId === supply.id}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-50 ${
                        supply.status
                          ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {togglingId === supply.id ? "..." : supply.status ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setModalSupply(supply)}
                      className="mr-2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(supply)}
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
      )}

      {modalSupply && (
        <Modal
          title={modalSupply === "new" ? "Add Supply" : `Edit ${modalSupply.name}`}
          onClose={() => setModalSupply(null)}
        >
          <SupplyForm
            initial={modalSupply === "new" ? null : modalSupply}
            onSubmit={handleSubmit}
            onCancel={() => setModalSupply(null)}
          />
        </Modal>
      )}
    </div>
  );
}
