"use client";

import { useState, type FormEvent } from "react";
import type { Supply, SupplyInput } from "@/lib/supplies";

type Props = {
  initial?: Supply | null;
  onSubmit: (data: SupplyInput) => Promise<void>;
  onCancel: () => void;
};

export default function SupplyForm({ initial, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "");
  const [weight, setWeight] = useState(initial?.weight != null ? String(initial.weight) : "");
  const [length, setLength] = useState(initial?.length != null ? String(initial.length) : "");
  const [width, setWidth] = useState(initial?.width != null ? String(initial.width) : "");
  const [height, setHeight] = useState(initial?.height != null ? String(initial.height) : "");
  const [iconUrl, setIconUrl] = useState(initial?.icon_url ?? "");
  const [costPrice, setCostPrice] = useState(initial ? String(initial.cost_price) : "0");
  const [salePrice, setSalePrice] = useState(initial ? String(initial.sale_price) : "0");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState(initial?.status ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please fill in the name.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        type: type.trim() || undefined,
        weight: weight.trim() ? Number(weight) : undefined,
        length: length.trim() ? Number(length) : undefined,
        width: width.trim() ? Number(width) : undefined,
        height: height.trim() ? Number(height) : undefined,
        icon_url: iconUrl.trim() || undefined,
        cost_price: Number(costPrice) || 0,
        sale_price: Number(salePrice) || 0,
        description: description.trim() || undefined,
        status,
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
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Box No. 2A"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            <option value="">-</option>
            <option value="กล่อง">กล่อง (Box)</option>
            <option value="ซอง">ซอง (Envelope)</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Icon (PNG URL)</span>
        <input
          type="text"
          value={iconUrl}
          onChange={(e) => setIconUrl(e.target.value)}
          placeholder="https://.../box-icon.png"
          className={inputClass}
        />
        {iconUrl.trim() && (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={iconUrl.trim()} alt="Icon preview" className="h-12 w-12 object-contain" />
          </div>
        )}
      </label>

      <div className="grid grid-cols-4 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Weight (kg)</span>
          <input type="number" min={0} step={0.01} value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Length (cm)</span>
          <input type="number" min={0} step={0.1} value={length} onChange={(e) => setLength(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Width (cm)</span>
          <input type="number" min={0} step={0.1} value={width} onChange={(e) => setWidth(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Height (cm)</span>
          <input type="number" min={0} step={0.1} value={height} onChange={(e) => setHeight(e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Cost Price</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Sale Price</span>
          <input
            type="number"
            min={0}
            step={0.01}
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={labelClass}>Description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={`${inputClass} resize-y`}
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={status}
          onChange={(e) => setStatus(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
        />
        Active
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
