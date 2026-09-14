"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import {
  createManifestOption,
  deleteManifestOption,
  listManifestOptions,
  updateManifestOption,
  type ManifestOption,
  type ManifestOptionGroup,
  type ManifestOptionInput,
} from "@/lib/manifestOptions";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
const labelClass = "text-sm font-medium text-slate-600";

const GROUPS: { value: ManifestOptionGroup; label: string; description: string; usedIn: string }[] = [
  {
    value: "customer_type",
    label: "Customer Type",
    description: "ประเภทลูกค้า เช่น DAILY, Shop CR, WI (Shop CR มีโค้ดต่างกันตาม carrier: UPS=CR, DHL=SCR)",
    usedIn: "Create Shipment",
  },
  {
    value: "payment_option",
    label: "Payment Option",
    description: "วิธีการชำระเงิน เช่น Daily, CR, QR, Transfer",
    usedIn: "Create Shipment",
  },
  { value: "zone", label: "Zone", description: "โซนปลายทางสำหรับ UPS/DHL (1-10)", usedIn: "ยังไม่ได้ใช้งาน" },
  {
    value: "destination",
    label: "Destination",
    description: "รหัสปลายทางเพิ่มเติมสำหรับ Manifest Report (เช่น รหัสประเทศ) — ยังไม่มีรายการตายตัว",
    usedIn: "ยังไม่ได้ใช้งาน",
  },
  {
    value: "charge_code",
    label: "Charge Code",
    description: "ตัวย่อค่าธรรมเนียม/เซอร์ชาร์จของ UPS/DHL ที่ใช้กรอกในฟอร์ม Manifest เช่น EAS, DAS, Remote",
    usedIn: "ยังไม่ได้ใช้งาน",
  },
  {
    value: "insurance_code",
    label: "Insurance Code",
    description: "รหัสมูลค่าประกัน/Declared Value เช่น ICDV, UPSC, Shipment Insurance",
    usedIn: "ยังไม่ได้ใช้งาน",
  },
  {
    value: "form_charge",
    label: "Form Charge",
    description: "ค่าธรรมเนียม Form/OT แบบราคาคงที่ต่อรายการ (บาท) ของแต่ละ carrier",
    usedIn: "ยังไม่ได้ใช้งาน",
  },
  {
    value: "bill_transportation_to",
    label: "Bill Transportation to",
    description: "ผู้รับผิดชอบค่าขนส่ง เช่น Shipper, Receiver, Third Party",
    usedIn: "Create Shipment",
  },
  {
    value: "bill_duty_tax_to",
    label: "Bill Duty and Tax to",
    description: "ผู้รับผิดชอบค่าภาษี/อากร เช่น Shipper, Receiver, Third Party",
    usedIn: "Create Shipment",
  },
];

type OptionForm = {
  provider: "" | "UPS" | "DHL";
  name: string;
  code: string;
  amount: string;
  status: boolean;
};

const emptyForm: OptionForm = { provider: "", name: "", code: "", amount: "", status: true };

