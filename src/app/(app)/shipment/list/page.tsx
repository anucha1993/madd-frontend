"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
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
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  CheckCircle2,
  RotateCcw,
  Mail,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { useAccess } from "@/components/auth/AccessProvider";
import PageLoading from "@/components/ui/PageLoading";
import CarrierBadge from "@/components/ui/CarrierBadge";
import ManageColumnsModal from "@/components/ui/ManageColumnsModal";
import ColumnProfileSelect from "@/components/ui/ColumnProfileSelect";
import OverduePickupsBanner from "@/components/pickup/OverduePickupsBanner";
import PendingCarrierCancelBanner from "@/components/shipment/PendingCarrierCancelBanner";
import VoidShipmentModal, { dhlCancelMessage } from "@/components/shipment/VoidShipmentModal";
import SchedulePickupModal from "@/components/pickup/SchedulePickupModal";
import { useManageColumns, type ColumnDef } from "@/hooks/useManageColumns";
import { getUser } from "@/lib/auth";
import { listManifestOptions, type ManifestOption } from "@/lib/manifestOptions";
import { branchLabel } from "@/lib/branches";
import {
  listShipments,
  getShipmentStats,
  openShipmentLabel,
  printAllShipmentLabels,
  describeShipmentPieces,
  openShipmentWaybill,
  downloadDhlOriginalWaybill,
  openShipmentCommercialInvoice,
  unvoidShipment,
  confirmCarrierCancel,
  markCarrierCancelNotified,
  markShipmentPickedUp,
  TRACKING_GROUP_LABEL,
  type TrackingGroup,
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

// The select-checkbox and Actions columns are structural (not data), so they're always shown and
// left out of this list — every other field the Shipment record can supply is offered here, incl.
// ones not shown by default, so the user can turn any of them on via Manage Columns.
// `field` = the Shipment field group (config/permissions.php) the column reads — the column is
// dropped entirely for users whose Role hides that group (the API omits those values anyway).
type ShipmentColumn = ColumnDef & { align?: "right"; field?: string; render: (s: Shipment) => ReactNode };

const money = (n: unknown) => Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

const SHIPMENT_COLUMNS: ShipmentColumn[] = [
  {
    id: "tracking_no",
    label: "Tracking No.",
    render: (s) => (
      <>
        {s.tracking_number ?? "-"}
        {/* Collected (tracking scan / staff confirmation) wins over "scheduled" — an on-call
            Pickup on its own never proves the courier actually came. */}
        {s.picked_up_at ? (
          <span
            className="ml-1.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-sans font-semibold text-emerald-600"
            title={`${s.picked_up_source === "manual" ? "ยืนยันโดยพนักงาน" : "จาก Tracking scan"} · ${new Date(s.picked_up_at).toLocaleString()}`}
          >
            Picked Up ✓
          </span>
        ) : (
          (s.pickups ?? []).length > 0 && (
            <span
              className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-sans font-semibold text-amber-600"
              title="นัด Pickup แล้ว — รอรถมารับ"
            >
              Pickup Scheduled
            </span>
          )
        )}
      </>
    ),
  },
  {
    id: "sender",
    label: "Sender",
    render: (s) => (
      <div className="flex flex-col gap-1">
        <span>{[s.origin?.contact_name, s.origin?.company].filter(Boolean).join(" · ") || "-"}</span>
        {s.customer_type && (
          <span className="w-fit rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-600">{s.customer_type}</span>
        )}
      </div>
    ),
  },
  {
    id: "destination",
    label: "Destination",
    render: (s) => [s.destination?.contact_name, s.destination?.city, s.destination?.country].filter(Boolean).join(", ") || "-",
  },
  {
    id: "carrier_service",
    label: "Carrier / Service",
    render: (s) => (
      <div className="flex items-center gap-1.5">
        <CarrierBadge carrier={s.carrier} />
        <span>{s.service_label ?? s.service_code}</span>
      </div>
    ),
  },
  {
    id: "packages",
    label: "Packages",
    render: (s) => `${(s.packages ?? []).reduce((sum, p) => sum + (Number(p.quantity) || 1), 0)} boxes`,
  },
  { id: "date", label: "Date", render: (s) => new Date(s.created_at).toLocaleDateString() },
  {
    id: "status",
    label: "Status",
    render: (s) => (
      <>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status] ?? "bg-slate-50 text-slate-500"}`}>
          {STATUS_LABEL[s.status] ?? s.status}
        </span>
        {s.is_test && <span className="ml-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-600">TEST</span>}
        {/* DHL has no cancel API — show whether DHL itself has been told yet. */}
        {s.status === "voided" && s.carrier_cancel_status === "pending" && (
          <span
            className="ml-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"
            title={
              s.carrier_cancel_requested_at
                ? `แจ้ง DHL แล้ว${s.carrier_cancel_requested_to ? ` (${s.carrier_cancel_requested_to})` : ""} เมื่อ ${new Date(s.carrier_cancel_requested_at).toLocaleString()}`
                : "Void ในระบบแล้ว แต่ยังไม่ได้แจ้ง DHL"
            }
          >
            {s.carrier_cancel_requested_at ? "รอ DHL ยืนยัน" : "รอแจ้ง DHL"}
          </span>
        )}
        {s.status === "voided" && s.carrier_cancel_status === "confirmed" && (
          <span className="ml-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700" title={s.carrier_cancel_reference ? `อ้างอิง DHL: ${s.carrier_cancel_reference}` : undefined}>
            DHL ยืนยันยกเลิก
          </span>
        )}
      </>
    ),
  },
  {
    id: "tracking_status",
    label: "Tracking",
    render: (s) => {
      if (s.status !== "booked") return <span className="text-xs text-slate-300">—</span>;
      // Not collected yet but on an active Pickup — the courier is expected, not confirmed.
      if (!s.picked_up_at && s.tracking_status !== "delivered" && (s.pickups ?? []).length > 0) {
        return <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">Awaiting Pickup</span>;
      }
      return (
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TRACKING_STATUS_STYLE[s.tracking_status ?? ""] ?? "bg-slate-50 text-slate-400"}`}
          title={
            s.picked_up_source === "manual"
              ? "ยืนยันโดยพนักงาน — รอ Tracking scan จาก Carrier"
              : (s.tracking_raw_status ?? undefined)
          }
        >
          {TRACKING_STATUS_LABEL[s.tracking_status ?? ""] ?? "No data yet"}
          {s.picked_up_source === "manual" && s.tracking_status !== "delivered" && " (Staff)"}
        </span>
      );
    },
  },
  {
    id: "picked_up_at",
    label: "Picked Up At",
    render: (s) =>
      s.picked_up_at ? (
        <span title={s.picked_up_source === "manual" ? "ยืนยันโดยพนักงาน" : "จาก Tracking scan ของ Carrier"}>
          {new Date(s.picked_up_at).toLocaleString()}
        </span>
      ) : (
        <span className="text-xs text-slate-300">—</span>
      ),
  },
  { id: "amount", label: "Amount (THB)", align: "right", field: "pricing", render: (s) => <span className="font-semibold text-slate-800">{money(s.order_total)}</span> },
  {
    id: "cost_amount",
    label: "Actual Cost (Ref.)",
    align: "right",
    field: "cost",
    render: (s) => (s.cost_amount != null ? `${money(s.cost_amount)} ${s.cost_currency ?? ""}`.trim() : "-"),
  },
  { id: "agent_account", label: "Agent Account", render: (s) => s.agent_account?.username_acc ?? "-" },
  { id: "branch", label: "Branch", render: (s) => (s.branch ? branchLabel(s.branch) : "-") },
  { id: "customer_type", label: "Customer Type", render: (s) => s.customer_type ?? "-" },
  { id: "entity_type", label: "Entity Type", render: (s) => s.entity_type ?? "-" },
  { id: "freight_amount", label: "Freight Amount", align: "right", field: "pricing", render: (s) => money(s.freight_amount) },
  { id: "addon_total", label: "Addon Total", align: "right", field: "pricing", render: (s) => money(s.addon_total) },
  { id: "currency", label: "Currency", render: (s) => s.currency ?? "-" },
  { id: "payment_method", label: "Payment Method", render: (s) => s.payment_method ?? "-" },
  { id: "bill_transportation_to", label: "Bill Transportation To", field: "billing", render: (s) => s.bill_transportation_to ?? "-" },
  { id: "bill_duty_tax_to", label: "Bill Duty/Tax To", field: "billing", render: (s) => s.bill_duty_tax_to ?? "-" },
  { id: "ref_invoice_no", label: "Ref. Invoice No.", field: "references", render: (s) => s.ref_invoice_no ?? "-" },
  { id: "ref_insurance_no", label: "Ref. Insurance No.", field: "references", render: (s) => s.ref_insurance_no ?? "-" },
  { id: "ref_purchase_no", label: "Ref. Purchase No.", field: "references", render: (s) => s.ref_purchase_no ?? "-" },
  {
    id: "documents",
    label: "Documents",
    render: (s) =>
      [
        s.label_storage_key && "Label",
        s.waybill_storage_key && "Waybill",
        s.commercial_invoice_storage_key && "Invoice",
      ]
        .filter(Boolean)
        .join(", ") || "-",
  },
  { id: "pieces", label: "Pieces", render: (s) => (s.pieces?.length ? String(s.pieces.length) : "-") },
  {
    id: "billed",
    label: "Billed",
    render: (s) =>
      (s.receipts_count ?? 0) > 0 ? (
        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-600">Yes</span>
      ) : (
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">No</span>
      ),
  },
  {
    id: "test_mode",
    label: "Test Mode",
    render: (s) => (s.is_test ? "Yes" : "No"),
  },
  {
    id: "voided",
    label: "Voided",
    render: (s) => (s.voided_at ? `${new Date(s.voided_at).toLocaleDateString()}${s.void_note ? ` — ${s.void_note}` : ""}` : "-"),
  },
  { id: "error", label: "Error", field: "carrier_raw", render: (s) => s.error_message ?? "-" },
  { id: "delivered_at", label: "Delivered At", render: (s) => (s.delivered_at ? new Date(s.delivered_at).toLocaleDateString() : "-") },
  {
    id: "tracking_synced_at",
    label: "Tracking Synced At",
    render: (s) => (s.tracking_synced_at ? new Date(s.tracking_synced_at).toLocaleString() : "-"),
  },
];

