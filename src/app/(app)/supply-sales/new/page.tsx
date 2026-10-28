"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Plus, Printer, Trash2 } from "lucide-react";
import BranchSelect from "@/components/shipment/BranchSelect";
import { useAccess } from "@/components/auth/AccessProvider";
import { getUser } from "@/lib/auth";
import { listBranches, type Branch } from "@/lib/branches";
import { searchCustomerAddresses, type CustomerAddressWithCustomer } from "@/lib/customers";
import { listManifestOptions, type ManifestOption } from "@/lib/manifestOptions";
import { listSupplies, supplyTypeLabel, type Supply } from "@/lib/supplies";
import { createSupplySale, openSupplySalePdf, type SupplySale } from "@/lib/supplySales";

// `supply` null = an item typed in by hand (e.g. tape) — sold by name, no stock.
type CartLine = { key: number; supply: Supply | null; name: string; quantity: number; unitPrice: number };

let lineKeySeq = 1;
const emptyLine = (): CartLine => ({ key: lineKeySeq++, supply: null, name: "", quantity: 1, unitPrice: 0 });

// Same look as Issue Receipt / Tax Invoice (/billing/receipts/new).
const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm leading-tight outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";
const underlineClass =
  "w-full border-0 border-b border-dashed border-slate-300 bg-transparent px-0.5 py-0.5 text-sm leading-tight outline-none focus:border-brand-navy";
const labelClass = "text-xs font-medium uppercase tracking-wide text-slate-400";

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatCustomerAddress = (a: CustomerAddressWithCustomer) =>
  [a.address1, a.address2, a.address3, a.city, a.state_code, a.postcode, a.country && a.country !== "TH" ? a.country : null].filter(Boolean).join(" ");

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/**
 * Sell boxes / Packing Supplies over the counter, with no shipment — its own 80 mm thermal receipt
 * (not a Cash Receipt / Tax Invoice). A sale deducts the selling branch's stock right away.
 */
