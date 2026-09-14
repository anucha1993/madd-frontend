"use client";

import { useState, type FormEvent } from "react";
import { MapPin, StickyNote, Tag, User } from "lucide-react";
import type { CustomerAddress, CustomerAddressInput, CustomerAddressType } from "@/lib/customers";

type Props = {
  initial?: CustomerAddress | null;
  defaultType?: CustomerAddressType;
  onSubmit: (data: CustomerAddressInput) => Promise<void>;
  onCancel: () => void;
};

const TYPE_OPTIONS: { value: CustomerAddressType; label: string }[] = [
  { value: "ship_from", label: "Ship From เท่านั้น" },
  { value: "ship_to", label: "Ship To เท่านั้น" },
  { value: "both", label: "ใช้ได้ทั้ง Ship From/To" },
];

export default function CustomerAddressForm({ initial, defaultType, onSubmit, onCancel }: Props) {
  const [type, setType] = useState<CustomerAddressType>(initial?.type ?? defaultType ?? "ship_from");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [contactName, setContactName] = useState(initial?.contact_name ?? "");
  const [companyName, setCompanyName] = useState(initial?.company_name ?? "");
  const [taxId, setTaxId] = useState(initial?.tax_id ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [postcode, setPostcode] = useState(initial?.postcode ?? "");
  const [address1, setAddress1] = useState(initial?.address1 ?? "");
  const [address2, setAddress2] = useState(initial?.address2 ?? "");
  const [address3, setAddress3] = useState(initial?.address3 ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!contactName.trim()) {
      setError("กรุณากรอกชื่อผู้ติดต่อ");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        type,
        label: label.trim() || undefined,
        contact_name: contactName.trim(),
        company_name: companyName.trim() || undefined,
        tax_id: taxId.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        postcode: postcode.trim() || undefined,
        address1: address1.trim() || undefined,
        address2: address2.trim() || undefined,
        address3: address3.trim() || undefined,
        notes: notes.trim() || undefined,
        is_default: isDefault,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
  const labelClass = "text-xs font-medium text-slate-600";
  const sectionClass = "flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4";
  const sectionTitleClass = "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>ใช้สำหรับ</span>
            <select value={type} onChange={(e) => setType(e.target.value as CustomerAddressType)} className={inputClass}>
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>ป้ายชื่อ (เช่น &quot;Warehouse A&quot;)</span>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
          </label>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>
          <User className="h-3.5 w-3.5" /> ข้อมูลผู้ติดต่อ
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>ชื่อผู้ติดต่อ</span>
            <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>ชื่อบริษัท</span>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Tax ID</span>
            <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>เบอร์โทร</span>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>อีเมล</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </label>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>
          <MapPin className="h-3.5 w-3.5" /> ที่อยู่จัดส่ง
        </h3>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>ที่อยู่ 1</span>
          <input type="text" value={address1} onChange={(e) => setAddress1(e.target.value)} className={inputClass} />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-2 flex flex-col gap-1">
            <span className={labelClass}>ที่อยู่ 2</span>
            <input type="text" value={address2} onChange={(e) => setAddress2(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>ที่อยู่ 3</span>
            <input type="text" value={address3} onChange={(e) => setAddress3(e.target.value)} className={inputClass} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>เมือง</span>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>รหัสไปรษณีย์</span>
            <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>ประเทศ (ISO2, ว่าง = TH)</span>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase())}
              maxLength={2}
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div className={sectionClass}>
        <h3 className={sectionTitleClass}>
          <StickyNote className="h-3.5 w-3.5" /> อื่นๆ
        </h3>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>บันทึกเพิ่มเติม</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-300 text-brand-navy"
          />
          <Tag className="h-3.5 w-3.5 text-slate-400" /> ตั้งเป็นที่อยู่เริ่มต้น
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
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
