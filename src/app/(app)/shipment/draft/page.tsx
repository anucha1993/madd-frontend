"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FilePenLine, Loader2, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { listShipmentDrafts, deleteShipmentDraft, type ShipmentDraft } from "@/lib/shipmentDrafts";

// Best-effort summary line pulled straight out of the draft's raw form_state (see
// buildDraftSnapshot in shipment/create/page.tsx) — deliberately loose/defensive since the shape
// isn't strongly typed here (this page doesn't need to know every field, just enough to display).
function draftSummary(draft: ShipmentDraft): string {
  const state = draft.form_state as { destination?: { contactName?: string; city?: string; country?: string } };
  const d = state?.destination;
  const parts = [d?.contactName, d?.city, d?.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "ยังไม่ได้กรอกข้อมูลผู้รับ";
}

export default function ShipmentDraftListPage() {
  const [drafts, setDrafts] = useState<ShipmentDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setDrafts(await listShipmentDrafts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดฉบับร่างไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(draft: ShipmentDraft) {
    if (!confirm(`ลบฉบับร่าง "${draft.name || draftSummary(draft)}" ใช่หรือไม่?`)) return;
    setDeletingId(draft.id);
    try {
      await deleteShipmentDraft(draft.id);
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "ลบฉบับร่างไม่สำเร็จ");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Shipment Drafts"
        description="ฉบับร่างที่บันทึกไว้จาก Create Shipment — แก้ไข/ลบได้ตราบใดที่ยังไม่ถูกสร้างเป็น Shipment จริง"
      />

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
            <tr>
              <th className="px-5 py-2.5 font-medium">Name</th>
              <th className="px-5 py-2.5 font-medium">Destination</th>
              <th className="px-5 py-2.5 font-medium">Last Updated</th>
              <th className="px-5 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : drafts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                  ยังไม่มีฉบับร่างที่บันทึกไว้
                </td>
              </tr>
            ) : (
              drafts.map((d) => (
                <tr key={d.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-700">{d.name || "-"}</td>
                  <td className="px-5 py-3 text-slate-500">{draftSummary(d)}</td>
                  <td className="px-5 py-3 text-slate-500">{new Date(d.updated_at).toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link
                        href={`/shipment/create?draft=${d.id}`}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-brand-navy hover:bg-slate-100"
                        title="แก้ไขฉบับร่าง"
                      >
                        <FilePenLine className="h-4 w-4" />
                        แก้ไข
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(d)}
                        disabled={deletingId === d.id}
                        className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Delete draft"
                        title="ลบฉบับร่าง"
                      >
                        {deletingId === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
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
