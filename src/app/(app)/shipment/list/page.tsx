import { Eye, Search } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";

/** UI-only mockup (based on the legacy admin's My Shipments page) — sample data,
 * not wired to any backend yet. Just previewing the intended layout. */
const MOCK_SHIPMENTS = [
  { id: 1001, ref: "REF-20260910-001", carrier: "UPS", service: "Worldwide Saver", destination: "Singapore", status: "Pending Pickup", amount: "737.86", date: "2026-09-10" },
  { id: 1002, ref: "REF-20260909-014", carrier: "DHL", service: "Express Worldwide", destination: "Hong Kong", status: "In Transit", amount: "1,415.99", date: "2026-09-09" },
  { id: 1003, ref: "REF-20260908-007", carrier: "UPS", service: "Worldwide Expedited", destination: "Australia", status: "Delivered", amount: "1,565.24", date: "2026-09-08" },
  { id: 1004, ref: "REF-20260907-022", carrier: "DHL", service: "Express 12:00", destination: "Japan", status: "Cancelled", amount: "1,702.99", date: "2026-09-07" },
];

const STATUS_STYLE: Record<string, string> = {
  "Pending Pickup": "bg-amber-50 text-amber-600",
  "In Transit": "bg-blue-50 text-blue-600",
  Delivered: "bg-emerald-50 text-emerald-600",
  Cancelled: "bg-red-50 text-red-600",
};

export default function ShipmentListPage() {
  return (
    <div>
      <PageHeader title="My Shipments" description="All shipments you have created (UI mockup — sample data)" />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Search</span>
          <input
            type="text"
            placeholder="Reference no. / tracking no."
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Status</span>
          <select className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15">
            <option>All</option>
            <option>Pending Pickup</option>
            <option>In Transit</option>
            <option>Delivered</option>
            <option>Cancelled</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Carrier</span>
          <select className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15">
            <option>All</option>
            <option>UPS</option>
            <option>DHL</option>
          </select>
        </label>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
            <tr>
              <th className="px-5 py-2.5 font-medium">Reference</th>
              <th className="px-5 py-2.5 font-medium">Carrier / Service</th>
              <th className="px-5 py-2.5 font-medium">Destination</th>
              <th className="px-5 py-2.5 font-medium">Date</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium text-right">Amount (THB)</th>
              <th className="px-5 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_SHIPMENTS.map((s) => (
              <tr key={s.id} className="border-b border-slate-200 last:border-0">
                <td className="px-5 py-3 font-medium text-slate-700">{s.ref}</td>
                <td className="px-5 py-3 text-slate-500">
                  {s.carrier} — {s.service}
                </td>
                <td className="px-5 py-3 text-slate-500">{s.destination}</td>
                <td className="px-5 py-3 text-slate-500">{s.date}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                </td>
                <td className="px-5 py-3 text-right font-semibold text-slate-800">{s.amount}</td>
                <td className="px-5 py-3 text-right">
                  <button type="button" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="View">
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
