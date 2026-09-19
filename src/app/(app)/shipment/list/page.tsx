"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Printer,
  Search,
  Loader2,
  Barcode,
  Receipt,
  FileCheck,
  XCircle,
  Truck,
  PackagePlus,
  PackageCheck,
  Ban,
  Wallet,
  Plus,
  MoreVertical,
  Trash2,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import CarrierBadge from "@/components/ui/CarrierBadge";
import SchedulePickupModal from "@/components/pickup/SchedulePickupModal";
import { getUser } from "@/lib/auth";
import {
  listShipments,
  getShipmentStats,
  openShipmentLabel,
  printAllShipmentLabels,
  describeShipmentPieces,
  openShipmentWaybill,
  openShipmentCommercialInvoice,
  voidShipment,
  deleteShipment,
  type Shipment,
  type ShipmentStats,
} from "@/lib/shipments";

const STATUS_STYLE: Record<string, string> = {
  booked: "bg-emerald-50 text-emerald-600",
  pending: "bg-amber-50 text-amber-600",
  failed: "bg-red-50 text-red-600",
  voided: "bg-slate-100 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  booked: "Booked",
  pending: "Pending",
  failed: "Failed",
  voided: "Voided",
};

// The carrier's real delivery progress — separate concept from STATUS_STYLE/LABEL above (which
// is only our own booking lifecycle). Synced periodically by shipments:sync-tracking.
const TRACKING_STATUS_STYLE: Record<string, string> = {
  not_picked_up: "bg-slate-100 text-slate-500",
  in_transit: "bg-blue-50 text-blue-600",
  delivered: "bg-emerald-50 text-emerald-600",
};

const TRACKING_STATUS_LABEL: Record<string, string> = {
  not_picked_up: "Not Picked Up",
  in_transit: "In Transit",
  delivered: "Delivered",
};

