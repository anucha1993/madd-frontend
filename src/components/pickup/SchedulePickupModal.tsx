"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { createPickup, type CreatePickupInput, type Pickup } from "@/lib/pickups";
import type { Shipment } from "@/lib/shipments";

type PickupFormState = {
  pickup_date: string;
  ready_time: string;
  close_time: string;
  contact_name: string;
  company_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  postcode: string;
  reference_number: string;
};

type Props = {
  // The shipments being combined into one Pickup — all must share the same agent_account_id
  // (enforced by callers before opening this modal, see /shipment/list's isSelectable()).
  shipments: Shipment[];
  onClose: () => void;
  onCreated: (pickup: Pickup) => void;
  // Used by "Reschedule" (cancel old Pickup + reopen this prefilled with its same values) so
  // staff don't have to retype everything just to fix one wrong date/time/address field.
  defaultValues?: Partial<PickupFormState>;
};

// Shared by /shipment/list (new Pickup from a fresh selection) and /pickup/list (Reschedule —
// cancel then reopen this same form prefilled with the old Pickup's values).
export default function SchedulePickupModal({ shipments, onClose, onCreated, defaultValues }: Props) {
  const firstShipment = shipments[0];
  const origin = firstShipment?.origin;
  const [form, setForm] = useState<PickupFormState>({
    pickup_date: defaultValues?.pickup_date ?? "",
    ready_time: defaultValues?.ready_time ?? "09:00",
    close_time: defaultValues?.close_time ?? "17:00",
    contact_name: defaultValues?.contact_name ?? origin?.contact_name ?? "",
    company_name: defaultValues?.company_name ?? origin?.company ?? "",
    phone: defaultValues?.phone ?? origin?.phone ?? "",
    email: defaultValues?.email ?? "",
    address: defaultValues?.address ?? origin?.address ?? "",
    city: defaultValues?.city ?? origin?.city ?? "",
    postcode: defaultValues?.postcode ?? origin?.postcode ?? "",
    reference_number: defaultValues?.reference_number ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof PickupFormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstShipment) return;
    setSubmitting(true);
    setError("");
    try {
      const payload: CreatePickupInput = {
        agent_account_id: firstShipment.agent_account_id,
        shipment_ids: shipments.map((s) => s.id),
        pickup_date: form.pickup_date,
        ready_time: form.ready_time,
        close_time: form.close_time,
        contact_name: form.contact_name || undefined,
        company_name: form.company_name || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address,
        city: form.city,
        postcode: form.postcode,
        reference_number: form.reference_number || undefined,
      };
      const pickup = await createPickup(payload);
      onCreated(pickup);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule pickup");
    } finally {
      setSubmitting(false);
    }
  }

  if (!firstShipment) return null;

  return (
    <Modal title={`Schedule Pickup — ${firstShipment.carrier} (${shipments.length} Shipment)`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">Pickup Date</span>
            <input
              type="date"
              required
              value={form.pickup_date}
              onChange={(e) => set("pickup_date", e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Ready Time</span>
              <input
                type="time"
                required
                value={form.ready_time}
                onChange={(e) => set("ready_time", e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Close Time</span>
              <input
                type="time"
                required
                value={form.close_time}
                onChange={(e) => set("close_time", e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
              />
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">Contact Name</span>
            <input
              type="text"
              value={form.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">Company</span>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => set("company_name", e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">Phone</span>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Pickup Address</span>
          <input
            type="text"
            required
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">City</span>
            <input
              type="text"
              required
              value={form.city}
              onChange={(e) => set("city", e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">Postcode</span>
            <input
              type="text"
              required
              value={form.postcode}
              onChange={(e) => set("postcode", e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Reference No. (optional)</span>
          <input
            type="text"
            value={form.reference_number}
            onChange={(e) => set("reference_number", e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          />
        </label>

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Schedule Pickup
          </button>
        </div>
      </form>
    </Modal>
  );
}
