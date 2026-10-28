"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Printer, XCircle } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import BranchSelect from "@/components/shipment/BranchSelect";
import { useAccess } from "@/components/auth/AccessProvider";
import { branchLabel, listBranches, type Branch } from "@/lib/branches";
import { listSupplySales, openSupplySalePdf, voidSupplySale, type SupplySale } from "@/lib/supplySales";

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inputClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";
const today = () => new Date().toLocaleDateString("sv-SE");

/** Every over-the-counter box / supply sale — its own list, apart from Receipts & Tax Invoices. */
export default function SupplySalesPage() {
  const { can, canVisit } = useAccess();
  const canPrint = can("supply_sale.print");
  const canVoid = can("supply_sale.void");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [sales, setSales] = useState<SupplySale[]>([]);
  const [issuedTotal, setIssuedTotal] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    listSupplySales({ page, search: search.trim() || undefined, date_from: dateFrom, date_to: dateTo, branch_id: branchId ?? undefined, status: status || undefined })
      .then((res) => {
        setSales(res.data);
        setLastPage(res.last_page);
        setCount(res.total);
        setIssuedTotal(Number(res.issued_total) || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, search, dateFrom, dateTo, branchId, status]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    listBranches()
      .then((rows) => setBranches(rows.filter((b) => b.status)))
      .catch(() => {});
  }, []);

  // Any filter change starts again from page 1.
  function filtered<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  async function handleVoid(sale: SupplySale) {
    const note = window.prompt(`Void ${sale.sale_no}? Stock จะถูกคืนให้สาขา\nเหตุผล (ไม่บังคับ):`);
    if (note === null) return;
    try {
      await voidSupplySale(sale.id, note);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Void ไม่สำเร็จ");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="รายการขายกล่อง / ซัพพลาย" description="ใบเสร็จ 80 mm ที่ขายหน้าร้าน (แยกจาก Receipts & Tax Invoices)" />
        {can("supply_sale.create") && canVisit("/supply-sales/new") && (
          <Link
            href="/supply-sales/new"
            className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
          >
            <Plus className="h-4 w-4" /> ขายสินค้า
          </Link>
        )}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">ค้นหา</span>
            <input value={search} onChange={(e) => filtered(setSearch)(e.target.value)} placeholder="เลขที่ / ชื่อ / เบอร์ลูกค้า..." className={`${inputClass} w-56`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">ตั้งแต่</span>
            <input type="date" value={dateFrom} onChange={(e) => filtered(setDateFrom)(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">ถึง</span>
            <input type="date" value={dateTo} onChange={(e) => filtered(setDateTo)(e.target.value)} className={inputClass} />
          </label>
          {branches.length > 1 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">สาขา</span>
              <BranchSelect branches={branches} value={branchId} onChange={filtered(setBranchId)} className="w-56" />
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">สถานะ</span>
            <select value={status} onChange={(e) => filtered(setStatus)(e.target.value)} className={inputClass}>
              <option value="">ทั้งหมด</option>
              <option value="ISSUED">ขายแล้ว</option>
              <option value="VOIDED">VOID</option>
            </select>
          </label>
          <div className="ml-auto text-right">
            <p className="text-xs text-slate-500">{count} รายการ · ยอดขาย (ไม่รวม VOID)</p>
            <p className="text-xl font-bold text-black">{money(issuedTotal)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-2 py-2 font-medium">เลขที่</th>
                <th className="px-2 py-2 font-medium">วันที่</th>
                <th className="px-2 py-2 font-medium">สาขา</th>
                <th className="px-2 py-2 font-medium">รายการ</th>
                <th className="px-2 py-2 font-medium">ลูกค้า</th>
                <th className="px-2 py-2 font-medium">ชำระโดย</th>
                <th className="px-2 py-2 font-medium">พนักงาน</th>
                <th className="px-2 py-2 text-right font-medium">ยอด</th>
                <th className="px-2 py-2 font-medium">สถานะ</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.map((sale) => (
                <tr key={sale.id} className={sale.status === "VOIDED" ? "text-slate-400" : "text-slate-700"}>
                  <td className="px-2 py-2 font-mono text-xs">{sale.sale_no}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs">{new Date(sale.sold_at).toLocaleString()}</td>
                  <td className="px-2 py-2 text-xs">{sale.branch ? branchLabel(sale.branch) : "-"}</td>
                  <td className="px-2 py-2 text-xs">{sale.lines.map((l) => `${l.name} ×${l.quantity}`).join(", ")}</td>
                  <td className="px-2 py-2 text-xs">{sale.customer_name ?? "-"}</td>
                  <td className="px-2 py-2 text-xs">{sale.payment_method ?? "-"}</td>
                  <td className="px-2 py-2 text-xs">{sale.created_by?.name ?? "-"}</td>
                  <td className="px-2 py-2 text-right font-semibold">{money(Number(sale.total))}</td>
                  <td className="px-2 py-2 text-xs">
                    {sale.status === "VOIDED" ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600" title={sale.void_note ?? undefined}>
                        VOID
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">ขายแล้ว</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    {canPrint && (
                      <button type="button" onClick={() => openSupplySalePdf(sale.id)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="พิมพ์ใบเสร็จ 80 mm">
                        <Printer className="h-4 w-4" />
                      </button>
                    )}
                    {canVoid && sale.status !== "VOIDED" && (
                      <button type="button" onClick={() => handleVoid(sale)} className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Void (คืน Stock)">
                        <XCircle className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && sales.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-2 py-6 text-center text-sm text-slate-400">
                    ไม่มีรายการขายในช่วงนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {lastPage > 1 && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
              ก่อนหน้า
            </button>
            <span className="text-slate-500">
              {page} / {lastPage}
            </span>
            <button type="button" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40">
              ถัดไป
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