export default function ShipmentListPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [carrier, setCarrier] = useState<"" | "UPS" | "DHL">("");
  // Quick date-range presets, plus a manual from/to pair for a custom range — "" (All time) means
  // no date filter at all. Picking a manual date clears the quick preset and vice versa.
  const [quickRange, setQuickRange] = useState<"" | "today" | "week" | "month">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stats, setStats] = useState<ShipmentStats | null>(null);
  const [openingLabelId, setOpeningLabelId] = useState<number | null>(null);
  // All per-row actions live behind a single dropdown, keyed by shipment id (only one open at a
  // time). Rendered via a portal at a fixed position (see actionsMenuPos) so the table's own
  // `overflow-hidden` (needed for its rounded corners) never clips the popup.
  const [actionsMenuId, setActionsMenuId] = useState<number | null>(null);
  const [actionsMenuPos, setActionsMenuPos] = useState<{ top: number; right: number } | null>(null);
  // Whether the per-box label picker is expanded inline within the open Actions menu (multi-piece shipments only).
  const [labelSubOpen, setLabelSubOpen] = useState(false);
  const [openingPieceKey, setOpeningPieceKey] = useState<string | null>(null);
  // Keyed as `${shipmentId}:waybill` / `${shipmentId}:invoice` — only one of these opening at a time.
  const [openingDocKey, setOpeningDocKey] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Multi-select serves two mutually-exclusive purposes — switching `selectionMode` clears the
  // current selection since eligibility rules differ (Pickup: same agent_account_id, not already
  // on an active Pickup. Receipt: same branch_id, never yet attached to any Receipt/Tax Invoice).
  const [selectionMode, setSelectionMode] = useState<"PICKUP" | "RECEIPT">("PICKUP");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pickupModalOpen, setPickupModalOpen] = useState(false);

  useEffect(() => {
    if (actionsMenuId == null) return;
    function handleClickOutside(e: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setActionsMenuId(null);
        setLabelSubOpen(false);
      }
    }
    function handleScroll() {
      setActionsMenuId(null);
      setLabelSubOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [actionsMenuId]);

  async function load(overrides?: { date_from?: string; date_to?: string }) {
    setLoading(true);
    setError("");
    try {
      const res = await listShipments({
        search: search.trim() || undefined,
        status: status || undefined,
        carrier: carrier || undefined,
        date_from: (overrides?.date_from ?? dateFrom) || undefined,
        date_to: (overrides?.date_to ?? dateTo) || undefined,
      });
      setShipments(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shipments");
    } finally {
      setLoading(false);
    }
  }

  // KPI cards always reflect today/this-month totals regardless of whatever list filters are
  // currently applied — loaded once, independent of `load()`.
  async function loadStats() {
    try {
      setStats(await getShipmentStats());
    } catch {
      // Non-critical — the list itself still works if the KPI summary fails to load.
    }
  }

  useEffect(() => {
    setName(getUser()?.name ?? "");
    load();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quick presets fill in dateFrom/dateTo (Y-m-d) and immediately reload (passing the computed
  // dates directly to load() to avoid a stale-state race) — picking a manual date input instead
  // clears the active preset (see the date <input> onChange handlers below).
  function applyQuickRange(range: "" | "today" | "week" | "month") {
    setQuickRange(range);
    const now = new Date();
    const toYmd = (d: Date) => d.toISOString().slice(0, 10);
    let from = "";
    let to = "";
    if (range === "today") {
      from = to = toYmd(now);
    } else if (range === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      from = toYmd(start);
      to = toYmd(now);
    } else if (range === "month") {
      from = toYmd(new Date(now.getFullYear(), now.getMonth(), 1));
      to = toYmd(now);
    }
    setDateFrom(from);
    setDateTo(to);
    load({ date_from: from, date_to: to });
  }

  async function handleViewLabel(shipment: Shipment) {
    if (!shipment.label_storage_key) return;
    setOpeningLabelId(shipment.id);
    try {
      await openShipmentLabel(shipment.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to open label");
    } finally {
      setOpeningLabelId(null);
    }
  }

  function handleActionsButtonClick(shipment: Shipment, e: React.MouseEvent<HTMLButtonElement>) {
    if (actionsMenuId === shipment.id) {
      setActionsMenuId(null);
      setLabelSubOpen(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setActionsMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setActionsMenuId(shipment.id);
    setLabelSubOpen(false);
  }

  // A shipment with multiple boxes has a tracking/label per box — clicking "Label" in the Actions
  // menu expands an inline picker instead of silently only opening the master label.
  function handleLabelMenuItemClick(shipment: Shipment) {
    if (describeShipmentPieces(shipment).length > 1) {
      setLabelSubOpen((open) => !open);
      return;
    }
    handleViewLabel(shipment);
  }

  async function handleOpenPieceLabel(shipment: Shipment, trackingNumber: string | null) {
    if (!trackingNumber) return;
    const key = `${shipment.id}:${trackingNumber}`;
    setOpeningPieceKey(key);
    try {
      await openShipmentLabel(shipment.id, trackingNumber);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to open label");
    } finally {
      setOpeningPieceKey(null);
      setActionsMenuId(null);
      setLabelSubOpen(false);
    }
  }

  async function handleOpenAllLabels(shipment: Shipment) {
    const key = `${shipment.id}:all`;
    setOpeningPieceKey(key);
    try {
      await printAllShipmentLabels(shipment.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to open label");
    } finally {
      setOpeningPieceKey(null);
      setActionsMenuId(null);
      setLabelSubOpen(false);
    }
  }

  async function handleOpenDocument(shipment: Shipment, kind: "waybill" | "invoice") {
    const storageKey = kind === "waybill" ? shipment.waybill_storage_key : shipment.commercial_invoice_storage_key;
    if (!storageKey) return;
    const key = `${shipment.id}:${kind}`;
    setOpeningDocKey(key);
    try {
      await (kind === "waybill" ? openShipmentWaybill(shipment.id) : openShipmentCommercialInvoice(shipment.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to open document");
    } finally {
      setOpeningDocKey(null);
    }
  }

  // UPS: really cancels the air waybill with UPS. DHL: DHL has no cancel API at all — this only
  // flips our own status locally, staff must still contact DHL directly (see backend note).
  async function handleVoid(shipment: Shipment) {
    const confirmMsg =
      shipment.carrier === "UPS"
        ? "Confirm voiding this shipment with UPS for real? (The Air Waybill will be cancelled with UPS immediately — this cannot be undone.)"
        : "DHL has no cancel API — this will only mark the status as Voided in our system. You must contact DHL directly to actually cancel it. Continue?";
    if (!confirm(confirmMsg)) return;

    setVoidingId(shipment.id);
    try {
      const updated = await voidShipment(shipment.id);
      setShipments((prev) => prev.map((s) => (s.id === shipment.id ? updated : s)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to void shipment");
    } finally {
      setVoidingId(null);
    }
  }

  // Only ever allowed by the backend when `is_test` is true (booked via a Test-mode Agent
  // Account). Real production bookings must use Void instead.
  async function handleDelete(shipment: Shipment) {
    if (!confirm("Permanently delete this TEST shipment? This cannot be undone.")) return;
    setDeletingId(shipment.id);
    try {
      await deleteShipment(shipment.id);
      setShipments((prev) => prev.filter((s) => s.id !== shipment.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete shipment");
    } finally {
      setDeletingId(null);
    }
  }

  // Only `booked` shipments on the SAME agent_account_id as the first one checked stay
  // selectable — see the note on `selectedIds` above. Also excludes shipments already sitting in
  // an active Pickup (see PickupController::store's matching server-side guard).
  const firstSelected = shipments.find((s) => selectedIds.has(s.id));
  function isSelectable(shipment: Shipment) {
    if (shipment.status !== "booked") return false;
    if (selectionMode === "PICKUP") {
      if ((shipment.pickups ?? []).length > 0) return false;
      if (!firstSelected) return true;
      return shipment.agent_account_id === firstSelected.agent_account_id;
    }
    // RECEIPT mode: never billed yet, and (once one is picked) same branch as the first one —
    // a Receipt/Tax Invoice's header info is printed for exactly one issuing branch.
    if ((shipment.receipts_count ?? 0) > 0) return false;
    if (!shipment.branch_id) return false;
    if (!firstSelected) return true;
    return shipment.branch_id === firstSelected.branch_id;
  }

  function toggleSelect(shipment: Shipment) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(shipment.id)) {
        next.delete(shipment.id);
      } else {
        next.add(shipment.id);
      }
      return next;
    });
  }

  function changeSelectionMode(mode: "PICKUP" | "RECEIPT") {
    setSelectionMode(mode);
    setSelectedIds(new Set());
  }

  // Read-only detail view of everything filled in at /shipment/create — a booked/failed
  // Shipment is never editable there either, just for reference/checking (see /shipment/view/[id]).

  return (
    <div>
      <PageHeader
        title={`My Shipments — Welcome, ${name || "there"} 👋`}
        description="Overview and all Shipments booked with UPS/DHL through this system"
        actions={
          <Link
            href="/shipment/create"
            className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
          >
            <Plus className="h-4 w-4" />
            Create Shipment
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <PackagePlus className="h-5 w-5" />
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-800">{stats ? stats.today_count : "–"}</p>
          <p className="text-sm text-slate-500">Shipments Today</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Truck className="h-5 w-5" />
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-800">{stats ? stats.in_transit_count : "–"}</p>
          <p className="text-sm text-slate-500">In Transit</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <PackageCheck className="h-5 w-5" />
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-800">{stats ? stats.month_count : "–"}</p>
          <p className="text-sm text-slate-500">Booked This Month</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy/10 text-brand-navy">
            <Wallet className="h-5 w-5" />
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-800">
            {stats ? Number(stats.month_revenue).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "–"}
          </p>
          <p className="text-sm text-slate-500">Revenue This Month (THB)</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <Ban className="h-5 w-5" />
          </div>
          <p className="mt-4 text-2xl font-bold text-slate-800">{stats ? stats.cancelled_count : "–"}</p>
          <p className="text-sm text-slate-500">Cancelled/Failed This Month</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Tracking No."
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          >
            <option value="">All</option>
            <option value="booked">Booked</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Carrier</span>
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value as "" | "UPS" | "DHL")}
            className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          >
            <option value="">All</option>
            <option value="UPS">UPS</option>
            <option value="DHL">DHL</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setQuickRange("");
              setDateFrom(e.target.value);
            }}
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setQuickRange("");
              setDateTo(e.target.value);
            }}
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Quick Range</span>
          <div className="flex gap-1">
            {([
              ["", "All"],
              ["today", "Today"],
              ["week", "This Week"],
              ["month", "This Month"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => applyQuickRange(value)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  quickRange === value
                    ? "bg-brand-navy-dark text-white"
                    : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm font-medium text-slate-500">Select shipments for:</span>
        {(["PICKUP", "RECEIPT"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => changeSelectionMode(mode)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              selectionMode === mode
                ? "bg-brand-navy-dark text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {mode === "PICKUP" ? "Pickup" : "Receipt / Tax Invoice"}
          </button>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-brand-navy/20 bg-brand-navy/5 px-4 py-3">
          <p className="text-sm font-medium text-brand-navy-dark">
            {selectionMode === "PICKUP"
              ? `${selectedIds.size} Shipment(s) selected — can be combined into one Pickup (same Carrier account)`
              : `${selectedIds.size} Shipment(s) selected — can be combined into one Receipt/Tax Invoice (same Branch)`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              Clear Selection
            </button>
            {selectionMode === "PICKUP" ? (
              <button
                type="button"
                onClick={() => setPickupModalOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
              >
                <Truck className="h-4 w-4" />
                Schedule Pickup
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  router.push(`/billing/receipts/new?shipment_ids=${Array.from(selectedIds).join(",")}`)
                }
                className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
              >
                <Receipt className="h-4 w-4" />
                Issue Receipt / Tax Invoice
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <PageLoading label="Loading Shipments..." />
      ) : (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
            <tr>
              <th className="w-10 px-5 py-2.5 font-medium"></th>
              <th className="px-5 py-2.5 font-medium">Tracking No.</th>
              <th className="px-5 py-2.5 font-medium">Sender</th>
              <th className="px-5 py-2.5 font-medium">Destination</th>
              <th className="px-5 py-2.5 font-medium">Carrier / Service</th>
              <th className="px-5 py-2.5 font-medium">Packages</th>
              <th className="px-5 py-2.5 font-medium">Date</th>
              <th className="px-5 py-2.5 font-medium">Status</th>
              <th className="px-5 py-2.5 font-medium">Tracking</th>
              <th className="px-5 py-2.5 font-medium text-right">Amount (THB)</th>
              <th className="px-5 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-8 text-center text-slate-400">
                  No shipments booked yet
                </td>
              </tr>
            ) : (
              shipments.map((s) => (
                <tr key={s.id} className="border-b border-slate-200 last:border-0">
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      disabled={!isSelectable(s) && !selectedIds.has(s.id)}
                      onChange={() => toggleSelect(s)}
                      className="h-4 w-4 rounded border-slate-300 text-brand-navy-dark disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={selectionMode === "PICKUP" ? "Select for Pickup" : "Select for Receipt/Tax Invoice"}
                      title={
                        selectionMode === "PICKUP"
                          ? (s.pickups ?? []).length > 0
                            ? "This shipment already has a Pickup scheduled — cancel the existing Pickup first to reschedule"
                            : undefined
                          : (s.receipts_count ?? 0) > 0
                            ? "This shipment already has a Receipt/Tax Invoice issued"
                            : !s.branch_id
                              ? "This shipment has no Branch on record — cannot be billed"
                              : undefined
                      }
                    />
                  </td>
                  <td className="px-5 py-3 font-mono font-medium text-slate-700">
                    {s.tracking_number ?? "-"}
                    {(s.pickups ?? []).length > 0 && (
                      <span
                        className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-sans font-semibold text-amber-600"
                        title="Pickup already scheduled"
                      >
                        Pickup ✓
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {[s.origin?.contact_name, s.origin?.company].filter(Boolean).join(" · ") || "-"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {[s.destination?.contact_name, s.destination?.city, s.destination?.country].filter(Boolean).join(", ") || "-"}
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <CarrierBadge carrier={s.carrier} />
                      <span>{s.service_label ?? s.service_code}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500">
                    {(s.packages ?? []).reduce((sum, p) => sum + (Number(p.quantity) || 1), 0)} boxes
                  </td>
                  <td className="px-5 py-3 text-slate-500">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status] ?? "bg-slate-50 text-slate-500"}`}>
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    {s.is_test && (
                      <span className="ml-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-600">TEST</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {s.status === "booked" ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TRACKING_STATUS_STYLE[s.tracking_status ?? ""] ?? "bg-slate-50 text-slate-400"}`}
                        title={s.tracking_raw_status ?? undefined}
                      >
                        {TRACKING_STATUS_LABEL[s.tracking_status ?? ""] ?? "No data yet"}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-800">
                    {Number(s.order_total).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => handleActionsButtonClick(s, e)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                      aria-label="Actions"
                      title="Actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {actionsMenuId === s.id &&
                      actionsMenuPos &&
                      createPortal(
                        <div
                          ref={actionsMenuRef}
                          style={{ position: "fixed", top: actionsMenuPos.top, right: actionsMenuPos.right }}
                          className="z-50 w-64 rounded-lg border border-slate-200 bg-white p-1.5 text-left shadow-lg"
                        >
                          <Link
                            href={`/shipment/view/${s.id}`}
                            onClick={() => setActionsMenuId(null)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            View Shipment Details
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleLabelMenuItemClick(s)}
                            disabled={!s.label_storage_key || openingLabelId === s.id}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {openingLabelId === s.id ? (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                            ) : (
                              <Barcode className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            )}
                            {s.label_storage_key ? "Open Label" : "No Label"}
                          </button>
                          {labelSubOpen && (
                            <div className="mb-1 ml-2 border-l border-slate-100 pl-2">
                              <p className="px-2 py-1 text-[11px] font-semibold text-slate-400">
                                Select a box to open its label ({describeShipmentPieces(s).length} boxes)
                              </p>
                              <button
                                type="button"
                                onClick={() => handleOpenAllLabels(s)}
                                disabled={openingPieceKey === `${s.id}:all`}
                                className="mb-1 flex w-full items-center justify-between gap-2 rounded-md border-b border-slate-100 px-2 py-1.5 text-left text-xs font-semibold text-brand-navy-dark hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <span>Print All Labels</span>
                                {openingPieceKey === `${s.id}:all` ? (
                                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                                ) : (
                                  <Printer className="h-3 w-3 shrink-0" />
                                )}
                              </button>
                              {describeShipmentPieces(s).map((piece, i) => {
                                const key = `${s.id}:${piece.tracking_number}`;
                                return (
                                  <button
                                    // Index-suffixed: Test-mode bookings reuse the same
                                    // placeholder tracking number for every piece.
                                    key={`${key}-${i}`}
                                    type="button"
                                    onClick={() => handleOpenPieceLabel(s, piece.tracking_number)}
                                    disabled={!piece.label_storage_key || openingPieceKey === key}
                                    className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <span className="min-w-0 truncate">
                                      {piece.description} — <span className="font-mono">{piece.tracking_number ?? "-"}</span>
                                    </span>
                                    {openingPieceKey === key ? (
                                      <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                                    ) : (
                                      <Barcode className="h-3 w-3 shrink-0 text-slate-400" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenDocument(s, "waybill");
                              setActionsMenuId(null);
                            }}
                            disabled={!s.waybill_storage_key || openingDocKey === `${s.id}:waybill`}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {openingDocKey === `${s.id}:waybill` ? (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                            ) : (
                              <Receipt className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            )}
                            {s.waybill_storage_key ? "Open UPS Waybill (Shipper's Copy)" : "No Waybill available"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenDocument(s, "invoice");
                              setActionsMenuId(null);
                            }}
                            disabled={!s.commercial_invoice_storage_key || openingDocKey === `${s.id}:invoice`}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {openingDocKey === `${s.id}:invoice` ? (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                            ) : (
                              <FileCheck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            )}
                            {s.commercial_invoice_storage_key ? "Open Commercial Invoice" : "No Commercial Invoice available"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              router.push("/billing/receipts/new");
                              setActionsMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                          >
                            <Printer className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            Issue Receipt / Tax Invoice
                          </button>
                          {s.status === "booked" && (
                            <button
                              type="button"
                              onClick={() => {
                                handleVoid(s);
                                setActionsMenuId(null);
                              }}
                              disabled={voidingId === s.id}
                              className="flex w-full items-center gap-2 rounded-md border-t border-slate-100 px-2 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {voidingId === s.id ? (
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 shrink-0" />
                              )}
                              {s.carrier === "UPS" ? "Void shipment with UPS" : "Mark as cancelled locally (DHL has no cancel API)"}
                            </button>
                          )}
                          {s.is_test && (
                            <button
                              type="button"
                              onClick={() => {
                                handleDelete(s);
                                setActionsMenuId(null);
                              }}
                              disabled={deletingId === s.id}
                              className="flex w-full items-center gap-2 rounded-md border-t border-slate-100 px-2 py-1.5 text-left text-xs text-purple-600 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {deletingId === s.id ? (
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                              )}
                              Delete TEST shipment
                            </button>
                          )}
                        </div>,
                        document.body,
                      )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {pickupModalOpen && firstSelected && (
        <SchedulePickupModal
          shipments={shipments.filter((s) => selectedIds.has(s.id))}
          onClose={() => setPickupModalOpen(false)}
          onCreated={(pickup) => {
            setPickupModalOpen(false);
            setSelectedIds(new Set());
            alert(
              pickup.status === "requested"
                ? `Pickup scheduled successfully — reference number from ${pickup.carrier}: ${pickup.carrier_reference ?? "-"}`
                : `Failed to schedule pickup: ${pickup.error_message ?? "unknown error"}`,
            );
            router.push("/pickup/list");
          }}
        />
      )}
    </div>
  );
}
