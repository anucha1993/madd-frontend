"use client";

import { useEffect, useState } from "react";
import { Eye, Search, Loader2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { listShipments, openShipmentLabel, type Shipment } from "@/lib/shipments";

const STATUS_STYLE: Record<string, string> = {
  booked: "bg-emerald-50 text-emerald-600",
  pending: "bg-amber-50 text-amber-600",
  failed: "bg-red-50 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  booked: "Booked",
  pending: "Pending",
  failed: "Failed",
};

export default function ShipmentListPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [carrier, setCarrier] = useState<"" | "UPS" | "DHL">("");
  const [openingLabelId, setOpeningLabelId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await listShipments({
        search: search.trim() || undefined,
        status: status || undefined,
        carrier: carrier || undefined,
      });
      setShipments(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูล Shipment ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleViewLabel(shipment: Shipment) {
    if (!shipment.label_storage_key) return;
    setOpeningLabelId(shipment.id);
    try {
      await openShipmentLabel(shipment.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "เปิด Label ไม่สำเร็จ");
    } finally {
      setOpeningLabelId(null);
    }
  }

  return (
    <div>
      <PageHeader title="My Shipments" description="Shipment ทั้งหมดที่จองจริงกับ UPS/DHL ผ่านระบบนี้" />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Tracking No."
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          >
            <option value="">All</option>
            <option value="booked">Booked</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
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
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
            <tr>
              <th className="px-5 py-2.5 font-medium">Tracking No.</th>
              <th className="px-5 py-2.5 font-medium">Carrier / Service</th>
              <th className="px-5 py-2.5 font-medium">Destination</th>
              <th className="px-5 py-2.5 font-medium">Date</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium text-right">Amount (THB)</th>
              <th className="px-5 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : shipments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  ยังไม่มี Shipment ที่จองไว้
                </td>
              </tr>
            ) : (
              shipments.map((s) => (
                <tr key={s.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-5 py-3 font-mono font-medium text-slate-700">{s.tracking_number ?? "-"}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {s.carrier} — {s.service_label ?? s.service_code}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {[s.destination?.contact_name, s.destination?.city, s.destination?.country].filter(Boolean).join(", ") || "-"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status] ?? "bg-slate-50 text-slate-500"}`}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">
                    {Number(s.order_total).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleViewLabel(s)}
                      disabled={!s.label_storage_key || openingLabelId === s.id}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="View Label"
                      title={s.label_storage_key ? "เปิด Label" : "ไม่มี Label"}
                    >
                      {openingLabelId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
