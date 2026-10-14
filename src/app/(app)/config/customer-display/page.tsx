"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useAccess } from "@/components/auth/AccessProvider";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import {
  CUSTOMER_DISPLAY_PATH,
  SECTION_LABELS,
  getCustomerDisplaySettings,
  saveCustomerDisplaySettings,
  type CustomerDisplaySection,
  type CustomerDisplaySettings,
} from "@/lib/customerDisplay";

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
const labelClass = "text-sm font-medium text-slate-600";

export default function CustomerDisplaySettingsPage() {
  const { can } = useAccess();
  const canEdit = can("config.customer_display_edit");
  const [settings, setSettings] = useState<CustomerDisplaySettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newImage, setNewImage] = useState("");

  useEffect(() => {
    getCustomerDisplaySettings()
      .then(setSettings)
      .catch((e) => setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  if (!settings) return error ? <p className="text-sm text-red-600">{error}</p> : <PageLoading label="Loading Customer Display..." />;

  const patch = (p: Partial<CustomerDisplaySettings>) => setSettings((s) => (s ? { ...s, ...p } : s));
  const setSection = (key: CustomerDisplaySection, on: boolean) => patch({ sections: { ...settings.sections, [key]: on } });

  async function handleSave() {
    if (!settings) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setSettings(await saveCustomerDisplaySettings(settings));
      setMessage("บันทึกแล้ว — จอลูกค้าจะใช้ค่าใหม่เมื่อหน้า Create Shipment โหลดใหม่");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Customer Display (จอลูกค้า)"
          description="จอที่ 2 หันหาลูกค้าที่เคาน์เตอร์ — เปิดจากปุ่ม “เปิดจอลูกค้า” ในหน้า Create Shipment · แสดงเฉพาะราคาขาย ไม่มีต้นทุน / Markup เด็ดขาด"
        />
        <a
          href={CUSTOMER_DISPLAY_PATH}
          target="madd-customer-display"
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ExternalLink className="h-4 w-4" /> ดูหน้าจอลูกค้า
        </a>
      </div>

      <fieldset disabled={!canEdit} className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">ส่วนที่แสดงให้ลูกค้าเห็น</h2>
          <div className="flex flex-col gap-2.5">
            {(Object.keys(SECTION_LABELS) as CustomerDisplaySection[]).map((key) => (
              <label key={key} className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={settings.sections[key]}
                  onChange={(e) => setSection(key, e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-amber"
                />
                <span>
                  <span className="text-sm text-slate-700">{SECTION_LABELS[key].label}</span>
                  {SECTION_LABELS[key].hint && <span className="block text-xs text-slate-400">{SECTION_LABELS[key].hint}</span>}
                </span>
              </label>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>ตัวเลือกราคาที่แสดง</span>
              <select
                value={settings.quotes_mode}
                onChange={(e) => patch({ quotes_mode: e.target.value as CustomerDisplaySettings["quotes_mode"] })}
                className={fieldClass}
              >
                <option value="all">ทุกบริการ</option>
                <option value="cheapest_per_carrier">ถูกสุดของแต่ละ Carrier</option>
                <option value="selected">เฉพาะที่พนักงานเลือก</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>เรียงตาม</span>
              <select
                value={settings.quotes_sort}
                onChange={(e) => patch({ quotes_sort: e.target.value as CustomerDisplaySettings["quotes_sort"] })}
                className={fieldClass}
              >
                <option value="price">ราคาถูกสุดก่อน</option>
                <option value="transit">ส่งเร็วสุดก่อน</option>
              </select>
            </label>
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">หน้าตา</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 flex flex-col gap-1.5">
                <span className={labelClass}>ชื่อร้าน (ใช้เป็นข้อความแทนโลโก้)</span>
                <input
                  value={settings.brand.shop_name ?? ""}
                  onChange={(e) => patch({ brand: { ...settings.brand, shop_name: e.target.value } })}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>สีหลัก</span>
                <input
                  type="color"
                  value={settings.brand.primary_color}
                  onChange={(e) => patch({ brand: { ...settings.brand, primary_color: e.target.value } })}
                  className="h-10 w-full cursor-pointer rounded-lg border border-slate-300"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>สีเน้น</span>
                <input
                  type="color"
                  value={settings.brand.accent_color}
                  onChange={(e) => patch({ brand: { ...settings.brand, accent_color: e.target.value } })}
                  className="h-10 w-full cursor-pointer rounded-lg border border-slate-300"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>ขนาดตัวอักษร</span>
                <select
                  value={settings.brand.font_size}
                  onChange={(e) => patch({ brand: { ...settings.brand, font_size: e.target.value as "normal" | "large" } })}
                  className={fieldClass}
                >
                  <option value="normal">ปกติ</option>
                  <option value="large">ใหญ่ (จอไกล)</option>
                </select>
              </label>
              <label className="col-span-2 flex flex-col gap-1.5">
                <span className={labelClass}>ลิงก์โลโก้ (https://…)</span>
                <input
                  value={settings.idle.logo_url ?? ""}
                  onChange={(e) => patch({ idle: { ...settings.idle, logo_url: e.target.value } })}
                  placeholder="ว่าง = โลโก้ MADD"
                  className={fieldClass}
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">หน้าจอว่าง (ไม่มีลูกค้า)</h2>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>ข้อความหลัก</span>
                <input
                  value={settings.idle.title ?? ""}
                  onChange={(e) => patch({ idle: { ...settings.idle, title: e.target.value } })}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>ข้อความรอง</span>
                <input
                  value={settings.idle.subtitle ?? ""}
                  onChange={(e) => patch({ idle: { ...settings.idle, subtitle: e.target.value } })}
                  className={fieldClass}
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className={labelClass}>รูปโปรโมชั่น (ลิงก์ https://… เลื่อนเปลี่ยนอัตโนมัติ)</span>
                {settings.idle.images.map((url, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-10 w-16 rounded border border-slate-200 object-cover" />
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{url}</span>
                    <button
                      type="button"
                      onClick={() => patch({ idle: { ...settings.idle, images: settings.idle.images.filter((_, j) => j !== i) } })}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                      aria-label="ลบรูป"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input value={newImage} onChange={(e) => setNewImage(e.target.value)} placeholder="https://…/promo.jpg" className={fieldClass} />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newImage.trim()) return;
                      patch({ idle: { ...settings.idle, images: [...settings.idle.images, newImage.trim()] } });
                      setNewImage("");
                    }}
                    className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" /> เพิ่ม
                  </button>
                </div>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>เปลี่ยนรูปทุก (วินาที)</span>
                <input
                  type="number"
                  min={3}
                  max={120}
                  value={settings.idle.image_seconds}
                  onChange={(e) => patch({ idle: { ...settings.idle, image_seconds: Number(e.target.value) } })}
                  className={`${fieldClass} w-32`}
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">หลังจองเสร็จ</h2>
            <div className="grid grid-cols-3 gap-3">
              <label className="col-span-2 flex flex-col gap-1.5">
                <span className={labelClass}>ข้อความขอบคุณ</span>
                <input
                  value={settings.thank_you.message ?? ""}
                  onChange={(e) => patch({ thank_you: { ...settings.thank_you, message: e.target.value } })}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={labelClass}>กลับหน้าจอว่าง (วินาที)</span>
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={settings.thank_you.return_seconds}
                  onChange={(e) => patch({ thank_you: { ...settings.thank_you, return_seconds: Number(e.target.value) } })}
                  className={fieldClass}
                />
              </label>
            </div>
          </section>
        </div>
      </fieldset>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <p className="font-semibold text-slate-700">วิธีใช้ที่เคาน์เตอร์</p>
        <p>1. ต่อจอที่ 2 (ตั้ง Windows เป็น Extend) · 2. หน้า Create Shipment กด “เปิดจอลูกค้า” · 3. ลากหน้าต่างไปจอที่ 2 แล้วกด “เต็มจอ”</p>
        <p className="mt-1 text-slate-500">จอลูกค้าไม่ได้รับต้นทุน, Markup, สูตร, ข้อมูลดิบ หรือเลขบัญชี Carrier เลย ไม่ว่าจะตั้งค่าอย่างไร</p>
      </div>

      {(message || error) && <p className={`mt-3 text-sm ${error ? "text-red-600" : "text-emerald-600"}`}>{error || message}</p>}

      {canEdit && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-brand-amber px-5 py-2 text-sm font-semibold text-brand-navy-dark hover:bg-brand-amber/90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            บันทึก
          </button>
        </div>
      )}
    </div>
  );
}
