"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Loader2, RefreshCw, Search, XCircle } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import Modal from "@/components/ui/Modal";
import SchedulePickupModal from "@/components/pickup/SchedulePickupModal";
import { listPickups, cancelPickup, type Pickup } from "@/lib/pickups";

const STATUS_STYLE: Record<string, string> = {
  requested: "bg-emerald-50 text-emerald-600",
  cancelled: "bg-slate-100 text-slate-500",
  failed: "bg-red-50 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  cancelled: "Cancelled",
  failed: "Failed",
};

export default function PickupListPage() {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [carrier, setCarrier] = useState<"" | "UPS" | "DHL">("");
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [viewingPickup, setViewingPickup] = useState<Pickup | null>(null);
  // Set right after cancelling the OLD pickup being rescheduled — its presence opens
  // SchedulePickupModal prefilled with the same shipments/address/date/time (see handleReschedule).
  const [reschedulingPickup, setReschedulingPickup] = useState<Pickup | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await listPickups({ status: status || undefined, carrier: carrier || undefined });
      setPickups(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูล Pickup ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCancel(pickup: Pickup) {
    if (!confirm(`ยืนยันยกเลิก Pickup นี้กับ ${pickup.carrier} จริง? ย้อนกลับไม่ได้`)) return;
    setCancellingId(pickup.id);
    try {
      const updated = await cancelPickup(pickup.id);
      setPickups((prev) => prev.map((p) => (p.id === pickup.id ? updated : p)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "ยกเลิก Pickup ไม่สำเร็จ");
    } finally {
      setCancellingId(null);
    }
  }

  // No carrier API supports changing an existing Pickup's date/time/address — the only path is
  // cancel the old one, then create a brand new one with the same shipments (prefilled so staff
  // only have to fix whatever was wrong).
  async function handleReschedule(pickup: Pickup) {
    if (!confirm(`ยืนยันยกเลิก Pickup เดิมกับ ${pickup.carrier} เพื่อนัดหมายใหม่? ย้อนกลับไม่ได้`)) return;
    setCancellingId(pickup.id);
    try {
      const cancelled = await cancelPickup(pickup.id);
      setPickups((prev) => prev.map((p) => (p.id === pickup.id ? cancelled : p)));
      setReschedulingPickup(cancelled);
    } catch (err) {
      alert(err instanceof Error ? err.message : "ยกเลิก Pickup เพื่อนัดหมายใหม่ไม่สำเร็จ");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div>
      <PageHeader title="My Pickups" description="คำขอนัดหมายให้พนักงาน UPS/DHL มารับพัสดุ (รวมได้หลาย Shipment ต่อ 1 Pickup)" />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          >
            <option value="">All</option>
            <option value="requested">Requested</option>
            <option value="cancelled">Cancelled</option>
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

      {loading ? (
        <PageLoading label="Loading Pickups..." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
              <tr>
                <th className="px-5 py-2.5 font-medium">Pickup Date / Time</th>
                <th className="px-5 py-2.5 font-medium">Carrier</th>
                <th className="px-5 py-2.5 font-medium">Address</th>
                <th className="px-5 py-2.5 font-medium">Shipments</th>
                <th className="px-5 py-2.5 font-medium">Pieces / Weight</th>
                <th className="px-5 py-2.5 font-medium">Carrier Reference</th>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pickups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    ยังไม่มี Pickup ที่นัดหมายไว้
                  </td>
                </tr>
              ) : (
                pickups.map((p) => (
                  <tr key={p.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-5 py-3 text-slate-700">
                      {new Date(p.pickup_date).toLocaleDateString()} · {p.ready_time}–{p.close_time}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{p.carrier}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {[p.address?.address, p.address?.city, p.address?.postcode].filter(Boolean).join(", ") || "-"}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {(p.shipments ?? []).length} รายการ
                      {(p.shipments ?? []).length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-xs">
                          {(p.shipments ?? []).map((s, i) => (
                            <span key={s.id}>
                              <Link href={`/shipment/view/${s.id}`} className="font-mono text-brand-navy-dark hover:underline">
                                {s.tracking_number ?? `#${s.id}`}
                              </Link>
                              {i < (p.shipments ?? []).length - 1 && <span className="text-slate-300">,</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {p.total_pieces} กล่อง / {Number(p.total_weight).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-700">{p.carrier_reference ?? "-"}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status] ?? "bg-slate-50 text-slate-500"}`}>
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                      {p.status === "failed" && p.error_message && (
                        <div className="mt-1 max-w-xs truncate text-xs text-red-500" title={p.error_message}>
                          {p.error_message}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setViewingPickup(p)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                          aria-label="View Pickup"
                          title="ดูรายละเอียด Pickup"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {p.status === "requested" && p.carrier_reference && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleReschedule(p)}
                              disabled={cancellingId === p.id}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Reschedule Pickup"
                              title="ยกเลิกแล้วนัดหมายใหม่ (เปลี่ยนวัน/เวลา/ที่อยู่)"
                            >
                              {cancellingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancel(p)}
                              disabled={cancellingId === p.id}
                              className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Cancel Pickup"
                              title="ยกเลิก Pickup"
                            >
                              {cancellingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewingPickup && (
        <Modal title={`รายละเอียด Pickup #${viewingPickup.id}`} onClose={() => setViewingPickup(null)}>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-slate-400">Carrier</dt>
                <dd className="font-medium text-slate-800">{viewingPickup.carrier}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Status</dt>
                <dd>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[viewingPickup.status] ?? "bg-slate-50 text-slate-500"}`}>
                    {STATUS_LABEL[viewingPickup.status] ?? viewingPickup.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Pickup Date</dt>
                <dd className="font-medium text-slate-800">{new Date(viewingPickup.pickup_date).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Time Window</dt>
                <dd className="font-medium text-slate-800">
                  {viewingPickup.ready_time}–{viewingPickup.close_time}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Carrier Reference</dt>
                <dd className="font-mono font-medium text-slate-800">{viewingPickup.carrier_reference ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Pieces / Weight</dt>
                <dd className="font-medium text-slate-800">
                  {viewingPickup.total_pieces} กล่อง / {Number(viewingPickup.total_weight).toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
                </dd>
              </div>
            </div>

            {viewingPickup.error_message && (
              <div>
                <dt className="text-xs text-slate-400">Error</dt>
                <dd className="rounded-lg bg-red-50 px-3 py-2 text-red-600">{viewingPickup.error_message}</dd>
              </div>
            )}

            <div>
              <dt className="mb-1 text-xs text-slate-400">Pickup Address</dt>
              <dd className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                {[viewingPickup.address?.contact_name, viewingPickup.address?.company_name].filter(Boolean).join(" · ") || "-"}
                <br />
                {[viewingPickup.address?.address, viewingPickup.address?.city, viewingPickup.address?.postcode].filter(Boolean).join(", ")}
                <br />
                {[viewingPickup.address?.phone, viewingPickup.address?.email].filter(Boolean).join(" · ")}
              </dd>
            </div>

            <div>
              <dt className="mb-1 text-xs text-slate-400">Shipments ({(viewingPickup.shipments ?? []).length})</dt>
              <dd className="flex flex-col gap-1">
                {(viewingPickup.shipments ?? []).map((s) => (
                  <Link
                    key={s.id}
                    href={`/shipment/view/${s.id}`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-brand-navy-dark hover:bg-slate-50"
                  >
                    {s.tracking_number ?? `#${s.id}`}
                  </Link>
                ))}
              </dd>
            </div>
          </dl>
        </Modal>
      )}

      {reschedulingPickup && (
        <SchedulePickupModal
          shipments={reschedulingPickup.shipments ?? []}
          defaultValues={{
            pickup_date: new Date(reschedulingPickup.pickup_date).toISOString().slice(0, 10),
            ready_time: reschedulingPickup.ready_time,
            close_time: reschedulingPickup.close_time,
            contact_name: reschedulingPickup.address?.contact_name ?? "",
            company_name: reschedulingPickup.address?.company_name ?? "",
            phone: reschedulingPickup.address?.phone ?? "",
            email: reschedulingPickup.address?.email ?? "",
            address: reschedulingPickup.address?.address ?? "",
            city: reschedulingPickup.address?.city ?? "",
            postcode: reschedulingPickup.address?.postcode ?? "",
          }}
          onClose={() => setReschedulingPickup(null)}
          onCreated={(pickup) => {
            setReschedulingPickup(null);
            load();
            alert(
              pickup.status === "requested"
                ? `นัดหมาย Pickup ใหม่สำเร็จ — เลขอ้างอิงจาก ${pickup.carrier}: ${pickup.carrier_reference ?? "-"}`
                : `นัดหมาย Pickup ใหม่ไม่สำเร็จ: ${pickup.error_message ?? "unknown error"}`,
            );
          }}
        />
      )}
    </div>
  );
}
