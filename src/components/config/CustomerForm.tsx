"use client";

import { useState, type FormEvent } from "react";
import type { Customer, CustomerInput } from "@/lib/customers";

type Props = {
  initial?: Customer | null;
  onSubmit: (data: CustomerInput) => Promise<void>;
  onCancel: () => void;
};

export default function CustomerForm({ initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [companyName, setCompanyName] = useState(initial?.company_name ?? "");
  const [taxId, setTaxId] = useState(initial?.tax_id ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("กรุณากรอกชื่อลูกค้า");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        company_name: companyName.trim() || undefined,
        tax_id: taxId.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
  const labelClass = "text-sm font-medium text-slate-600";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>ชื่อลูกค้า</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>ชื่อบริษัท</span>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>เลขประจำตัวผู้เสียภาษี</span>
          <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>เบอร์โทร</span>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>อีเมล</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>บันทึกเพิ่มเติม</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${inputClass} resize-y`} />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:brightness-95 disabled:opacity-60"
        >
          {submitting ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </form>
  );
}