export default function NewSupplySalePage() {
  const { can, canVisit, access } = useAccess();
  const canPrint = can("supply_sale.print") && can("supply_sale.view");

  const [user] = useState(() => getUser());
  const [allBranches, setAllBranches] = useState<Branch[] | null>(null);
  // Users who sell for any branch (incl. Administrator) pick from the full list.
  const sellsAnyBranch = !!user?.can_access_all_branches || !!access.is_super_admin;
  const branchOptions = useMemo(
    () => (sellsAnyBranch ? (allBranches ?? []) : ((user?.branches ?? []) as Branch[])),
    [sellsAnyBranch, user, allBranches],
  );
  const [chosenBranchId, setBranchId] = useState<number | null>(user?.home_branch?.id ?? user?.branches?.[0]?.id ?? null);
  // A single selectable branch needs no choice.
  const branchId = chosenBranchId ?? (branchOptions.length === 1 ? branchOptions[0].id : null);

  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [paymentOptions, setPaymentOptions] = useState<ManifestOption[]>([]);
  const [cart, setCart] = useState<CartLine[]>(() => [emptyLine()]);
  // Which line's product dropdown is open (its description input has focus).
  const [openLineKey, setOpenLineKey] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  // Matches from /customer (saved customers' addresses) while typing in the search box.
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerAddressWithCustomer[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lastSale, setLastSale] = useState<SupplySale | null>(null);

  const loadSupplies = useCallback(() => {
    listSupplies()
      .then((rows) => setSupplies(rows.filter((s) => s.status)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSupplies();
    listBranches()
      .then((rows) => setAllBranches(rows.filter((b) => b.status)))
      .catch(() => setAllBranches([]));
    listManifestOptions("payment_option")
      .then((all) => {
        const active = all.filter((o) => o.status);
        setPaymentOptions(active);
        setPaymentMethod((current) => current || active[0]?.name || "");
      })
      .catch(() => {});
  }, [loadSupplies]);

  useEffect(() => {
    if (customerQuery.trim().length < 2) return;
    const t = setTimeout(() => {
      searchCustomerAddresses(customerQuery.trim())
        .then(setCustomerResults)
        .catch(() => setCustomerResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [customerQuery]);

  function pickCustomer(a: CustomerAddressWithCustomer) {
    setCustomerName(a.company_name || a.contact_name || a.customer?.name || "");
    setCustomerAddress(formatCustomerAddress(a));
    setCustomerPhone(a.phone ?? "");
    setCustomerQuery("");
    setCustomerDropdownOpen(false);
  }

  // On hand at the selling branch (no stock row = 0) …
  const onHand = (supply: Supply) => supply.stocks?.find((s) => s.branch_id === branchId)?.quantity ?? 0;
  // … minus every line already selling it (optionally leaving one line out).
  function stockLeft(supply: Supply, exceptKey?: number): number {
    const inCart = cart.filter((l) => l.supply?.id === supply.id && l.key !== exceptKey).reduce((sum, l) => sum + l.quantity, 0);
    return onHand(supply) - inCart;
  }

  // Products matching what's typed in a line — in-stock first, then by name.
  function matchesFor(query: string): Supply[] {
    const q = query.trim().toLowerCase();
    return supplies
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .sort((a, b) => Number(onHand(b) > 0) - Number(onHand(a) > 0) || a.name.localeCompare(b.name));
  }

  function updateLine(key: number, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  // Out of stock: still listed and searchable, just can't be picked — for everyone.
  function pickSupply(line: CartLine, supply: Supply) {
    if (!branchId || stockLeft(supply, line.key) <= 0) return;
    updateLine(line.key, { supply, name: supply.name, unitPrice: Number(supply.sale_price) || 0, quantity: 1 });
    setOpenLineKey(null);
  }

  const filledLines = cart.filter((l) => l.supply || l.name.trim());
  const total = filledLines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const overStock = cart.find((l) => l.supply && stockLeft(l.supply) < 0);

  const disabledReason = !branchId
    ? "เลือกสาขาที่ขาย"
    : filledLines.length === 0
      ? "เพิ่มสินค้าอย่างน้อย 1 รายการ"
      : overStock
        ? `"${overStock.name}" เกิน Stock ที่มี`
        : null;

  async function handleSell() {
    if (!branchId || disabledReason) return;
    setSubmitting(true);
    setError("");
    try {
      const sale = await createSupplySale({
        branch_id: branchId,
        customer_name: customerName.trim() || null,
        customer_address: customerAddress.trim() || null,
        customer_phone: customerPhone.trim() || null,
        payment_method: paymentMethod || null,
        lines: filledLines.map((l) =>
          l.supply ? { supply_id: l.supply.id, quantity: l.quantity, unit_price: l.unitPrice } : { name: l.name.trim(), quantity: l.quantity, unit_price: l.unitPrice },
        ),
      });
      setCart([emptyLine()]);
      setCustomerName("");
      setCustomerAddress("");
      setCustomerPhone("");
      setLastSale(sale);
      loadSupplies();
      if (canPrint) void openSupplySalePdf(sale.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ขายไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
      {canVisit("/supply-sales") && (
        <Link href="/supply-sales" className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> รายการขาย
        </Link>
      )}

      {lastSale && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            ขายแล้ว <span className="font-mono">{lastSale.sale_no}</span> · {money(Number(lastSale.total))} — ตัด Stock เรียบร้อย
          </span>
          {canPrint && (
            <button
              type="button"
              onClick={() => openSupplySalePdf(lastSale.id)}
              className="flex items-center gap-1.5 rounded-lg bg-brand-navy-dark px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy-dark/90"
            >
              <Printer className="h-3.5 w-3.5" /> พิมพ์ใบเสร็จอีกครั้ง
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-4 lg:order-2">
          <h1 className="mb-2 text-base font-bold text-slate-900">
            New <span className="text-brand-navy-dark">ใบเสร็จขายกล่อง / ซัพพลาย</span>
          </h1>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelClass}>Receipt</p>
              <p className="mt-1 text-sm text-slate-700">80 mm</p>
            </div>
            <div className="text-right">
              <p className={labelClass}>Document Date</p>
              <p className="mt-1 text-sm text-slate-700">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
          {!user?.home_branch && branchOptions.length !== 1 && (
            <label className="mt-2 flex flex-col gap-1">
              <span className={`${labelClass} ${branchId ? "" : "text-red-500"}`}>Branch{!branchId && " — เลือกก่อนเพิ่มสินค้า"}</span>
              {sellsAnyBranch && allBranches === null && <span className="text-xs text-slate-400">กำลังโหลดสาขา...</span>}
              <BranchSelect
                branches={branchOptions}
                value={branchId}
                onChange={(id) => {
                  setBranchId(id);
                  setCart([emptyLine()]);
                }}
                className="w-full"
              />
            </label>
          )}
          <label className="mt-2 flex flex-col gap-1">
            <span className={labelClass}>Payment Method</span>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={fieldClass}>
              <option value="">—</option>
              {paymentOptions.map((o) => (
                <option key={o.id} value={o.name}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-slate-400">Sale No. assigned on submit · ตัด Stock ของสาขาที่ขาย</p>

          <div className="mt-3 border-t border-slate-200 pt-3">
            <div className="flex items-baseline justify-between">
              <span className={labelClass}>Grand Total</span>
              <span className="text-2xl font-bold tabular-nums text-black">{money(total)}</span>
            </div>
            <p className="text-right text-[11px] text-slate-400">{filledLines.reduce((sum, l) => sum + l.quantity, 0)} ชิ้น · ราคารวม VAT แล้ว</p>
            <button
              type="button"
              onClick={handleSell}
              disabled={!!disabledReason || submitting}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-amber px-4 py-3 text-base font-bold text-brand-navy-dark shadow-sm transition hover:bg-brand-amber/90 hover:shadow active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
              {submitting ? "กำลังบันทึก..." : "ขาย + พิมพ์ใบเสร็จ"}
            </button>
            {disabledReason && !submitting && <p className="mt-1.5 text-center text-xs text-red-500">{disabledReason}</p>}
            {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-3 lg:order-1">
          <Card title="Customer">
            <div className="relative mb-2">
              <input
                type="text"
                value={customerQuery}
                onFocus={() => setCustomerDropdownOpen(true)}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  setCustomerDropdownOpen(true);
                }}
                onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
                placeholder="Search customers (/customer)..."
                className={fieldClass}
              />
              {customerDropdownOpen && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {customerQuery.trim().length >= 2 && customerResults.length > 0 ? (
                    customerResults.map((a) => (
                      <button
                        type="button"
                        key={a.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickCustomer(a)}
                        className="flex w-full flex-col items-start border-b border-slate-50 px-3 py-2 text-left text-xs last:border-0 hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-700">{a.company_name || a.contact_name || a.customer?.name}</span>
                        <span className="text-slate-400">{[formatCustomerAddress(a), a.phone].filter(Boolean).join(" · ")}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-3 text-center text-xs text-slate-400">{customerQuery.trim().length < 2 ? "Type to search..." : "No matches"}</p>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Customer Name</span>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="ไม่บังคับ" className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Phone</span>
                <input type="text" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className={labelClass}>Address</span>
                <textarea value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} rows={2} className={`${fieldClass} resize-y`} />
              </label>
            </div>
          </Card>

          <Card
            title="Line Items"
            right={
              <button
                type="button"
                onClick={() => {
                  const line = emptyLine();
                  setCart((prev) => [...prev, line]);
                  setOpenLineKey(line.key);
                }}
                className="flex items-center gap-1 text-xs font-semibold text-brand-navy-dark hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add Line
              </button>
            }
          >
            <div className="rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-brand-navy-dark text-xs uppercase text-white/90">
                  <tr>
                    <th className="rounded-tl-lg px-3 py-2 font-medium">Description</th>
                    <th className="w-24 px-3 py-2 text-center font-medium">Qty</th>
                    <th className="w-32 px-3 py-2 text-right font-medium">Unit Price</th>
                    <th className="w-32 px-3 py-2 text-right font-medium">Amount</th>
                    <th className="w-10 rounded-tr-lg px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((line) => {
                    const matches = openLineKey === line.key ? matchesFor(line.supply ? "" : line.name) : [];
                    return (
                      <tr key={line.key} className="border-t border-slate-100 align-top">
                        <td className="px-3 py-1.5">
                          <div className="relative">
                            <input
                              type="text"
                              value={line.name}
                              onFocus={() => setOpenLineKey(line.key)}
                              onBlur={() => setTimeout(() => setOpenLineKey((k) => (k === line.key ? null : k)), 150)}
                              // Typing over a picked product turns the line back into a typed-in item.
                              onChange={(e) => updateLine(line.key, { name: e.target.value, supply: null })}
                              placeholder="พิมพ์ค้นหาสินค้า หรือพิมพ์ชื่อเอง เช่น เทป"
                              className={underlineClass}
                              autoFocus={openLineKey === line.key && !line.name}
                            />
                            {openLineKey === line.key && (
                              <div className="absolute z-20 mt-1 max-h-64 w-full min-w-[280px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                                {matches.map((supply) => {
                                  const left = stockLeft(supply, line.key);
                                  const disabled = !branchId || left <= 0;
                                  return (
                                    <button
                                      type="button"
                                      key={supply.id}
                                      disabled={disabled}
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => pickSupply(line, supply)}
                                      title={!branchId ? "เลือกสาขาที่ขายก่อน" : disabled ? "Stock หมดที่สาขานี้" : undefined}
                                      className="flex w-full items-center gap-2 border-b border-slate-50 px-3 py-1.5 text-left text-xs last:border-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
                                    >
                                      <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium">{supply.name}</span>
                                        <span className="text-[10px] text-slate-400">{supplyTypeLabel(supply.type)}</span>
                                      </span>
                                      <span className="shrink-0 tabular-nums">{money(Number(supply.sale_price))}</span>
                                      <span className={`w-20 shrink-0 text-right text-[10px] font-medium ${!branchId ? "text-slate-400" : left <= 0 ? "text-red-500" : "text-emerald-600"}`}>
                                        {!branchId ? "เลือกสาขา" : left <= 0 ? `Stock หมด (${left})` : `คงเหลือ ${left}`}
                                      </span>
                                    </button>
                                  );
                                })}
                                {matches.length === 0 && (
                                  <p className="px-3 py-2 text-xs text-slate-400">
                                    ไม่พบสินค้าในระบบ — ขายเป็นรายการพิมพ์เอง &quot;{line.name.trim()}&quot; ได้ (ไม่ตัด Stock)
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          {line.supply ? (
                            stockLeft(line.supply) < 0 ? (
                              <p className="text-[10px] text-red-500">เกิน Stock ที่มี</p>
                            ) : (
                              <p className="text-[10px] text-emerald-600">จาก Stock · คงเหลือหลังขาย {stockLeft(line.supply)}</p>
                            )
                          ) : (
                            line.name.trim() && <p className="text-[10px] text-slate-400">พิมพ์เอง · ไม่ตัด Stock</p>
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) => updateLine(line.key, { quantity: Math.max(1, Math.floor(Number(e.target.value)) || 1) })}
                            className={`${underlineClass} text-center`}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.unitPrice}
                            onChange={(e) => updateLine(line.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                            className={`${underlineClass} text-right`}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-black">{money(line.quantity * line.unitPrice)}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => setCart((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== line.key) : [emptyLine()]))}
                            className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                            aria-label="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex justify-end">
              <div className="w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Items</span>
                  <span>{filledLines.reduce((sum, l) => sum + l.quantity, 0)} ชิ้น</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold text-slate-800">
                  <span>Grand Total</span>
                  <span className="text-black">{money(total)}</span>
                </div>
                <p className="text-right text-xs text-slate-400">ราคารวมภาษีมูลค่าเพิ่มแล้ว</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

    </div>
  );
}
