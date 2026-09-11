"use client";

import { useState, type FormEvent } from "react";
import type { ThaiSubdistrict, ThaiSubdistrictInput } from "@/lib/thaiSubdistricts";

type Props = {
  initial?: ThaiSubdistrict | null;
  onSubmit: (data: ThaiSubdistrictInput) => Promise<void>;
  onCancel: () => void;
};

export default function ThaiSubdistrictForm({ initial, onSubmit, onCancel }: Props) {
  const [tambonId, setTambonId] = useState(initial ? String(initial.tambon_id) : "");
  const [zipCode, setZipCode] = useState(initial?.zip_code ?? "");
  const [zipCodeAll, setZipCodeAll] = useState(initial?.zip_code_all ?? "");
  const [nameTh, setNameTh] = useState(initial?.name_th ?? "");
  const [nameEn, setNameEn] = useState(initial?.name_en ?? "");
  const [districtId, setDistrictId] = useState(initial ? String(initial.district_id) : "");
  const [districtNameTh, setDistrictNameTh] = useState(initial?.district_name_th ?? "");
  const [districtNameEn, setDistrictNameEn] = useState(initial?.district_name_en ?? "");
  const [provinceId, setProvinceId] = useState(initial ? String(initial.province_id) : "");
  const [provinceNameTh, setProvinceNameTh] = useState(initial?.province_name_th ?? "");
  const [provinceNameEn, setProvinceNameEn] = useState(initial?.province_name_en ?? "");
  const [region, setRegion] = useState(initial?.region ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!zipCode.trim() || !nameTh.trim() || !districtNameTh.trim() || !provinceNameTh.trim()) {
      setError("Please fill in zip code, subdistrict, district, and province");
      return;
    }
    if (!initial && (!tambonId.trim() || !districtId.trim() || !provinceId.trim())) {
      setError("Please fill in TambonID / DistrictID / ProvinceID for a new entry");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        tambon_id: initial ? undefined : Number(tambonId),
        zip_code: zipCode.trim(),
        zip_code_all: zipCodeAll.trim() || undefined,
        name_th: nameTh.trim(),
        name_en: nameEn.trim() || undefined,
        district_id: initial ? undefined : Number(districtId),
        district_name_th: districtNameTh.trim(),
        district_name_en: districtNameEn.trim() || undefined,
        province_id: initial ? undefined : Number(provinceId),
        province_name_th: provinceNameTh.trim(),
        province_name_en: provinceNameEn.trim() || undefined,
        region: region.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
  const labelClass = "text-sm font-medium text-slate-600";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Zip Code</span>
            <input type="text" value={zipCode} onChange={(e) => setZipCode(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Other zip codes sharing this subdistrict</span>
            <input
              type="text"
              value={zipCodeAll}
              onChange={(e) => setZipCodeAll(e.target.value)}
              placeholder="e.g. 10200/10201"
              className={inputClass}
            />
          </label>
        </div>
      </div>

      {!initial && (
        <div className="grid grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>TambonID</span>
            <input type="text" value={tambonId} onChange={(e) => setTambonId(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>DistrictID</span>
            <input
              type="text"
              value={districtId}
              onChange={(e) => setDistrictId(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>ProvinceID</span>
            <input
              type="text"
              value={provinceId}
              onChange={(e) => setProvinceId(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Subdistrict (Thai)</span>
          <input type="text" value={nameTh} onChange={(e) => setNameTh(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Subdistrict (English)</span>
          <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>District (Thai)</span>
          <input
            type="text"
            value={districtNameTh}
            onChange={(e) => setDistrictNameTh(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>District (English)</span>
          <input
            type="text"
            value={districtNameEn}
            onChange={(e) => setDistrictNameEn(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Province (Thai)</span>
          <input
            type="text"
            value={provinceNameTh}
            onChange={(e) => setProvinceNameTh(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Province (English)</span>
          <input
            type="text"
            value={provinceNameEn}
            onChange={(e) => setProvinceNameEn(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Region</span>
        <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass} />
      </label>

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
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy-dark/90 disabled:opacity-60"
        >
          {submitting ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
