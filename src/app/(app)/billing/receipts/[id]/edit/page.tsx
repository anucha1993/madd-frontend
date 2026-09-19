"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import PageLoading from "@/components/ui/PageLoading";
import {
  getReceipt,
  updateReceipt,
  deleteReceipt,
  openReceiptPdf,
  type Receipt,
  type ReceiptLineInput,
} from "@/lib/receipts";
import {
  listBillingCustomers,
  formatBillingCustomerAddress,
  type BillingCustomer,
} from "@/lib/billingCustomers";

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm leading-tight outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15 disabled:bg-slate-50 disabled:text-slate-400";
const underlineClass =
  "w-full border-0 border-b border-dashed border-slate-300 bg-transparent px-0.5 py-0.5 text-sm leading-tight outline-none focus:border-brand-navy disabled:text-slate-400";
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

export default function EditReceiptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const receiptId = Number(params.id);

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [lines, setLines] = useState<ReceiptLineInput[]>([]);
  const [buyerName, setBuyerName] = useState("");
  const [buyerTaxId, setBuyerTaxId] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerIsHeadOffice, setBuyerIsHeadOffice] = useState(true);
  const [buyerBranchNo, setBuyerBranchNo] = useState("");
  const [billingCustomerId, setBillingCustomerId] = useState<number | null>(null);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<BillingCustomer[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(receiptId)) {
      setLoadError("Invalid document link.");
      setLoading(false);
      return;
    }
    getReceipt(receiptId)
      .then((r) => {
        setReceipt(r);
        setLines((r.lines ?? []).map((l) => ({
          description: l.description,
          invoice_no: l.invoice_no ?? null,
          is_non_vat: l.is_non_vat,
          amount: Number(l.amount),
        })));
        setBuyerName(r.buyer_name);
        setBuyerTaxId(r.buyer_tax_id ?? "");
        setBuyerAddress(r.buyer_address ?? "");
        setBuyerIsHeadOffice(r.buyer_is_head_office);
        setBuyerBranchNo(r.buyer_branch_no ?? "");
        setBillingCustomerId(r.billing_customer_id);
        setPaymentMethod(r.payment_method ?? "");
        setPaymentReference(r.payment_reference ?? "");
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load document"))
      .finally(() => setLoading(false));
  }, [receiptId]);

  useEffect(() => {
    if (receipt?.type !== "TAX_INVOICE" || customerQuery.trim().length < 2) {
      setCustomerResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      listBillingCustomers({ q: customerQuery }).then((res) => setCustomerResults(res.data));
    }, 250);
    return () => clearTimeout(timeout);
  }, [customerQuery, receipt?.type]);

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

  function addLine() {
    setLines((prev) => [...prev, { description: "", is_non_vat: false, amount: 0 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, patch: Partial<ReceiptLineInput>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  const isTaxInvoice = receipt?.type === "TAX_INVOICE";
  const isVoided = receipt?.status === "VOIDED";
  const targetTotal = receipt ? Number(receipt.grand_total) : null;

  const linesTotal = useMemo(() => lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0), [lines]);
  const vatInclusiveAmount = useMemo(
    () => (isTaxInvoice ? lines.filter((l) => !l.is_non_vat).reduce((s, l) => s + (Number(l.amount) || 0), 0) : 0),
    [lines, isTaxInvoice],
  );
  const subtotalNonVat = isTaxInvoice ? linesTotal - vatInclusiveAmount : 0;
  const subtotalVat = isTaxInvoice ? Math.round((vatInclusiveAmount / 1.07) * 100) / 100 : 0;
  const vatAmount = isTaxInvoice ? Math.round((vatInclusiveAmount - subtotalVat) * 100) / 100 : 0;
  const grandTotal = isTaxInvoice ? Math.round((subtotalNonVat + subtotalVat + vatAmount) * 100) / 100 : linesTotal;

  const totalsMatch = targetTotal != null && Math.abs(linesTotal - targetTotal) <= 0.01;
  const canSave = !isVoided && lines.length > 0 && totalsMatch && buyerName.trim().length > 0;
  const disabledReason = isVoided
    ? "This document is voided and cannot be edited"
    : lines.length === 0
      ? "Add at least one line item"
      : !totalsMatch
        ? "Line total must match the document's original grand total"
        : buyerName.trim().length === 0
          ? "Enter a buyer name"
          : null;

  const accentText = isTaxInvoice ? "text-brand-amber" : "text-brand-navy-dark";
  const accentTableHead = isTaxInvoice ? "bg-brand-amber text-slate-900" : "bg-brand-navy-dark text-white/90";
  const accentSolid = isTaxInvoice
    ? "bg-brand-amber text-slate-900 hover:bg-brand-amber/90"
    : "bg-brand-navy-dark text-white hover:bg-brand-navy-dark/90";

  async function handleSave() {
    if (!receipt) return;
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const updated = await updateReceipt(receipt.id, {
        billing_customer_id: isTaxInvoice ? billingCustomerId : null,
        buyer_name: buyerName,
        buyer_tax_id: buyerTaxId || null,
        buyer_address: buyerAddress || null,
        buyer_is_head_office: buyerIsHeadOffice,
        buyer_branch_no: buyerBranchNo || null,
        lines,
        vat_rate: 7,
        payment_method: paymentMethod || null,
        payment_reference: paymentReference || null,
      });
      setReceipt(updated);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  // Only ever allowed by the backend for a Test document — releases the shipment lock too.
  async function handleDelete() {
    if (!receipt) return;
    if (!confirm("Permanently delete this TEST document? Its shipment(s) will become billable again. This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteReceipt(receipt.id);
      router.push("/billing/receipts");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete document");
      setDeleting(false);
    }
  }

  if (loading) return <PageLoading label="Loading document..." />;

  if (loadError || !receipt) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-700">{loadError || "Document not found"}</p>
        <Link
          href="/billing/receipts"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Receipts List
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-3">
      <Link href="/billing/receipts" className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Receipts List
      </Link>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="flex flex-col gap-3 lg:order-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-xl font-bold text-slate-900">
                <span className={accentText}>{isTaxInvoice ? "Tax Invoice" : "Cash Receipt"}</span> #{receipt.vol_no}/{receipt.no}
              </h1>
              <div className="flex items-center gap-1.5">
                {receipt.is_test && (
                  <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-600">TEST</span>
                )}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isVoided ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-600"
                  }`}
                >
                  {isVoided ? "Voided" : "Issued"}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className={labelClass}>Grand Total (locked)</p>
                <p className="mt-1 text-sm text-slate-700">{targetTotal != null ? money(targetTotal) : "-"}</p>
              </div>
              <div className="text-right">
                <p className={labelClass}>Document Date</p>
                <p className="mt-1 text-sm text-slate-700">{receipt.issued_date}</p>
              </div>
            </div>
            {isVoided && (
              <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                This document has been voided and is read-only. Void note: {receipt.void_note || "—"}
              </p>
            )}
          </section>

          <Card title="Shipments (locked)">
            {receipt.shipments && receipt.shipments.length > 0 ? (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {receipt.shipments.map((s) => (
                  <li key={s.id} className="px-3 py-1.5 text-sm font-mono text-slate-700">
                    {s.tracking_number ?? `#${s.id}`}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No shipment info available.</p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              The set of shipments billed on this document can never change — issue a new document instead if that&apos;s needed.
            </p>
          </Card>

          <Card title="Actions">
            <button
              type="button"
              onClick={() => openReceiptPdf(receipt.id)}
              className="w-full rounded-lg bg-brand-navy-dark/10 px-3 py-2 text-sm font-medium text-brand-navy-dark hover:bg-brand-navy-dark/20"
            >
              Print / Open PDF
            </button>
            {receipt.is_test && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="mt-2 w-full rounded-lg bg-purple-50 px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-100 disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete TEST Document"}
              </button>
            )}
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
            {isTaxInvoice && !isVoided && (
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
                <input
                  type="text"
                  disabled={isVoided}
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value.toUpperCase())}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Tax ID</span>
                <input
                  type="text"
                  disabled={isVoided}
                  value={buyerTaxId}
                  onChange={(e) => setBuyerTaxId(e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="flex items-center gap-2 pt-5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  disabled={isVoided}
                  checked={buyerIsHeadOffice}
                  onChange={(e) => setBuyerIsHeadOffice(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
                />
                Head Office
              </label>
              {!buyerIsHeadOffice && (
                <label className="flex flex-col gap-1">
                  <span className={labelClass}>Branch No.</span>
                  <input
                    type="text"
                    disabled={isVoided}
                    value={buyerBranchNo}
                    onChange={(e) => setBuyerBranchNo(e.target.value)}
                    className={fieldClass}
                  />
                </label>
              )}
              <label className="col-span-2 flex flex-col gap-1">
                <span className={labelClass}>Address</span>
                <textarea
                  disabled={isVoided}
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value.toUpperCase())}
                  rows={2}
                  className={`${fieldClass} resize-y`}
                />
              </label>
            </div>
          </Card>

          <Card title="Payment">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Payment Method / Bank</span>
                <input
                  type="text"
                  disabled={isVoided}
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Reference No.</span>
                <input
                  type="text"
                  disabled={isVoided}
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>
          </Card>

          <Card
            title="Line Items"
            right={
              !isVoided ? (
                <button
                  type="button"
                  onClick={addLine}
                  className={`flex items-center gap-1 text-xs font-semibold hover:underline ${accentText}`}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Line
                </button>
              ) : undefined
            }
          >
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className={`text-xs uppercase ${accentTableHead}`}>
                  <tr>
                    <th className="w-auto px-3 py-2 font-medium">Description</th>
                    {isTaxInvoice && <th className="w-32 px-3 py-2 font-medium">Invoice No.</th>}
                    {isTaxInvoice && <th className="w-16 px-3 py-2 text-center font-medium">Non-VAT</th>}
                    <th className="w-32 px-3 py-2 text-right font-medium">Amount</th>
                    {!isVoided && <th className="w-10 px-3 py-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={index} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          disabled={isVoided}
                          value={line.description}
                          onChange={(e) => updateLine(index, { description: e.target.value.toUpperCase() })}
                          className={underlineClass}
                        />
                      </td>
                      {isTaxInvoice && (
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            disabled={isVoided}
                            value={line.invoice_no ?? ""}
                            onChange={(e) => updateLine(index, { invoice_no: e.target.value })}
                            placeholder="optional"
                            className={underlineClass}
                          />
                        </td>
                      )}
                      {isTaxInvoice && (
                        <td className="px-3 py-1.5 text-center">
                          <input
                            type="checkbox"
                            disabled={isVoided}
                            checked={line.is_non_vat ?? false}
                            onChange={(e) => updateLine(index, { is_non_vat: e.target.checked })}
                            className="h-4 w-4 accent-brand-amber"
                          />
                        </td>
                      )}
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          disabled={isVoided}
                          value={line.amount}
                          onChange={(e) => updateLine(index, { amount: Number(e.target.value) })}
                          className={`${underlineClass} text-right`}
                        />
                      </td>
                      {!isVoided && (
                        <td className="px-3 py-1.5 text-right">
                          <button type="button" onClick={() => removeLine(index)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex justify-end">
              <div className="w-full max-w-xs space-y-1 text-sm">
                {isTaxInvoice && (
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
                  Lines {money(linesTotal)} / Original Total {targetTotal != null ? money(targetTotal) : "-"}{" "}
                  {totalsMatch ? "✓ Matched" : "✗ Not matched"}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {saveError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>}
      {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">Changes saved.</p>}

      {!isVoided && (
        <div className="flex items-center justify-end gap-3 pb-6">
          {disabledReason && !saving && <p className="text-xs text-red-500">{disabledReason}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className={`rounded-lg px-6 py-2.5 text-sm font-semibold disabled:opacity-50 ${accentSolid}`}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
