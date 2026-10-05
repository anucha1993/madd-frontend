"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Loader2, Pencil, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useAccess } from "@/components/auth/AccessProvider";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import {
  deleteCarrierInvoice,
  listCarrierInvoices,
  reparseCarrierInvoice,
  updateCarrierInvoice,
  uploadCarrierInvoice,
  type CarrierInvoice,
  type CarrierInvoiceStatus,
} from "@/lib/carrierInvoices";

const inputClass =
  "rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
const labelClass = "text-sm font-medium text-slate-600";

const STATUS_STYLES: Record<CarrierInvoiceStatus, string> = {
  uploaded: "bg-slate-100 text-slate-600",
  parsing: "bg-amber-50 text-amber-600",
  parsed: "bg-emerald-50 text-emerald-600",
  failed: "bg-red-50 text-red-600",
};

const STATUS_LABELS: Record<CarrierInvoiceStatus, string> = {
  uploaded: "รออ่าน",
  parsing: "กำลังอ่าน (OCR)...",
  parsed: "อ่านสำเร็จ",
  failed: "อ่านไม่สำเร็จ",
};

export default function CarrierInvoicesPage() {
  const { can } = useAccess();
  const [invoices, setInvoices] = useState<CarrierInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadCarrier, setUploadCarrier] = useState<"UPS" | "DHL">("UPS");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadInvoiceNo, setUploadInvoiceNo] = useState("");
  const [uploadInvoiceDate, setUploadInvoiceDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [editTarget, setEditTarget] = useState<CarrierInvoice | null>(null);
  const [editInvoiceNo, setEditInvoiceNo] = useState("");
  const [editInvoiceDate, setEditInvoiceDate] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await listCarrierInvoices({ carrier: carrierFilter || undefined, status: statusFilter || undefined });
      setInvoices(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load carrier invoices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrierFilter, statusFilter]);

  // Poll while any invoice is still parsing, so status updates without manual refresh.
  useEffect(() => {
    if (!invoices.some((inv) => inv.status === "parsing" || inv.status === "uploaded")) return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices]);

  function openUploadModal() {
    setUploadCarrier("UPS");
    setUploadFile(null);
    setUploadInvoiceNo("");
    setUploadInvoiceDate("");
    setUploadError("");
    setUploadOpen(true);
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError("");
    try {
      await uploadCarrierInvoice({
        file: uploadFile,
        carrier: uploadCarrier,
        invoice_no: uploadInvoiceNo || undefined,
        invoice_date: uploadInvoiceDate || undefined,
      });
      setUploadOpen(false);
      load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload invoice");
    } finally {
      setUploading(false);
    }
  }

  async function handleReparse(id: number) {
    try {
      await reparseCarrierInvoice(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reparse invoice");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("ลบใบแจ้งหนี้นี้ใช่หรือไม่?")) return;
    try {
      await deleteCarrierInvoice(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete invoice");
    }
  }

  function openEditModal(inv: CarrierInvoice) {
    setEditTarget(inv);
    setEditInvoiceNo(inv.invoice_no ?? "");
    setEditInvoiceDate(inv.invoice_date ? inv.invoice_date.slice(0, 10) : "");
    setEditError("");
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setEditSaving(true);
    setEditError("");
    try {
      await updateCarrierInvoice(editTarget.id, {
        invoice_no: editInvoiceNo || undefined,
        invoice_date: editInvoiceDate || undefined,
      });
      setEditTarget(null);
      load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save invoice");
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Carrier Invoices"
        description="อัพโหลดใบแจ้งหนี้จริงจาก UPS/DHL ให้ระบบอ่านอัตโนมัติ แล้วเทียบกับยอด Rate Quote ตอน book"
        actions={
          can("carrier_invoice.upload") ? (
            <button
              type="button"
              onClick={openUploadModal}
              className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90"
            >
              <Plus className="h-4 w-4" /> อัพโหลด Invoice
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Carrier</span>
          <select value={carrierFilter} onChange={(e) => setCarrierFilter(e.target.value)} className={inputClass}>
            <option value="">ทั้งหมด</option>
            <option value="UPS">UPS</option>
            <option value="DHL">DHL</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
            <option value="">ทั้งหมด</option>
            <option value="uploaded">รออ่าน</option>
            <option value="parsing">กำลังอ่าน</option>
            <option value="parsed">อ่านสำเร็จ</option>
            <option value="failed">อ่านไม่สำเร็จ</option>
          </select>
        </label>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <PageLoading />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Carrier</th>
                <th className="px-4 py-3">Invoice No.</th>
                <th className="px-4 py-3">วันที่</th>
                <th className="px-4 py-3">จำนวนรายการ</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{inv.carrier}</td>
                  <td className="px-4 py-3">
                    <Link href={`/billing/carrier-invoices/${inv.id}`} className="flex items-center gap-1.5 text-brand-navy hover:underline">
                      <FileText className="h-3.5 w-3.5" />
                      {inv.invoice_no || inv.original_filename || `#${inv.id}`}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString("th-TH") : "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{inv.lines_count ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[inv.status]}`}>
                      {inv.status === "parsing" && <Loader2 className="h-3 w-3 animate-spin" />}
                      {STATUS_LABELS[inv.status]}
                    </span>
                    {inv.status === "failed" && inv.error_message && <p className="mt-1 max-w-xs text-xs text-red-500">{inv.error_message}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {can("carrier_invoice.edit") && (
                        <button type="button" onClick={() => openEditModal(inv)} title="แก้ไขเลขที่/วันที่ Invoice" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-navy">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {can("carrier_invoice.upload") && (
                        <button type="button" onClick={() => handleReparse(inv.id)} title="อ่านใหม่ (OCR)" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-navy">
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      )}
                      {can("carrier_invoice.delete") && (
                        <button type="button" onClick={() => handleDelete(inv.id)} title="ลบ" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    ยังไม่มีใบแจ้งหนี้ที่อัพโหลด
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {uploadOpen && (
        <Modal onClose={() => setUploadOpen(false)} title="อัพโหลดใบแจ้งหนี้ (PDF)">
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Carrier</span>
              <select value={uploadCarrier} onChange={(e) => setUploadCarrier(e.target.value as "UPS" | "DHL")} className={inputClass}>
                <option value="UPS">UPS</option>
                <option value="DHL">DHL</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>ไฟล์ PDF</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Invoice No. (ไม่บังคับ)</span>
              <input type="text" value={uploadInvoiceNo} onChange={(e) => setUploadInvoiceNo(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>วันที่ (ไม่บังคับ)</span>
              <input type="date" value={uploadInvoiceDate} onChange={(e) => setUploadInvoiceDate(e.target.value)} className={inputClass} />
            </label>
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setUploadOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !uploadFile}
                className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {uploading ? "กำลังอัพโหลด..." : "อัพโหลด"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editTarget && (
        <Modal onClose={() => setEditTarget(null)} title="แก้ไขเลขที่/วันที่ Invoice">
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Invoice No.</span>
              <input type="text" value={editInvoiceNo} onChange={(e) => setEditInvoiceNo(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>วันที่</span>
              <input type="date" value={editInvoiceDate} onChange={(e) => setEditInvoiceDate(e.target.value)} className={inputClass} />
            </label>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setEditTarget(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
              >
                {editSaving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
