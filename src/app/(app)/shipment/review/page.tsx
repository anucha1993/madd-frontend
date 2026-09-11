import { Ban, CheckCircle2, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";

/** UI-only mockup (layout based on the legacy admin's Shipment Review sections) —
 * static sample data, not wired to any backend yet. Just previewing the layout. */

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm font-medium text-slate-700">{value}</div>
    </div>
  );
}

export default function ShipmentReviewPage() {
  return (
    <div>
      <PageHeader title="Review Shipment" description="Confirm shipment details before submitting (UI mockup — sample data)" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Reference No.">
          <input
            type="text"
            defaultValue="REF-20260910-001"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15"
          />
        </SectionCard>

        <SectionCard title="Agent / Carrier">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Carrier" value="UPS" />
            <Field label="Service" value="Worldwide Saver" />
            <Field label="Account" value="ax3173" />
            <Field label="Estimated Transit" value="3-5 business days" />
          </div>
        </SectionCard>

        <SectionCard title="Ship From (Thailand)">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" value="MADD Express Co., Ltd." />
            <Field label="Phone" value="02-000-1111" />
            <Field label="Address" value="123 Sukhumvit Rd, Khlong Toei" />
            <Field label="Postcode" value="10110" />
          </div>
        </SectionCard>

        <SectionCard title="Ship To (International)">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name" value="John Tan" />
            <Field label="Phone" value="+65 8123 4567" />
            <Field label="Address" value="1 Raffles Place" />
            <Field label="Country / Postcode" value="Singapore / 238874" />
          </div>
        </SectionCard>

        <SectionCard title="Parcel & Service">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type" value="Box" />
            <Field label="Weight / Dimensions" value="2 kg / 20x15x10 cm" />
            <Field label="Quantity" value="1" />
            <Field label="Billable Weight" value="2 kg" />
          </div>
        </SectionCard>

        <SectionCard title="Insurance">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            UPS Shipment Care — 1.1% of declared value
          </div>
        </SectionCard>

        <SectionCard title="Additional Supplies">
          <div className="flex flex-col gap-1 text-sm text-slate-600">
            <div className="flex justify-between">
              <span>Box No. 2A x 1</span>
              <span>40.00 THB</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Description of Goods">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-slate-400">
              <tr>
                <th className="py-1.5 font-medium">Item</th>
                <th className="py-1.5 font-medium">HS Code</th>
                <th className="py-1.5 font-medium">Qty</th>
                <th className="py-1.5 font-medium text-right">Value (THB)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="py-1.5">Sample T-Shirts</td>
                <td className="py-1.5 text-slate-500">6109.10</td>
                <td className="py-1.5">2</td>
                <td className="py-1.5 text-right">1,200.00</td>
              </tr>
            </tbody>
          </table>
        </SectionCard>

        <SectionCard title="Payment Method">
          <Field label="Method" value="Company Account" />
        </SectionCard>

        <SectionCard title="Billing Detail">
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Shipping Rate</span>
              <span>737.86 THB</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Insurance</span>
              <span>13.20 THB</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Packaging Supplies</span>
              <span>40.00 THB</span>
            </div>
            <div className="mt-1.5 flex justify-between border-t border-slate-100 pt-1.5 font-semibold text-slate-800">
              <span>Total</span>
              <span>791.06 THB</span>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Ban className="h-4 w-4" />
          Cancel
        </button>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy-dark/90"
        >
          <CheckCircle2 className="h-4 w-4" />
          Confirm Shipment
        </button>
      </div>
    </div>
  );
}
