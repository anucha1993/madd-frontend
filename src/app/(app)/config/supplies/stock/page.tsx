"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Download,
  PackagePlus,
  Search,
  SlidersHorizontal,
  ClipboardCheck,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import PageLoading from "@/components/ui/PageLoading";
import { useAccess } from "@/components/auth/AccessProvider";
import {
  adjustStock,
  downloadStockReport,
  getStockReport,
  getSupplyStock,
  listStockMovements,
  MOVEMENT_LABEL,
  receiveStock,
  setStockLimits,
  type MovementFilters,
  type StockBranch,
  type StockCell,
  type StockLevel,
  type StockMovement,
  type StockReportRow,
  type StockSupplyRow,
} from "@/lib/supplyStock";
import { branchLabel } from "@/lib/branches";

type Tab = "balance" | "movements" | "report";
type Action = {
  mode: "receive" | "adjust" | "limits";
  supply: StockSupplyRow;
  cell: StockCell;
};

const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";

const LEVEL_BADGE: Record<StockLevel, { label: string; className: string }> = {
  low: { label: "ต่ำกว่า Min", className: "bg-red-50 text-red-600" },
  over: { label: "เกิน Max", className: "bg-amber-50 text-amber-700" },
  ok: { label: "ปกติ", className: "bg-emerald-50 text-emerald-700" },
};

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";
const errorText = (err: unknown) =>
  err instanceof Error ? err.message : "เกิดข้อผิดพลาด";

function LevelBadge({ level }: { level: StockLevel }) {
  const badge = LEVEL_BADGE[level];
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}