export default function ShipmentListPage() {
  const router = useRouter();
  const { can, canSeeField } = useAccess();
  const allowedColumns = useMemo(
    () => SHIPMENT_COLUMNS.filter((c) => !c.field || canSeeField("shipment", c.field)),
    [canSeeField],
  );
  // Each bulk-selection purpose needs its own permission; modes the user can't act on are hidden.
  const selectionModes = (["PICKUP", "RECEIPT", "DELETE_TEST"] as const).filter((mode) =>
    can(mode === "PICKUP" ? "pickup.create" : mode === "RECEIPT" ? "receipt.create" : "shipment.delete"),
  );
  const [name, setName] = useState("");
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [trackingGroup, setTrackingGroup] = useState<TrackingGroup | "">("");
  const [carrier, setCarrier] = useState<"" | "UPS" | "DHL">("");
  const [customerType, setCustomerType] = useState("");
  const [customerTypeOptions, setCustomerTypeOptions] = useState<ManifestOption[]>([]);
  // Quick date-range presets, plus a manual from/to pair for a custom range — "" (All time) means
  // no date filter at all. Picking a manual date clears the quick preset and vice versa.
  const [quickRange, setQuickRange] = useState<"" | "today" | "week" | "month">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
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
  const [voidTarget, setVoidTarget] = useState<Shipment | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Multi-select serves THREE mutually-exclusive purposes — switching `selectionMode` clears the
  // current selection since eligibility rules differ (Pickup: same agent_account_id, not already
  // on an active Pickup. Receipt: same branch_id, never yet attached to any Receipt/Tax Invoice.
  // Mass Delete: Test-mode shipments only, never yet attached to any Receipt/Tax Invoice).
  const [selectionMode, setSelectionMode] = useState<"PICKUP" | "RECEIPT" | "DELETE_TEST">(selectionModes[0] ?? "PICKUP");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [massDeleting, setMassDeleting] = useState(false);
  const columnsMgr = useManageColumns("shipment-list", allowedColumns);

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

  async function load(overrides?: { date_from?: string; date_to?: string; page?: number; status?: string }) {
    setLoading(true);
    setError("");
    const effectiveStatus = overrides?.status ?? status;
    try {
      const res = await listShipments({
        search: search.trim() || undefined,
        status: effectiveStatus && effectiveStatus !== "cancel_pending" ? effectiveStatus : undefined,
        cancel: effectiveStatus === "cancel_pending" ? "pending" : undefined,
        tracking: trackingGroup || undefined,
        carrier: carrier || undefined,
        customer_type: customerType || undefined,
        date_from: (overrides?.date_from ?? dateFrom) || undefined,
        date_to: (overrides?.date_to ?? dateTo) || undefined,
        page: overrides?.page ?? page,
      });
      setShipments(res.data);
      setLastPage(res.last_page);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shipments");
    } finally {
      setLoading(false);
    }
  }

  // Any filter change starts back over at page 1 — otherwise a narrower result set could leave
  // the list stuck on a now out-of-range page.
  function handleSearch() {
    setPage(1);
    load({ page: 1 });
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
    loadStats();
    listManifestOptions("customer_type")
      .then((opts) => setCustomerTypeOptions(opts.filter((o) => o.status)))
      .catch(() => {
        // Non-critical — the filter dropdown just stays empty if this fails.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prev/Next only ever change `page` — reload whenever it does. This also covers the initial
  // mount load (page starts at 1).
  useEffect(() => {
    load({ page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

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
    setPage(1);
    load({ date_from: from, date_to: to, page: 1 });
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
    // Waybill is built on-the-fly from label_storage_key (DIY Shipper's Copy) — see
    // ShipmentController::buildDhlDiyWaybill / buildUpsDiyWaybill. Invoice comes from
    // commercial_invoice_storage_key stored by the carrier.
    const storageKey = kind === "waybill" ? shipment.label_storage_key : shipment.commercial_invoice_storage_key;
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
  async function handleMarkPickedUp(shipment: Shipment) {
    if (!confirm(`ยืนยันว่า Courier มารับ ${shipment.tracking_number ?? "Shipment นี้"} ไปแล้ว?`)) return;
    try {
      const updated = await markShipmentPickedUp(shipment.id);
      setShipments((prev) => prev.map((s) => (s.id === shipment.id ? { ...s, ...updated, pickups: s.pickups } : s)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    }
  }

  function handleVoid(shipment: Shipment) {
    setVoidTarget(shipment);
  }

  function replaceShipment(updated: Shipment) {
    setShipments((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated, pickups: s.pickups } : s)));
  }

  async function handleConfirmCarrierCancel(shipment: Shipment) {
    const reference = prompt(`DHL ยืนยันการยกเลิก Waybill ${shipment.tracking_number} แล้ว?\nใส่เลขอ้างอิง / ชื่อผู้ยืนยันจาก DHL (ถ้ามี):`, "");
    if (reference === null) return;
    setVoidingId(shipment.id);
    try {
      replaceShipment(await confirmCarrierCancel(shipment.id, reference.trim()));
    } catch (err) {
      alert(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setVoidingId(null);
    }
  }

  async function handleMarkNotified(shipment: Shipment) {
    const notifiedTo = prompt(`บันทึกว่าแจ้ง DHL ให้ยกเลิก ${shipment.tracking_number} แล้ว\nแจ้งใคร / ช่องทางไหน (เช่น คุณเอ DHL ทางโทรศัพท์):`, shipment.carrier_cancel_requested_to ?? "");
    if (notifiedTo === null) return;
    setVoidingId(shipment.id);
    try {
      replaceShipment(await markCarrierCancelNotified(shipment.id, notifiedTo.trim()));
    } catch (err) {
      alert(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setVoidingId(null);
    }
  }

  async function handleUnvoid(shipment: Shipment) {
    if (!confirm(`คืนสถานะ ${shipment.tracking_number} เป็น Booked?\n(ใช้เมื่อกด Void ผิด — Waybill ที่ DHL ยังใช้ได้ แต่ Pickup ที่ถูกยกเลิกไปแล้วต้องนัดใหม่)`)) return;
    setVoidingId(shipment.id);
    try {
      replaceShipment(await unvoidShipment(shipment.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "คืนสถานะไม่สำเร็จ");
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
    if (selectionMode === "DELETE_TEST") {
      // Any status is fine (booked/pending/failed/voided) — the backend's own destroy() guard
      // is what actually enforces is_test; a receipt/tax invoice attached still blocks it though.
      if (!shipment.is_test) return false;
      if ((shipment.receipts_count ?? 0) > 0) return false;
      return true;
    }
    if (shipment.status !== "booked") return false;
    if (selectionMode === "PICKUP") {
      if ((shipment.pickups ?? []).length > 0) return false;
      // Already collected by the courier (tracking scan or staff confirmation).
      if (shipment.picked_up_at) return false;
      if (!firstSelected) return true;
      return shipment.agent_account_id === firstSelected.agent_account_id;
    }
    // RECEIPT mode: never billed yet — branch does NOT need to match (or even be set) across
    // selected shipments; the receipt's issuing branch is picked/overridable on the next screen
    // regardless of what branch(es) the underlying shipments belong to.
    if ((shipment.receipts_count ?? 0) > 0) return false;
    return true;
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

  function changeSelectionMode(mode: "PICKUP" | "RECEIPT" | "DELETE_TEST") {
    setSelectionMode(mode);
    setSelectedIds(new Set());
  }

  // Bulk-deletes every selected Test-mode shipment by calling the SAME single-delete endpoint
  // per id (already enforces is_test/no-receipts server-side) — no new backend endpoint needed.
  async function handleMassDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Permanently delete ${ids.length} TEST shipment(s)? This cannot be undone.`)) return;

    setMassDeleting(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteShipment(id)));
      const succeededIds: number[] = [];
      const failures: string[] = [];
      results.forEach((r, i) => {
        const id = ids[i];
        if (r.status === "fulfilled") {
          succeededIds.push(id);
        } else {
          const trackingNo = shipments.find((s) => s.id === id)?.tracking_number ?? `#${id}`;
          const message = r.reason instanceof Error ? r.reason.message : "Failed to delete";
          failures.push(`${trackingNo}: ${message}`);
        }
      });
      setShipments((prev) => prev.filter((s) => !succeededIds.includes(s.id)));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        succeededIds.forEach((id) => next.delete(id));
        return next;
      });
      let summary = `Deleted ${succeededIds.length} shipment(s).`;
      if (failures.length > 0) summary += `\n\nFailed to delete ${failures.length}:\n${failures.join("\n")}`;
      alert(summary);
    } finally {
      setMassDeleting(false);
    }
  }

  // Read-only detail view of everything filled in at /shipment/create — a booked/failed
  // Shipment is never editable there either, just for reference/checking (see /shipment/view/[id]).

  return (
    <div>
      <PageHeader
        title={`My Shipments — Welcome, ${name || "there"} 👋`}
        description="Overview and all Shipments booked with UPS/DHL through this system"
        actions={
          can("shipment.create") && (
            <Link
              href="/shipment/create"
              className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
            >
              <Plus className="h-4 w-4" />
              Create Shipment
            </Link>
          )
        }
      />

      <OverduePickupsBanner />
      <PendingCarrierCancelBanner
        onShow={() => {
          setStatus("cancel_pending");
          setPage(1);
          void load({ status: "cancel_pending", page: 1 });
        }}
      />

      {voidTarget && <VoidShipmentModal shipment={voidTarget} onClose={() => setVoidTarget(null)} onVoided={replaceShipment} />}

      {(() => {
        // Each card has its own permission (Roles › การ์ดสรุปหน้า Shipments); the API also leaves
        // out the numbers of cards the Role can't see.
        const cards = [
          { key: "today", icon: <PackagePlus className="h-5 w-5" />, tone: "bg-blue-50 text-blue-600", value: stats?.today_count, label: "Shipments Today" },
          { key: "in_transit", icon: <Truck className="h-5 w-5" />, tone: "bg-amber-50 text-amber-600", value: stats?.in_transit_count, label: "In Transit" },
          { key: "month", icon: <PackageCheck className="h-5 w-5" />, tone: "bg-emerald-50 text-emerald-600", value: stats?.month_count, label: "Booked This Month" },
          {
            key: "revenue",
            icon: <Wallet className="h-5 w-5" />,
            tone: "bg-brand-navy/10 text-brand-navy",
            value: stats?.month_revenue != null ? Number(stats.month_revenue).toLocaleString(undefined, { maximumFractionDigits: 0 }) : undefined,
            label: "Revenue This Month (THB)",
            hidden: !canSeeField("shipment", "pricing"),
          },
          { key: "cancelled", icon: <Ban className="h-5 w-5" />, tone: "bg-red-50 text-red-600", value: stats?.cancelled_count, label: "Cancelled/Failed This Month" },
        ].filter((c) => can(`shipment_kpi.${c.key}`) && !c.hidden);
        if (cards.length === 0) return null;
        const cols = ["", "lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4", "lg:grid-cols-5"][cards.length];
        return (
          <div className={`mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 ${cols}`}>
            {cards.map((c) => (
              <div key={c.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${c.tone}`}>{c.icon}</div>
                <p className="mt-4 text-2xl font-bold text-slate-800">{c.value ?? "–"}</p>
                <p className="text-sm text-slate-500">{c.label}</p>
              </div>
            ))}
          </div>
        );
      })()}

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">Search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Tracking No. / Sender / Receiver"
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
            <option value="cancel_pending">Voided · รอ DHL ยืนยันยกเลิก</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">การรับของ</span>
          <select
            value={trackingGroup}
            onChange={(e) => setTrackingGroup(e.target.value as TrackingGroup | "")}
            className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          >
            <option value="">All</option>
            {(Object.entries(TRACKING_GROUP_LABEL) as [TrackingGroup, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
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
          <span className="text-sm font-medium text-slate-600">Customer Type</span>
          <select
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value)}
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
          >
            <option value="">All</option>
            {customerTypeOptions.map((opt) => (
              <option key={opt.id} value={opt.code}>
                {opt.name} ({opt.code})
              </option>
            ))}
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
          onClick={handleSearch}
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Search className="h-4 w-4" />
          Search
        </button>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2 ${selectionModes.length === 0 ? "invisible" : ""}`}>
          <span className="text-sm font-medium text-slate-500">Select shipments for:</span>
          {selectionModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => changeSelectionMode(mode)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                selectionMode === mode
                  ? mode === "DELETE_TEST"
                    ? "bg-red-600 text-white"
                    : "bg-brand-navy-dark text-white"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {mode === "PICKUP" ? "Pickup" : mode === "RECEIPT" ? "Receipt / Tax Invoice" : "Mass Delete (Test)"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ColumnProfileSelect mgr={columnsMgr} />
          <button
            type="button"
            onClick={columnsMgr.openModal}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Columns3 className="h-4 w-4" />
            Manage Columns
          </button>
        </div>
      </div>

      {columnsMgr.isOpen && (
        <ManageColumnsModal
          columns={columnsMgr.orderedColumns}
          visible={columnsMgr.visible}
          groupOf={columnsMgr.groupOf}
          onCancel={columnsMgr.closeModal}
          onSave={columnsMgr.save}
          lockVisibility={!columnsMgr.canManage}
          onReset={columnsMgr.resetLayout}
          profileEditor={
            columnsMgr.canManage
              ? {
                  profile: columnsMgr.activeProfile,
                  roles: columnsMgr.roles,
                  onSaveProfile: columnsMgr.saveProfile,
                  onDeleteProfile: columnsMgr.deleteProfile,
                }
              : undefined
          }
        />
      )}

      {selectedIds.size > 0 && selectionModes.includes(selectionMode) && (
        <div
          className={`mb-4 flex items-center justify-between rounded-2xl border px-4 py-3 ${
            selectionMode === "DELETE_TEST" ? "border-red-200 bg-red-50" : "border-brand-navy/20 bg-brand-navy/5"
          }`}
        >
          <p className={`text-sm font-medium ${selectionMode === "DELETE_TEST" ? "text-red-700" : "text-brand-navy-dark"}`}>
            {selectionMode === "PICKUP"
              ? `${selectedIds.size} Shipment(s) selected — can be combined into one Pickup (same Carrier account)`
              : selectionMode === "RECEIPT"
                ? `${selectedIds.size} Shipment(s) selected — can be combined into one Receipt/Tax Invoice (same Branch)`
                : `${selectedIds.size} TEST Shipment(s) selected — will be PERMANENTLY deleted, cannot be undone`}
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
            ) : selectionMode === "RECEIPT" ? (
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
            ) : (
              <button
                type="button"
                onClick={handleMassDelete}
                disabled={massDeleting}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {massDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Mass Delete ({selectedIds.size})
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
              {columnsMgr.columnSlots.map((slot) => (
                <th
                  key={slot.map((c) => c.id).join("+")}
                  className={`px-5 py-2.5 font-medium ${slot.length === 1 && slot[0].align === "right" ? "text-right" : ""}`}
                >
                  {slot.map((c) => c.label).join(" / ")}
                </th>
              ))}
              <th className="px-5 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shipments.length === 0 ? (
              <tr>
                <td colSpan={2 + columnsMgr.columnSlots.length} className="px-5 py-8 text-center text-slate-400">
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
                      aria-label={
                        selectionMode === "PICKUP"
                          ? "Select for Pickup"
                          : selectionMode === "RECEIPT"
                            ? "Select for Receipt/Tax Invoice"
                            : "Select for Mass Delete"
                      }
                      title={
                        selectionMode === "PICKUP"
                          ? (s.pickups ?? []).length > 0
                            ? "This shipment already has a Pickup scheduled — cancel the existing Pickup first to reschedule"
                            : undefined
                          : selectionMode === "RECEIPT"
                            ? (s.receipts_count ?? 0) > 0
                              ? "This shipment already has a Receipt/Tax Invoice issued"
                              : undefined
                            : !s.is_test
                              ? "Only Test-mode shipments (booked via a Test Agent Account) can be mass-deleted"
                              : (s.receipts_count ?? 0) > 0
                                ? "This shipment already has a Receipt/Tax Invoice issued — delete that first"
                                : undefined
                      }
                    />
                  </td>
                  {columnsMgr.columnSlots.map((slot) => (
                    <td
                      key={slot.map((c) => c.id).join("+")}
                      className={`px-5 py-3 text-slate-500 ${slot.length === 1 && slot[0].align === "right" ? "text-right" : ""}`}
                    >
                      {slot.length === 1 ? (
                        slot[0].render(s)
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {slot.map((c) => (
                            <div key={c.id}>{c.render(s)}</div>
                          ))}
                        </div>
                      )}
                    </td>
                  ))}
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
                          {can("shipment.detail") && (
                          <Link
                            href={`/shipment/view/${s.id}`}
                            onClick={() => setActionsMenuId(null)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            View Shipment Details
                          </Link>
                          )}
                          {(describeShipmentPieces(s).length > 1 ? can(["shipment.label", "shipment.label_all"]) : can("shipment.label")) && (
                          <>
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
                              {can("shipment.label_all") && (
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
                              )}
                              {can("shipment.label") && describeShipmentPieces(s).map((piece, i) => {
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
                          </>
                          )}
                          {can("shipment.waybill") && (
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenDocument(s, "waybill");
                              setActionsMenuId(null);
                            }}
                            disabled={!s.label_storage_key || openingDocKey === `${s.id}:waybill`}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {openingDocKey === `${s.id}:waybill` ? (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                            ) : (
                              <Receipt className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            )}
                            {s.label_storage_key ? "Open Waybill (Shipper's Copy)" : "No Waybill available"}
                          </button>
                          )}
                          {s.carrier === "DHL" && s.waybill_storage_key && can("shipment.waybill_original") && (
                            <button
                              type="button"
                              onClick={() => {
                                setActionsMenuId(null);
                                downloadDhlOriginalWaybill(s).catch((err) => alert(err instanceof Error ? err.message : "ดาวน์โหลดไม่สำเร็จ"));
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Download className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              Download DHL original waybill
                            </button>
                          )}
                          {can("shipment.invoice") && (
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
                          )}
                          {can("shipment.issue_receipt") && can("receipt.create") && (
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
                          )}
                          {s.status === "booked" && !s.picked_up_at && can("shipment.mark_picked_up") && (
                            <button
                              type="button"
                              onClick={() => {
                                handleMarkPickedUp(s);
                                setActionsMenuId(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md border-t border-slate-100 px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                            >
                              <Truck className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              ยืนยันรถรับแล้ว
                            </button>
                          )}
                          {s.status === "booked" && can("shipment.void") && (
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
                              {s.carrier === "UPS" ? "Void shipment with UPS" : "Void (แจ้งยกเลิก DHL)"}
                            </button>
                          )}
                          {s.status === "voided" && s.carrier_cancel_status === "pending" && (
                            <>
                              {can("shipment.cancel_copy") && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard?.writeText(dhlCancelMessage(s)).catch(() => {});
                                  setActionsMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-md border-t border-slate-100 px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
                              >
                                <Copy className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                คัดลอกข้อความแจ้งยกเลิก DHL
                              </button>
                              )}
                              {can("shipment.cancel_notified") && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleMarkNotified(s);
                                  setActionsMenuId(null);
                                }}
                                disabled={voidingId === s.id}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                              >
                                <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                {s.carrier_cancel_requested_at ? "แก้ไขบันทึกการแจ้ง DHL" : "บันทึกว่าแจ้ง DHL แล้ว"}
                              </button>
                              )}
                              {can("shipment.cancel_confirmed") && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleConfirmCarrierCancel(s);
                                  setActionsMenuId(null);
                                }}
                                disabled={voidingId === s.id}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                                DHL ยืนยันยกเลิกแล้ว
                              </button>
                              )}
                            </>
                          )}
                          {s.status === "voided" && s.carrier_cancel_status === "pending" && can("shipment.unvoid") && (
                            <button
                              type="button"
                              onClick={() => {
                                handleUnvoid(s);
                                setActionsMenuId(null);
                              }}
                              disabled={voidingId === s.id}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                              <RotateCcw className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              ยกเลิก Void (กด Void ผิด)
                            </button>
                          )}
                          {s.is_test && can("shipment.delete") && (
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

      {!loading && shipments.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page} / {lastPage} ({total.toLocaleString()} shipments)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage}
              className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
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