export default function ManifestOptionsPage() {
  const [activeGroup, setActiveGroup] = useState<ManifestOptionGroup>("customer_type");
  const [options, setOptions] = useState<ManifestOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingOption, setEditingOption] = useState<ManifestOption | null>(null);
  const [form, setForm] = useState<OptionForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadOptions(activeGroup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup]);

  async function loadOptions(group: ManifestOptionGroup) {
    setLoading(true);
    setError("");
    try {
      setOptions(await listManifestOptions(group));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load manifest options");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingOption(null);
    setForm(emptyForm);
    setFormError("");
    setShowModal(true);
  }

  function openEdit(option: ManifestOption) {
    setEditingOption(option);
    setForm({
      provider: option.provider ?? "",
      name: option.name,
      code: option.code,
      amount: option.amount != null ? String(option.amount) : "",
      status: option.status,
    });
    setFormError("");
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.code.trim()) return;
    setSaving(true);
    setFormError("");
    try {
      const provider = form.provider || null;
      const amount = form.amount.trim() ? Number(form.amount) : null;
      if (editingOption) {
        const updated = await updateManifestOption(editingOption.id, {
          provider,
          name: form.name.trim(),
          code: form.code.trim(),
          amount,
          status: form.status,
        });
        setOptions((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      } else {
        const payload: ManifestOptionInput = {
          group: activeGroup,
          provider,
          name: form.name.trim(),
          code: form.code.trim(),
          amount,
          status: form.status,
        };
        const created = await createManifestOption(payload);
        setOptions((prev) => [...prev, created]);
      }
      setShowModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save manifest option");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(option: ManifestOption) {
    if (!confirm(`Delete option "${option.name}"?`)) return;
    await deleteManifestOption(option.id);
    setOptions((prev) => prev.filter((o) => o.id !== option.id));
  }

  const activeGroupInfo = GROUPS.find((g) => g.value === activeGroup)!;

  return (
    <div>
      <PageHeader
        title="Manifest Form Options"
        description="กำหนดตัวเลือก dropdown ที่ใช้ในฟอร์ม Manifest พร้อม Code สำหรับเรียกใช้ใน Report"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => setActiveGroup(g.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              activeGroup === g.value
                ? "bg-brand-navy-dark text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <p className="mb-1 text-sm text-slate-500">{activeGroupInfo.description}</p>
      <p className="mb-4 text-xs text-slate-400">
        ใช้งานอยู่ที่:{" "}
        <span className={activeGroupInfo.usedIn === "ยังไม่ได้ใช้งาน" ? "text-slate-400" : "font-medium text-emerald-600"}>
          {activeGroupInfo.usedIn}
        </span>
      </p>

      {loading ? (
        <PageLoading label="กำลังโหลดข้อมูล..." />
      ) : (
        <>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
            >
              <Plus className="h-4 w-4" /> Add Option
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Provider</th>
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-5 py-2.5 font-medium">Code</th>
                  <th className="px-5 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {options.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-6 text-center text-sm text-slate-400">
                      No options yet.
                    </td>
                  </tr>
                ) : (
                  options.map((option) => (
                    <tr key={option.id} className="border-b border-slate-200 last:border-0">
                      <td className="px-5 py-3 text-slate-500">{option.provider ?? "ทั้งคู่"}</td>
                      <td className="px-5 py-3 text-slate-500">{option.name}</td>
                      <td className="px-5 py-3 font-medium text-slate-700">{option.code}</td>
                      <td className="px-5 py-3 text-right text-slate-500">{option.amount ?? "-"}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            option.status ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {option.status ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(option)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(option)}
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
            <Modal
              title={editingOption ? `Edit ${activeGroupInfo.label} Option` : `Add ${activeGroupInfo.label} Option`}
              onClose={() => setShowModal(false)}
            >
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Provider (เว้นว่าง = ใช้ได้ทั้ง UPS/DHL)</span>
                  <select
                    value={form.provider}
                    onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value as OptionForm["provider"] }))}
                    className={inputClass}
                  >
                    <option value="">ทั้งคู่ (UPS/DHL)</option>
                    <option value="UPS">UPS</option>
                    <option value="DHL">DHL</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>Name</span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Shop CR"
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>Code</span>
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                      placeholder="e.g. CR"
                      className={inputClass}
                    />
                  </label>
                </div>
                <p className="text-xs text-slate-400">Code นี้จะถูกใช้ตอนเรียกสร้าง Manifest Report</p>

                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Amount (บาท, ใส่เฉพาะรายการที่เป็นค่าธรรมเนียมคงที่ เช่น Form/OT)</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="e.g. 535"
                    className={inputClass}
                  />
                </label>

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
                    disabled={saving || !form.name.trim() || !form.code.trim()}
                    className="flex items-center gap-2 rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : editingOption ? "Save Changes" : "Add"}
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
