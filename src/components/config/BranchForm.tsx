"use client";

import { useState, type FormEvent } from "react";
import type { Branch, BranchInput } from "@/lib/branches";
import type { AgentAccount } from "@/lib/agentAccounts";
import type { BranchCarrierAccount, BranchCarrierAccountInput } from "@/lib/branchCarrierAccounts";
import BranchCarrierAccountsFields from "@/components/config/BranchCarrierAccountsForm";

type Props = {
  initial?: Branch | null;
  agentAccounts: AgentAccount[];
  initialCarrierAccounts: BranchCarrierAccount[];
  onSubmit: (data: BranchInput, carrierAccounts: BranchCarrierAccountInput[]) => Promise<void>;
  onCancel: () => void;
};

export default function BranchForm({ initial, agentAccounts, initialCarrierAccounts, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [companyName, setCompanyName] = useState(initial?.company_name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [taxId, setTaxId] = useState(initial?.tax_id ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [status, setStatus] = useState(initial?.status ?? true);
  const [carrierAccounts, setCarrierAccounts] = useState<BranchCarrierAccountInput[]>(
    initialCarrierAccounts.map((row) => ({ agent_account_id: row.agent_account_id }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim() || !code.trim()) {
      setError("กรุณากรอกชื่อสาขาและรหัสสาขา");
      return;
    }
    if (!companyName.trim()) {
      setError("กรุณากรอกชื่อบริษัท");
      return;
    }
    if (!taxId.trim()) {
      setError("กรุณากรอกเลขประจำตัวผู้เสียภาษี (Tax ID)");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(
        {
          name: name.trim(),
          company_name: companyName.trim(),
          code: code.trim(),
          tax_id: taxId.trim(),
          address: address.trim() || undefined,
          phone: phone.trim() || undefined,
          status,
        },
        carrierAccounts
      );
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
      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>ชื่อบริษัท</span>
        <input
          type="text"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>ชื่อสาขา</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>รหัสสาขา</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="เช่น SILOM"
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>เลขประจำตัวผู้เสียภาษี (Tax ID)</span>
        <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inputClass} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>ที่อยู่</span>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          className={`${inputClass} resize-y`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>เบอร์โทร</span>
        <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={status}
          onChange={(e) => setStatus(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
        />
        เปิดใช้งานสาขานี้
      </label>

      <div className="border-t border-slate-100 pt-4">
        <span className="text-sm font-medium text-slate-600">บัญชี Agent (UPS/DHL)</span>
        <div className="mt-2">
          <BranchCarrierAccountsFields agentAccounts={agentAccounts} value={carrierAccounts} onChange={setCarrierAccounts} />
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy-dark/90 disabled:opacity-60"
        >
          {submitting ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </form>
  );
}
