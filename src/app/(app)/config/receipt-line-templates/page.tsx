"use client";

import { useEffect, useState } from "react";
import { HelpCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import {
  createReceiptLineTemplate,
  deleteReceiptLineTemplate,
  listReceiptLineTemplates,
  updateReceiptLineTemplate,
  type ReceiptLineTemplate,
  type ReceiptLineTemplateItem,
} from "@/lib/receiptLineTemplates";
import { evaluateFormula, normalizeLineName } from "@/lib/formulaEval";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
const underlineClass =
  "w-full border-0 border-b border-dashed border-slate-300 bg-transparent px-0.5 py-0.5 text-sm outline-none focus:border-brand-navy";
const labelClass = "text-sm font-medium text-slate-600";

const emptyItem = (): ReceiptLineTemplateItem => ({ description: "", formula: null, is_non_vat: false });

// Live-preview each item's computed value using dummy 1,000 as the value for every plain
// (non-formula) line — lets staff sanity-check a formula ("{FREIGHT CHARGE} * 12%" -> 120.00)
// while building the template, before it's ever used on a real receipt.
function previewValues(items: ReceiptLineTemplateItem[]) {
  const values: Record<string, number> = {};
  return items.map((item) => {
    if (item.formula && item.formula.trim()) {
      const { value, error } = evaluateFormula(item.formula, values);
      if (item.description.trim()) values[normalizeLineName(item.description)] = value;

      return { value, error };
    }
    const value = 1000;
    if (item.description.trim()) values[normalizeLineName(item.description)] = value;

    return { value, error: null as string | null };
  });
}

export default function ReceiptLineTemplatesPage() {
  const [templates, setTemplates] = useState<ReceiptLineTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReceiptLineTemplate | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState(true);
  const [items, setItems] = useState<ReceiptLineTemplateItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setTemplates(await listReceiptLineTemplates());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingTemplate(null);
    setName("");
    setStatus(true);
    setItems([emptyItem()]);
    setFormError("");
    setShowModal(true);
  }

  function openEdit(template: ReceiptLineTemplate) {
    setEditingTemplate(template);
    setName(template.name);
    setStatus(template.status);
    setItems(template.items.length ? template.items.map((i) => ({ ...i })) : [emptyItem()]);
    setFormError("");
    setShowModal(true);
  }

  function updateItem(index: number, patch: Partial<ReceiptLineTemplateItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!name.trim()) {
      setFormError("กรุณากรอกชื่อ Template");
      return;
    }
    const cleanItems = items
      .map((it) => ({ ...it, description: it.description.trim(), formula: it.formula?.trim() || null }))
      .filter((it) => it.description);
    if (cleanItems.length === 0) {
      setFormError("กรุณาเพิ่มอย่างน้อย 1 บรรทัด");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = { name: name.trim(), status, items: cleanItems };
      if (editingTemplate) {
        const updated = await updateReceiptLineTemplate(editingTemplate.id, payload);
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        const created = await createReceiptLineTemplate(payload);
        setTemplates((prev) => [...prev, created]);
      }
      setShowModal(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(template: ReceiptLineTemplate) {
    if (!confirm(`Delete template "${template.name}"?`)) return;
    await deleteReceiptLineTemplate(template.id);
    setTemplates((prev) => prev.filter((t) => t.id !== template.id));
  }

  const preview = previewValues(items);

  return (
    <div>
      <PageHeader
        title="Receipt Line Templates"
        description='ชุดสูตรคำนวณ Line Items สำหรับใบเสร็จ/ใบกำกับภาษี — อ้างอิงบรรทัดก่อนหน้าด้วย {ชื่อบรรทัด} เช่น {FREIGHT CHARGE} * 12% เลือกใช้ได้ตอนออกเอกสารที่ /billing/receipts/new'
        actions={
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <HelpCircle className="h-4 w-4" /> คู่มือการใช้งาน
          </button>
        }
      />

      {loading ? (
        <PageLoading label="Loading..." />
      ) : (
        <>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={openAdd}
              className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
            >
              <Plus className="h-4 w-4" /> Add Template
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-5 py-2.5 font-medium">Lines</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-sm text-slate-400">
                      No templates yet.
                    </td>
                  </tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t.id} className="border-b border-slate-200 last:border-0">
                      <td className="px-5 py-3 font-medium text-slate-700">{t.name}</td>
                      <td className="px-5 py-3 text-slate-500">
                        {t.items.map((i) => i.description).join(", ")}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            t.status ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {t.status ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(t)}
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
            <Modal title={editingTemplate ? "Edit Template" : "Add Template"} onClose={() => setShowModal(false)}>
              <div className="flex w-[640px] max-w-full flex-col gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className={labelClass}>Template Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Freight + Service Charge 12%"
                    className={inputClass}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={status} onChange={(e) => setStatus(e.target.checked)} className="h-4 w-4 accent-brand-amber" />
                  Active (เลือกใช้ได้ตอนออกใบเสร็จ)
                </label>

                <div className="rounded-lg border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-2.5 py-2 font-medium">Description</th>
                        <th className="px-2.5 py-2 font-medium">
                          Formula (เว้นว่าง = กรอกยอดเองตอนออกเอกสาร)
                        </th>
                        <th className="w-16 px-2.5 py-2 text-center font-medium">Non-VAT</th>
                        <th className="w-24 px-2.5 py-2 text-right font-medium">Preview*</th>
                        <th className="w-8 px-2.5 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={index} className="border-t border-slate-100 align-top">
                          <td className="px-2.5 py-1.5">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(index, { description: e.target.value.toUpperCase() })}
                              placeholder="e.g. FREIGHT CHARGE"
                              className={underlineClass}
                            />
                          </td>
                          <td className="px-2.5 py-1.5">
                            <input
                              type="text"
                              value={item.formula ?? ""}
                              onChange={(e) => updateItem(index, { formula: e.target.value || null })}
                              placeholder='e.g. {FREIGHT CHARGE} * 12%'
                              className={`${underlineClass} font-mono`}
                            />
                            {preview[index]?.error && <p className="mt-0.5 text-xs text-red-500">{preview[index].error}</p>}
                          </td>
                          <td className="px-2.5 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={item.is_non_vat}
                              onChange={(e) => updateItem(index, { is_non_vat: e.target.checked })}
                              className="h-4 w-4 accent-brand-amber"
                            />
                          </td>
                          <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-500">
                            {preview[index]?.error ? "-" : preview[index]?.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-2.5 py-1.5 text-right">
                            <button type="button" onClick={() => removeItem(index)} className="rounded-lg p-1 text-red-500 hover:bg-red-50">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex w-fit items-center gap-1 text-xs font-semibold text-brand-navy-dark hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Line
                </button>
                <p className="text-xs text-slate-400">
                  * Preview คำนวณโดยสมมติทุกบรรทัดที่ไม่มีสูตรเป็น 1,000.00 — แค่ช่วยตรวจสูตรผิด/ถูก ไม่ใช่ยอดจริง
                  (ยอดจริงคำนวณตอนเลือก Template ในหน้าออกใบเสร็จ)
                </p>

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
                    disabled={saving}
                    className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {showGuide && (
            <Modal title="คู่มือการใช้งาน Receipt Line Templates" onClose={() => setShowGuide(false)} maxWidthClassName="max-w-2xl">
              <div className="flex flex-col gap-4 text-sm text-slate-700">
                <section>
                  <h3 className="mb-1 font-semibold text-slate-800">Template คืออะไร</h3>
                  <p>
                    ชุดบรรทัด (Line) ที่ตั้งไว้ล่วงหน้า สำหรับกดเลือกใช้ตอนออกใบเสร็จ/ใบกำกับภาษีที่{" "}
                    <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/billing/receipts/new</code> — เลือก
                    Template แล้วบรรทัดปัจจุบันทั้งหมดจะถูกแทนที่ด้วยบรรทัดใน Template ทันที
                  </p>
                </section>

                <section>
                  <h3 className="mb-1 font-semibold text-slate-800">2 ประเภทของบรรทัด</h3>
                  <ul className="list-inside list-disc space-y-1">
                    <li>
                      <b>บรรทัดกรอกเอง</b> — ช่อง Formula เว้นว่างไว้ พนักงานพิมพ์ยอดเงินเองตอนออกเอกสารจริง เช่น{" "}
                      <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">FREIGHT CHARGE</code> = 1,042.00
                    </li>
                    <li>
                      <b>บรรทัดสูตรคำนวณ</b> — อ้างอิงบรรทัด<b>ก่อนหน้า</b>ด้วยชื่อในวงเล็บปีกกา{" "}
                      <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{"{ชื่อบรรทัด}"}</code> คำนวณอัตโนมัติ
                      ไม่ต้องกดเครื่องคิดเลข และจะอัปเดตใหม่ทันทีถ้าบรรทัดที่อ้างอิงถูกแก้ไข
                    </li>
                  </ul>
                </section>

                <section>
                  <h3 className="mb-1 font-semibold text-slate-800">เครื่องหมายที่ใช้ได้ในสูตร</h3>
                  <table className="w-full text-left text-xs">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-1 pr-3 font-mono">+  -  *  /</td>
                        <td className="py-1 text-slate-500">บวก ลบ คูณ หาร</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-3 font-mono">( )</td>
                        <td className="py-1 text-slate-500">วงเล็บ กำหนดลำดับการคำนวณ</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-3 font-mono">10%</td>
                        <td className="py-1 text-slate-500">เปอร์เซ็นต์ (หารด้วย 100 อัตโนมัติ)</td>
                      </tr>
                      <tr>
                        <td className="py-1 pr-3 font-mono">{"{ชื่อบรรทัด}"}</td>
                        <td className="py-1 text-slate-500">ค่าของบรรทัดก่อนหน้าที่ชื่อนี้ (ไม่สนตัวพิมพ์เล็ก/ใหญ่)</td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <section>
                  <h3 className="mb-1 font-semibold text-slate-800">ตัวอย่าง</h3>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-6">
                    FREIGHT CHARGE = <span className="text-slate-400">(กรอกเอง)</span> 1,042.00
                    <br />
                    SERVICE CHARGE = {"{FREIGHT CHARGE}"} * 12%
                    <span className="text-slate-400"> → 125.04</span>
                    <br />
                    <br />
                    FREIGHT CHARGE = <span className="text-slate-400">(กรอกเอง)</span> 800.00
                    <br />
                    INSURANCE CHARGE = <span className="text-slate-400">(กรอกเอง)</span> 200.00
                    <br />
                    SERVICE CHARGE = ({"{FREIGHT CHARGE}"} + {"{INSURANCE CHARGE}"}) * 10%
                    <span className="text-slate-400"> → 100.00</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    ดูตัวอย่างจริงได้จาก 2 Template ที่ระบบสร้างไว้ให้แล้ว ("ตัวอย่าง: Freight + Service Charge 12%"
                    และ "ตัวอย่าง: Freight + Insurance + Service Charge 10%") — กด Edit เพื่อดูวิธีตั้งสูตรได้เลย
                  </p>
                </section>

                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="mt-2 self-end rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
                >
                  เข้าใจแล้ว
                </button>
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