export default function SupplyStockPage() {
  const { can } = useAccess();
  const tabs = useMemo(
    () =>
      [
        { key: "balance" as Tab, label: "คงเหลือ", show: true },
        { key: "movements" as Tab, label: "ประวัติการเคลื่อนไหว", show: true },
        {
          key: "report" as Tab,
          label: "รายงาน",
          show: can("supply_stock.report"),
        },
      ].filter((t) => t.show),
    [can],
  );
  const [tab, setTab] = useState<Tab>("balance");
  const [branches, setBranches] = useState<StockBranch[]>([]);
  const [supplies, setSupplies] = useState<StockSupplyRow[]>([]);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<Action | null>(null);

  const [reload, setReload] = useState(0);

  // State is only set from the request callbacks (never synchronously in the effect body).
  useEffect(() => {
    let cancelled = false;
    getSupplyStock()
      .then((res) => {
        if (cancelled) return;
        setBranches(res.branches);
        setSupplies(res.supplies);
        setBranchId((current) => current ?? res.branches[0]?.id ?? null);
        setError("");
      })
      .catch((err) => !cancelled && setError(errorText(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const rows = supplies
    .map((supply) => ({
      supply,
      cell: supply.stocks.find((c) => c.branch_id === branchId),
    }))
    .filter(
      (r): r is { supply: StockSupplyRow; cell: StockCell } =>
        !!r.cell && (r.supply.status || r.cell.quantity !== 0),
    );
  const lowCount = rows.filter((r) => r.cell.level === "low").length;

  return (
    <div className="relative min-h-[360px]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <PageHeader
          title="Stock วัสดุห่อ"
          description="ยอดคงเหลือแยกตามสาขา — การจอง Shipment ที่เลือก Packing Supplies จะตัด Stock ของสาขานั้นอัตโนมัติ และคืนให้เมื่อ Void"
        />
        {can("config.supplies") && (
          <Link
            href="/config/supplies"
            className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            ข้อมูลวัสดุ
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.key ? "border-brand-navy text-brand-navy" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <PageLoading label="Loading Stock..." />
      ) : branches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
          บัญชีนี้ยังไม่ได้ผูกกับสาขาใด
        </div>
      ) : tab === "balance" ? (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">สาขา</span>
              <select
                value={branchId ?? ""}
                onChange={(e) => setBranchId(Number(e.target.value))}
                className={`${inputClass} w-64`}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {branchLabel(b)}
                  </option>
                ))}
              </select>
            </label>
            {lowCount > 0 && (
              <span className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
                ต่ำกว่า Min {lowCount} รายการ
              </span>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center">
              <Boxes className="h-10 w-10 text-brand-amber" />
              <p className="font-medium text-slate-600">ยังไม่มีวัสดุห่อ</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">วัสดุ</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      คงเหลือ
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium">Min</th>
                    <th className="px-4 py-2.5 text-right font-medium">Max</th>
                    <th className="px-4 py-2.5 font-medium">สถานะ</th>
                    <th className="px-4 py-2.5 text-right font-medium">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ supply, cell }) => (
                    <tr
                      key={supply.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-700">
                          {supply.name}
                        </div>
                        {!supply.status && (
                          <div className="text-xs text-slate-400">
                            ปิดใช้งานแล้ว
                          </div>
                        )}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right text-base font-semibold tabular-nums ${cell.quantity < 0 ? "text-red-600" : "text-slate-800"}`}
                      >
                        {cell.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                        {cell.min_qty ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                        {cell.max_qty ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <LevelBadge level={cell.level} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1.5">
                          {can("supply_stock.receive") && (
                            <button
                              type="button"
                              onClick={() =>
                                setAction({ mode: "receive", supply, cell })
                              }
                              className="flex items-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              <PackagePlus className="h-3.5 w-3.5" />
                              รับเข้า
                            </button>
                          )}
                          {can("supply_stock.adjust") && (
                            <button
                              type="button"
                              onClick={() =>
                                setAction({ mode: "adjust", supply, cell })
                              }
                              className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              ปรับยอด
                            </button>
                          )}
                          {can("supply_stock.settings") && (
                            <button
                              type="button"
                              onClick={() =>
                                setAction({ mode: "limits", supply, cell })
                              }
                              className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" />
                              Min/Max
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : tab === "movements" ? (
        <MovementsTab branches={branches} supplies={supplies} />
      ) : (
        <ReportTab branches={branches} />
      )}

      {action && (
        <StockActionModal
          action={action}
          branch={branches.find((b) => b.id === action.cell.branch_id)}
          onClose={() => setAction(null)}
          onDone={async () => {
            setAction(null);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function StockActionModal({
  action,
  branch,
  onClose,
  onDone,
}: {
  action: Action;
  branch?: StockBranch;
  onClose: () => void;
  onDone: () => void;
}) {
  const { mode, supply, cell } = action;
  const [quantity, setQuantity] = useState(
    mode === "adjust" ? String(cell.quantity) : "",
  );
  const [minQty, setMinQty] = useState(cell.min_qty?.toString() ?? "");
  const [maxQty, setMaxQty] = useState(cell.max_qty?.toString() ?? "");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const base = { supply_id: supply.id, branch_id: cell.branch_id };
  const title = {
    receive: "รับเข้า Stock",
    adjust: "ปรับยอด (นับจริง)",
    limits: "ตั้ง Min / Max",
  }[mode];
  const afterReceive = cell.quantity + (Number(quantity) || 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (mode === "receive")
        await receiveStock({
          ...base,
          quantity: Number(quantity),
          reference: reference || undefined,
          note: note || undefined,
        });
      else if (mode === "adjust")
        await adjustStock({ ...base, counted: Number(quantity), note });
      else
        await setStockLimits({
          ...base,
          min_qty: minQty === "" ? null : Number(minQty),
          max_qty: maxQty === "" ? null : Number(maxQty),
        });
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <div className="font-medium text-slate-800">{supply.name}</div>
          สาขา {branch ? branchLabel(branch) : "-"} · คงเหลือปัจจุบัน{" "}
          <b>{cell.quantity.toLocaleString()}</b>
        </div>

        {mode === "limits" ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">
                Min (แจ้งเตือนเมื่อเหลือเท่านี้หรือน้อยกว่า)
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                placeholder="ไม่ตั้ง"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">
                Max (ยอดที่ควรมีสูงสุด)
              </span>
              <input
                type="number"
                min={0}
                step={1}
                value={maxQty}
                onChange={(e) => setMaxQty(e.target.value)}
                placeholder="ไม่ตั้ง"
                className={inputClass}
              />
            </label>
            <p className="col-span-2 text-xs text-slate-500">
              เมื่อต่ำกว่า Min ระบบจะแจ้งใน System Alerts
              พร้อมจำนวนที่ควรสั่งเพิ่ม (Max − คงเหลือ)
              และปิดแจ้งเตือนให้เองเมื่อรับของเข้าเกิน Min
            </p>
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">
                {mode === "receive" ? "จำนวนที่รับเข้า" : "จำนวนที่นับได้จริง"}
              </span>
              <input
                type="number"
                required
                min={mode === "receive" ? 1 : 0}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputClass}
                autoFocus
              />
              {mode === "receive" && quantity && (
                <span
                  className={`text-xs ${cell.max_qty !== null && afterReceive > cell.max_qty ? "text-amber-700" : "text-slate-500"}`}
                >
                  หลังรับเข้า: {afterReceive.toLocaleString()}
                  {cell.max_qty !== null &&
                    afterReceive > cell.max_qty &&
                    ` (เกิน Max ${cell.max_qty})`}
                </span>
              )}
              {mode === "adjust" &&
                quantity !== "" &&
                Number(quantity) !== cell.quantity && (
                  <span className="text-xs text-slate-500">
                    ส่วนต่าง {Number(quantity) - cell.quantity > 0 ? "+" : ""}
                    {(Number(quantity) - cell.quantity).toLocaleString()}
                  </span>
                )}
            </label>
            {mode === "receive" && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-slate-600">
                  เลขที่เอกสาร (PO / ใบส่งของ)
                </span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={100}
                  className={inputClass}
                />
              </label>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">
                {mode === "adjust" ? "เหตุผล *" : "หมายเหตุ"}
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required={mode === "adjust"}
                maxLength={500}
                placeholder={
                  mode === "adjust"
                    ? "เช่น นับ Stock สิ้นเดือน, ของเสียหาย"
                    : ""
                }
                className={inputClass}
              />
            </label>
          </>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MovementsTab({
  branches,
  supplies,
}: {
  branches: StockBranch[];
  supplies: StockSupplyRow[];
}) {
  const [filters, setFilters] = useState<MovementFilters>({});
  const [applied, setApplied] = useState<MovementFilters>({});
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<StockMovement[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listStockMovements({ ...applied, page })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setLastPage(res.last_page);
        setTotal(res.total);
        setError("");
      })
      .catch((err) => !cancelled && setError(errorText(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [applied, page]);

  const goTo = (next: number) => {
    setLoading(true);
    setPage(next);
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          setPage(1);
          setApplied({ ...filters });
        }}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        {branches.length > 1 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">สาขา</span>
            <select
              value={filters.branch_id ?? ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  branch_id: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className={`${inputClass} w-48`}
            >
              <option value="">ทุกสาขา</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {branchLabel(b)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">วัสดุ</span>
          <select
            value={filters.supply_id ?? ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                supply_id: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            className={`${inputClass} w-48`}
          >
            <option value="">ทั้งหมด</option>
            {supplies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ประเภท</span>
          <select
            value={filters.type ?? ""}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className={`${inputClass} w-40`}
          >
            <option value="">ทั้งหมด</option>
            {Object.entries(MOVEMENT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ตั้งแต่</span>
          <input
            type="date"
            value={filters.date_from ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, date_from: e.target.value })
            }
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ถึง</span>
          <input
            type="date"
            value={filters.date_to ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, date_to: e.target.value })
            }
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Search className="h-4 w-4" />
          ค้นหา
        </button>
      </form>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {loading && rows.length === 0 ? (
        <PageLoading label="Loading..." />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
          ยังไม่มีการเคลื่อนไหว
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
              <tr>
                <th className="px-4 py-2.5 font-medium">เวลา</th>
                <th className="px-4 py-2.5 font-medium">สาขา</th>
                <th className="px-4 py-2.5 font-medium">วัสดุ</th>
                <th className="px-4 py-2.5 font-medium">ประเภท</th>
                <th className="px-4 py-2.5 text-right font-medium">จำนวน</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  คงเหลือหลังรายการ
                </th>
                <th className="px-4 py-2.5 font-medium">อ้างอิง / หมายเหตุ</th>
                <th className="px-4 py-2.5 font-medium">ผู้ทำรายการ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-slate-100 align-top last:border-0"
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                    {new Date(m.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {m.branch ? branchLabel(m.branch) : "—"}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {m.supply?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {MOVEMENT_LABEL[m.type] ?? m.type}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-semibold tabular-nums ${m.quantity < 0 ? "text-red-600" : "text-emerald-700"}`}
                  >
                    {m.quantity > 0 ? "+" : ""}
                    {m.quantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                    {m.balance_after.toLocaleString()}
                  </td>
                  <td className="max-w-xs px-4 py-2.5 text-slate-600">
                    {m.shipment ? (
                      <Link
                        href={`/shipment/view/${m.shipment.id}`}
                        className="text-brand-navy hover:underline"
                      >
                        {m.shipment.tracking_number ?? `#${m.shipment.id}`}
                      </Link>
                    ) : (
                      m.reference
                    )}
                    {m.note && (
                      <div className="text-xs text-slate-400">{m.note}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {m.user?.name ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>ทั้งหมด {total.toLocaleString()} รายการ</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goTo(page - 1)}
                className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
              >
                ก่อนหน้า
              </button>
              <span>
                {page} / {lastPage}
              </span>
              <button
                type="button"
                disabled={page >= lastPage}
                onClick={() => goTo(page + 1)}
                className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ReportTab({ branches }: { branches: StockBranch[] }) {
  const { can } = useAccess();
  const [filters, setFilters] = useState({
    date_from: monthStart(),
    date_to: today(),
    branch_id: undefined as number | undefined,
  });
  const [applied, setApplied] = useState(filters);
  const [rows, setRows] = useState<StockReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getStockReport(applied)
      .then((res) => {
        if (cancelled) return;
        setRows(res.rows);
        setError("");
      })
      .catch((err) => !cancelled && setError(errorText(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [applied]);

  const totals = rows.reduce(
    (t, r) => ({
      opening: t.opening + r.opening,
      received: t.received + r.received,
      used: t.used + r.used,
      returned: t.returned + r.returned,
      adjusted: t.adjusted + r.adjusted,
      closing: t.closing + r.closing,
    }),
    { opening: 0, received: 0, used: 0, returned: 0, adjusted: 0, closing: 0 },
  );
  const num = (n: number) => n.toLocaleString();

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          setApplied({ ...filters });
        }}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        {branches.length > 1 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">สาขา</span>
            <select
              value={filters.branch_id ?? ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  branch_id: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                })
              }
              className={`${inputClass} w-48`}
            >
              <option value="">ทุกสาขา</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {branchLabel(b)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ตั้งแต่</span>
          <input
            type="date"
            required
            value={filters.date_from}
            onChange={(e) =>
              setFilters({ ...filters, date_from: e.target.value })
            }
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-600">ถึง</span>
          <input
            type="date"
            required
            value={filters.date_to}
            onChange={(e) =>
              setFilters({ ...filters, date_to: e.target.value })
            }
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <Search className="h-4 w-4" />
          ดูรายงาน
        </button>
        {can("supply_stock.export") && (
          <button
            type="button"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await downloadStockReport(applied);
              } catch (err) {
                setError(errorText(err));
              } finally {
                setExporting(false);
              }
            }}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>
        )}
      </form>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {loading && rows.length === 0 ? (
        <PageLoading label="Loading report..." />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-500">
          ไม่มีข้อมูลในช่วงนี้
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
              <tr>
                <th className="px-4 py-2.5 font-medium">สาขา</th>
                <th className="px-4 py-2.5 font-medium">วัสดุ</th>
                <th className="px-4 py-2.5 text-right font-medium">ยกมา</th>
                <th className="px-4 py-2.5 text-right font-medium">รับเข้า</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  ใช้กับ Shipment
                </th>
                <th className="px-4 py-2.5 text-right font-medium">
                  คืนจาก Void
                </th>
                <th className="px-4 py-2.5 text-right font-medium">ปรับยอด</th>
                <th className="px-4 py-2.5 text-right font-medium">คงเหลือ</th>
                <th className="px-4 py-2.5 font-medium">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.branch_id}-${r.supply_id}`}
                  className="border-b border-slate-100 tabular-nums"
                >
                  <td className="px-4 py-2.5 text-slate-600">
                    {r.branch_name}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {r.supply_name}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">
                    {num(r.opening)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-emerald-700">
                    {num(r.received)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-red-600">
                    {num(-r.used)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">
                    {num(r.returned)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600">
                    {num(r.adjusted)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-800">
                    {num(r.closing)}
                  </td>
                  <td className="px-4 py-2.5">
                    <LevelBadge level={r.level} />
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold tabular-nums text-slate-700">
                <td className="px-4 py-2.5" colSpan={2}>
                  รวม
                </td>
                <td className="px-4 py-2.5 text-right">
                  {num(totals.opening)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {num(totals.received)}
                </td>
                <td className="px-4 py-2.5 text-right">{num(-totals.used)}</td>
                <td className="px-4 py-2.5 text-right">
                  {num(totals.returned)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {num(totals.adjusted)}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {num(totals.closing)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
