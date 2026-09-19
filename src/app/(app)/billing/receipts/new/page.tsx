"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import PageLoading from "@/components/ui/PageLoading";
import CarrierBadge from "@/components/ui/CarrierBadge";
import { listShipments, getShipment, type Shipment } from "@/lib/shipments";
import {
  listBillingCustomers,
  formatBillingCustomerAddress,
  type BillingCustomer,
} from "@/lib/billingCustomers";
import {
  previewReceiptLines,
  createReceipt,
  openReceiptPdf,
  type ReceiptType,
  type ReceiptLineInput,
} from "@/lib/receipts";

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm leading-tight outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";
const underlineClass =
  "w-full border-0 border-b border-dashed border-slate-300 bg-transparent px-0.5 py-0.5 text-sm leading-tight outline-none focus:border-brand-navy";
const labelClass = "text-xs font-medium uppercase tracking-wide text-slate-400";

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function IssueReceiptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialShipmentIds = useMemo(
    () =>
      (searchParams.get("shipment_ids") ?? "")
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0),
    [searchParams],
  );

  const [docType, setDocType] = useState<ReceiptType>("CASH_RECEIPT");

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [lines, setLines] = useState<ReceiptLineInput[]>([]);
  // Set right before collapsing lines via the "Merge into one line" toggle, so pressing it again
  // restores the itemized breakdown instead of losing it. Cleared whenever the shipment set
  // changes (the itemized data would be stale).
  const [preMergeLines, setPreMergeLines] = useState<ReceiptLineInput[] | null>(null);
  const [targetTotal, setTargetTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Add-more-shipments picker — this page works standalone (browse & pick unbilled shipments
  // right here) as well as pre-filled from /shipment/list's own selection (?shipment_ids=).
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<Shipment[]>([]);

  const [buyerName, setBuyerName] = useState("");
  const [buyerTaxId, setBuyerTaxId] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerIsHeadOffice, setBuyerIsHeadOffice] = useState(true);
  const [buyerBranchNo, setBuyerBranchNo] = useState("");
  const [billingCustomerId, setBillingCustomerId] = useState<number | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<BillingCustomer[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successReceiptId, setSuccessReceiptId] = useState<number | null>(null);

  // Fetches shipment summaries + re-runs the suggested-lines grouping for the given id set —
  // used both for the initial load and whenever shipments are added/removed via the picker below
  // (line items are re-suggested from scratch since the underlying charges changed).
  async function refreshShipments(ids: number[]) {
    if (ids.length === 0) {
      setShipments([]);
      setLines([]);
      setTargetTotal(null);
      return;
    }
    const [shipmentDetails, preview] = await Promise.all([
      Promise.all(ids.map((id) => getShipment(id))),
      previewReceiptLines(ids),
    ]);
    setShipments(shipmentDetails);
    setLines(preview.lines.map((l) => ({ description: l.description, is_non_vat: l.is_non_vat, amount: l.amount })));
    setPreMergeLines(null);
    setTargetTotal(preview.target_total);
    if (docType === "CASH_RECEIPT") {
      setBuyerName(preview.cash_receipt_buyer_suggestion.name.toUpperCase());
      setBuyerTaxId(preview.cash_receipt_buyer_suggestion.tax_id ?? "");
      setBuyerAddress(preview.cash_receipt_buyer_suggestion.address.toUpperCase());
    }
  }

  useEffect(() => {
    setLoading(true);
    setLoadError("");
    refreshShipments(initialShipmentIds)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load selected shipments"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (docType !== "TAX_INVOICE" || customerQuery.trim().length < 2) {
      setCustomerResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      listBillingCustomers({ q: customerQuery }).then((res) => setCustomerResults(res.data));
    }, 250);
    return () => clearTimeout(timeout);
  }, [customerQuery, docType]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      listShipments({ unbilled: true, status: "booked", search: pickerQuery || undefined }).then((res) =>
        setPickerResults(res.data.filter((s) => !shipments.some((sel) => sel.id === s.id))),
      );
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickerQuery, shipments]);

  async function addShipment(id: number) {
    setRefreshError("");
    setRefreshing(true);
    const previousIds = shipments.map((s) => s.id);
    try {
      await refreshShipments([...previousIds, id]);
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "Failed to add shipment");
      await refreshShipments(previousIds);
    } finally {
      setRefreshing(false);
    }
  }

  async function removeShipment(id: number) {
    setRefreshError("");
    setRefreshing(true);
    try {
      await refreshShipments(shipments.map((s) => s.id).filter((sid) => sid !== id));
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "Failed to remove shipment");
    } finally {
      setRefreshing(false);
    }
  }

  function selectBillingCustomer(c: BillingCustomer) {
    setBillingCustomerId(c.id);
    setBuyerName(c.name.toUpperCase());
    setBuyerTaxId(c.tax_id ?? "");
    setBuyerAddress(formatBillingCustomerAddress(c).toUpperCase());
    setBuyerIsHeadOffice(c.is_head_office);
    setBuyerBranchNo(c.branch_no ?? "");
    setCustomerQuery(c.name);
    setCustomerDropdownOpen(false);
  }

  function mergeIntoOneLine() {
    // Toggle: merge collapses the current itemized lines into one, remembering them; pressing
    // again while merged restores exactly what was there before instead of just re-suggesting.
    if (preMergeLines) {
      setLines(preMergeLines);
      setPreMergeLines(null);
      return;
    }
    const total = lines.reduce((sum, l) => sum + Number(l.amount || 0), 0);
    setPreMergeLines(lines);
    setLines([{ description: "FREIGHT SERVICE", is_non_vat: false, amount: Math.round(total * 100) / 100 }]);
  }

  function addLine() {
    setLines((prev) => [...prev, { description: "", is_non_vat: false, amount: 0 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, patch: Partial<ReceiptLineInput>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  const linesTotal = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0), [lines]);
  // Shipment sell prices are already VAT-INCLUSIVE — VAT is only ever EXTRACTED from the
  // vat-marked lines for the Tax Invoice's legal breakdown, never added on top, so Grand Total
  // always equals exactly what was entered (matches the shipment's sell price with no markup).
  const vatInclusiveAmount = useMemo(
    () => (docType === "TAX_INVOICE" ? lines.filter((l) => !l.is_non_vat).reduce((s, l) => s + (Number(l.amount) || 0), 0) : 0),
    [lines, docType],
  );
  const subtotalNonVat = docType === "TAX_INVOICE" ? linesTotal - vatInclusiveAmount : 0;
  const subtotalVat = docType === "TAX_INVOICE" ? Math.round((vatInclusiveAmount / 1.07) * 100) / 100 : 0;
  const vatAmount = docType === "TAX_INVOICE" ? Math.round((vatInclusiveAmount - subtotalVat) * 100) / 100 : 0;
  const grandTotal = docType === "TAX_INVOICE" ? Math.round((subtotalNonVat + subtotalVat + vatAmount) * 100) / 100 : linesTotal;

  const totalsMatch = targetTotal != null && Math.abs(linesTotal - targetTotal) <= 0.01;
  // Matches the backend's actual rules (ReceiptController::store) — billing_customer_id is only
  // ever an optional convenience link, buyer_name/tax_id/address are always free text either way,
  // so picking an existing Tax Invoice customer from the search box must NOT be required to submit.
  const canSubmit = shipments.length > 0 && lines.length > 0 && totalsMatch && buyerName.trim().length > 0;
  const disabledReason =
    shipments.length === 0
      ? "Add at least one shipment"
      : lines.length === 0
        ? "Add at least one line item"
        : !totalsMatch
          ? "Line total must match the sell price total"
          : buyerName.trim().length === 0
            ? "Enter a buyer name"
            : null;

  // Tax Invoice = yellow, Cash Receipt = dark gray — lets staff tell the two apart at a glance.
  const isTaxInvoice = docType === "TAX_INVOICE";
  const accentSolid = isTaxInvoice
    ? "bg-brand-amber text-slate-900 hover:bg-brand-amber/90"
    : "bg-brand-navy-dark text-white hover:bg-brand-navy-dark/90";
  const accentTableHead = isTaxInvoice ? "bg-brand-amber text-slate-900" : "bg-brand-navy-dark text-white/90";
  const accentText = isTaxInvoice ? "text-brand-amber" : "text-brand-navy-dark";

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");
    try {
      const receipt = await createReceipt({
        type: docType,
        shipment_ids: shipments.map((s) => s.id),
        billing_customer_id: docType === "TAX_INVOICE" ? billingCustomerId : null,
        buyer_name: buyerName,
        buyer_tax_id: buyerTaxId || null,
        buyer_address: buyerAddress || null,
        buyer_is_head_office: buyerIsHeadOffice,
        buyer_branch_no: buyerBranchNo || null,
        lines,
        vat_rate: 7,
      });
      setSuccessReceiptId(receipt.id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to issue document");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <PageLoading label="Loading selected shipments..." />;

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-700">{loadError}</p>
        <Link
          href="/shipment/list"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Shipments
        </Link>
      </div>
    );
  }

  if (successReceiptId) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
        <p className="mb-4 text-sm font-semibold text-emerald-700">
          {docType === "TAX_INVOICE" ? "Tax Invoice" : "Cash Receipt"} issued successfully (#{successReceiptId})
        </p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() => openReceiptPdf(successReceiptId)}
            className="rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
          >
            Open PDF
          </button>
          <button
            type="button"
            onClick={() => router.push("/billing/receipts")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Go to Receipts List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3">
      <Link href="/shipment/list" className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to My Shipments
      </Link>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="flex flex-col gap-3 lg:order-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-slate-900">
                New <span className={accentText}>{docType === "TAX_INVOICE" ? "Tax Invoice" : "Cash Receipt"}</span>
              </h1>
              <div className="flex gap-2">
                {(["CASH_RECEIPT", "TAX_INVOICE"] as ReceiptType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setDocType(t);
                      setBillingCustomerId(null);
                    }}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                      docType === t
                        ? t === "TAX_INVOICE"
                          ? "bg-brand-amber text-slate-900"
                          : "bg-brand-navy-dark text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {t === "CASH_RECEIPT" ? "Cash Receipt" : "Tax Invoice"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={labelClass}>Sell Price Total</p>
                <p className="mt-1 text-sm text-slate-700">{targetTotal != null ? money(targetTotal) : "-"}</p>
              </div>
              <div className="text-right">
                <p className={labelClass}>Document Date</p>
                <p className="mt-1 text-sm text-slate-700">{new Date().toLocaleDateString()}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">Vol.No / No. assigned on submit</p>
          </section>

          <Card title="Shipments">
            {refreshError && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{refreshError}</p>}
            {shipments.length === 0 ? (
              <p className="mb-2 text-sm text-slate-400">No shipments selected yet — search below to add one.</p>
            ) : (
              <ul className="mb-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {shipments.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <span className="flex items-center gap-1.5">
                      <CarrierBadge carrier={s.carrier} />
                      <span className="font-mono text-slate-700">{s.tracking_number ?? `#${s.id}`}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{money(Number(s.order_total))}</span>
                      <button
                        type="button"
                        onClick={() => removeShipment(s.id)}
                        disabled={refreshing}
                        className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                        aria-label="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="relative">
              <input
                type="text"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Search unbilled shipments to add..."
                className={fieldClass}
              />
              {pickerResults.length > 0 && (
                <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200">
                  {pickerResults.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      disabled={refreshing}
                      onClick={() => addShipment(s.id)}
                      className="flex w-full items-center justify-between border-b border-slate-50 px-3 py-2 text-left text-xs last:border-0 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <span className="font-mono font-medium text-slate-700">{s.tracking_number ?? `#${s.id}`}</span>
                      <span className="text-slate-400">
                        {s.carrier} · {money(Number(s.order_total))}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-3 lg:order-1">
          <Card
            title="Buyer"
            right={
              isTaxInvoice ? (
                <Link href="/billing/customers" target="_blank" className="text-xs font-medium text-brand-amber hover:underline">
                  + Manage Customers
                </Link>
              ) : undefined
            }
          >
        {isTaxInvoice && (
          <div className="relative mb-3">
            <input
              type="text"
              value={customerQuery}
              onFocus={() => setCustomerDropdownOpen(true)}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setCustomerDropdownOpen(true);
                setBillingCustomerId(null);
              }}
              onBlur={() => setTimeout(() => setCustomerDropdownOpen(false), 150)}
              placeholder="Search Tax Invoice customer..."
              className={fieldClass}
            />
            {customerDropdownOpen && customerResults.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {customerResults.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectBillingCustomer(c)}
                    className="flex w-full flex-col items-start border-b border-slate-50 px-3 py-2 text-left text-xs last:border-0 hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-700">{c.name}</span>
                    <span className="text-slate-400">{c.tax_id}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="col-span-2 flex flex-col gap-1">
            <span className={labelClass}>Buyer Name</span>
            <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value.toUpperCase())} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Tax ID</span>
            <input type="text" value={buyerTaxId} onChange={(e) => setBuyerTaxId(e.target.value)} className={fieldClass} />
          </label>
          <label className="flex items-center gap-2 pt-5 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={buyerIsHeadOffice}
              onChange={(e) => setBuyerIsHeadOffice(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
            />
            Head Office
          </label>
          {!buyerIsHeadOffice && (
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Branch No.</span>
              <input type="text" value={buyerBranchNo} onChange={(e) => setBuyerBranchNo(e.target.value)} className={fieldClass} />
            </label>
          )}
          <label className="col-span-2 flex flex-col gap-1">
            <span className={labelClass}>Address</span>
            <textarea
              value={buyerAddress}
              onChange={(e) => setBuyerAddress(e.target.value.toUpperCase())}
              rows={2}
              className={`${fieldClass} resize-y`}
            />
          </label>
        </div>
      </Card>

      <Card
        title="Line Items"
        right={
          <div className="flex gap-3">
            <button type="button" onClick={mergeIntoOneLine} className={`text-xs font-semibold hover:underline ${accentText}`}>
              {preMergeLines ? "Split into itemized lines" : "Merge into one line"}
            </button>
            <button
              type="button"
              onClick={addLine}
              className={`flex items-center gap-1 text-xs font-semibold hover:underline ${accentText}`}
            >
              <Plus className="h-3.5 w-3.5" /> Add Line
            </button>
          </div>
        }
      >
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className={`text-xs uppercase ${accentTableHead}`}>
              <tr>
                <th className="w-auto px-3 py-2 font-medium">Description</th>
                {docType === "TAX_INVOICE" && <th className="w-32 px-3 py-2 font-medium">Invoice No.</th>}
                {docType === "TAX_INVOICE" && <th className="w-16 px-3 py-2 text-center font-medium">Non-VAT</th>}
                <th className="w-32 px-3 py-2 text-right font-medium">Amount</th>
                <th className="w-10 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(index, { description: e.target.value.toUpperCase() })}
                      className={underlineClass}
                    />
                  </td>
                  {docType === "TAX_INVOICE" && (
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={line.invoice_no ?? ""}
                        onChange={(e) => updateLine(index, { invoice_no: e.target.value })}
                        placeholder="optional"
                        className={underlineClass}
                      />
                    </td>
                  )}
                  {docType === "TAX_INVOICE" && (
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={line.is_non_vat ?? false}
                        onChange={(e) => updateLine(index, { is_non_vat: e.target.checked })}
                        className="h-4 w-4 accent-brand-amber"
                      />
                    </td>
                  )}
                  <td className="px-3 py-1.5">
                    <input
                      type="number"
                      value={line.amount}
                      onChange={(e) => updateLine(index, { amount: Number(e.target.value) })}
                      className={`${underlineClass} text-right`}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button type="button" onClick={() => removeLine(index)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            {docType === "TAX_INVOICE" && (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal (VAT)</span>
                  <span>{money(subtotalVat)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal (Non-VAT)</span>
                  <span>{money(subtotalNonVat)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>VAT 7%</span>
                  <span>{money(vatAmount)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold text-slate-800">
              <span>Grand Total</span>
              <span>{money(grandTotal)}</span>
            </div>
            <p className={`text-right text-xs ${totalsMatch ? "text-emerald-600" : "text-red-600"}`}>
              Lines {money(linesTotal)} / Sell Price {targetTotal != null ? money(targetTotal) : "-"}{" "}
              {totalsMatch ? "✓ Matched" : "✗ Not matched"}
            </p>
          </div>
        </div>
      </Card>
        </div>
      </div>

      {submitError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>}

      <div className="flex items-center justify-end gap-3 pb-6">
        {disabledReason && !submitting && <p className="text-xs text-red-500">{disabledReason}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className={`rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-50 ${accentSolid}`}
        >
          {submitting ? "Issuing..." : `Issue ${docType === "TAX_INVOICE" ? "Tax Invoice" : "Cash Receipt"}`}
        </button>
      </div>
    </div>
  );
}
