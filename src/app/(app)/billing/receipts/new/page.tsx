"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import PageLoading from "@/components/ui/PageLoading";
import CarrierBadge from "@/components/ui/CarrierBadge";
import BillingCustomerManagerModal from "@/components/config/BillingCustomerManagerModal";
import { listShipments, getShipment, type Shipment } from "@/lib/shipments";
import {
  listBillingCustomers,
  createBillingCustomer,
  formatBillingCustomerAddress,
  type BillingCustomer,
} from "@/lib/billingCustomers";
import { searchCustomerAddresses, type CustomerAddressWithCustomer } from "@/lib/customers";
import {
  previewReceiptLines,
  createReceipt,
  openReceiptPdf,
  type ReceiptPair,
  type ReceiptLineInput,
} from "@/lib/receipts";

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm leading-tight outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15";
const underlineClass =
  "w-full border-0 border-b border-dashed border-slate-300 bg-transparent px-0.5 py-0.5 text-sm leading-tight outline-none focus:border-brand-navy";
const labelClass = "text-xs font-medium uppercase tracking-wide text-slate-400";

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Suggested lines are tagged "... (UPS)"/"... (DHL)" by the backend (see previewLines()) so a
// mixed-carrier document still shows which carrier each amount came from — pull that tag out to
// show as a proper CarrierBadge instead of just plain text, without touching the actual editable
// description value (custom/merged lines with no tag simply show no badge).
function extractCarrierTag(description: string): "UPS" | "DHL" | null {
  const match = description.match(/\((UPS|DHL)\)\s*$/);
  return match ? (match[1] as "UPS" | "DHL") : null;
}

function formatAddressLine(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(", ");
}

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
  // Search results from the Shipment side's Customer/CustomerAddress directory — lets staff pick
  // a buyer that's already on file for booking shipments even if it has no Tax Invoice Customer
  // record yet (one gets auto-saved on submit via autoSaveBillingCustomer()).
  const [customerAddressResults, setCustomerAddressResults] = useState<CustomerAddressWithCustomer[]>([]);
  // Which source tab the Buyer picker dropdown is currently showing results from.
  const [customerSearchScope, setCustomerSearchScope] = useState<"billing" | "shipment">("billing");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [showCustomerManager, setShowCustomerManager] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successPair, setSuccessPair] = useState<ReceiptPair | null>(null);

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
    setBuyerName(preview.buyer_suggestion.name.toUpperCase());
    setBuyerTaxId(preview.buyer_suggestion.tax_id ?? "");
    setBuyerAddress(preview.buyer_suggestion.address.toUpperCase());
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
    if (customerQuery.trim().length < 2) {
      setCustomerResults([]);
      setCustomerAddressResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      Promise.all([listBillingCustomers({ q: customerQuery }), searchCustomerAddresses(customerQuery)]).then(
        ([billing, addresses]) => {
          setCustomerResults(billing.data);
          setCustomerAddressResults(addresses);
        },
      );
    }, 250);
    return () => clearTimeout(timeout);
  }, [customerQuery]);

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

  // Picking a Shipment-side Customer address — not yet a Tax Invoice Customer record, so
  // billingCustomerId stays null (autoSaveBillingCustomer() creates one on submit if needed).
  function selectCustomerAddress(a: CustomerAddressWithCustomer) {
    const name = a.company_name || a.customer?.name || a.contact_name;
    setBillingCustomerId(null);
    setBuyerName(name.toUpperCase());
    setBuyerTaxId(a.tax_id ?? "");
    setBuyerAddress(formatAddressLine([a.address1, a.address2, a.address3, a.city, a.postcode, a.country]).toUpperCase());
    setBuyerIsHeadOffice(true);
    setBuyerBranchNo("");
    setCustomerQuery(name);
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
    () => lines.filter((l) => !l.is_non_vat).reduce((s, l) => s + (Number(l.amount) || 0), 0),
    [lines],
  );
  const subtotalNonVat = linesTotal - vatInclusiveAmount;
  const subtotalVat = Math.round((vatInclusiveAmount / 1.07) * 100) / 100;
  const vatAmount = Math.round((vatInclusiveAmount - subtotalVat) * 100) / 100;
  const grandTotal = Math.round((subtotalNonVat + subtotalVat + vatAmount) * 100) / 100;

  // Line total no longer has to match the shipments' sell price exactly — some customers are
  // billed more than the shipment cost. The difference is recorded (shipment_total_snapshot on
  // the saved receipt) and shown here as an informational indicator, never blocks Submit.
  const variance = targetTotal != null ? Math.round((linesTotal - targetTotal) * 100) / 100 : null;
  const hasVariance = variance != null && Math.abs(variance) > 0.01;
  const canSubmit = shipments.length > 0 && lines.length > 0 && buyerName.trim().length > 0;
  const disabledReason =
    shipments.length === 0
      ? "Add at least one shipment"
      : lines.length === 0
        ? "Add at least one line item"
        : buyerName.trim().length === 0
          ? "Enter a buyer name"
          : null;

  // Saves the typed buyer as a reusable Tax Invoice Customer — mirrors autoSaveAddress on the
  // Create Shipment page: match an existing record by tax_id first (most reliable identifier),
  // otherwise by exact name, before creating a brand-new one. Never overwrites/edits in place —
  // those only happen from the Tax Invoice Customers management page.
  async function autoSaveBillingCustomer() {
    const name = buyerName.trim();
    if (!name || billingCustomerId) return;

    const taxId = buyerTaxId.trim();
    const normText = (v: string) => v.trim().toLowerCase();

    try {
      let matchId: number | null = null;
      if (taxId) {
        const res = await listBillingCustomers({ q: taxId });
        matchId = res.data.find((c) => c.tax_id && normText(c.tax_id) === normText(taxId))?.id ?? null;
      }
      if (!matchId) {
        const res = await listBillingCustomers({ q: name });
        matchId = res.data.find((c) => normText(c.name) === normText(name) && normText(c.tax_id ?? "") === normText(taxId))?.id ?? null;
      }
      if (matchId) return;

      await createBillingCustomer({
        name,
        tax_id: taxId || undefined,
        is_head_office: buyerIsHeadOffice,
        branch_no: buyerBranchNo || undefined,
        address1: buyerAddress.trim() || undefined,
      });
    } catch {
      // Best-effort background save — never block or surface errors on the receipt flow.
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError("");
    void autoSaveBillingCustomer();
    try {
      const pair = await createReceipt({
        shipment_ids: shipments.map((s) => s.id),
        billing_customer_id: billingCustomerId,
        buyer_name: buyerName,
        buyer_tax_id: buyerTaxId || null,
        buyer_address: buyerAddress || null,
        buyer_is_head_office: buyerIsHeadOffice,
        buyer_branch_no: buyerBranchNo || null,
        lines,
        vat_rate: 7,
      });
      setSuccessPair(pair);
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

  if (successPair) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
        <p className="mb-4 text-sm font-semibold text-emerald-700">Cash Receipt &amp; Tax Invoice issued successfully</p>
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-3 py-2 text-left text-sm">
            <span className="text-slate-600">
              Cash Receipt <span className="font-mono text-xs text-slate-400">{successPair.cash_receipt.vol_no}/{successPair.cash_receipt.no}</span>
            </span>
            <button
              type="button"
              onClick={() => openReceiptPdf(successPair.cash_receipt.id)}
              className="rounded-lg bg-brand-navy-dark px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy-dark/90"
            >
              Open PDF
            </button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-3 py-2 text-left text-sm">
            <span className="text-slate-600">
              Tax Invoice <span className="font-mono text-xs text-slate-400">{successPair.tax_invoice.vol_no}/{successPair.tax_invoice.no}</span>
            </span>
            <button
              type="button"
              onClick={() => openReceiptPdf(successPair.tax_invoice.id)}
              className="rounded-lg bg-brand-amber px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-brand-amber/90"
            >
              Open PDF
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push("/billing/receipts")}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Go to Receipts List
        </button>
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
                New <span className="text-brand-navy-dark">Cash Receipt &amp; Tax Invoice</span>
              </h1>
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
                  <li key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <CarrierBadge carrier={s.carrier} />
                      <span className="truncate font-mono text-slate-700">{s.tracking_number ?? `#${s.id}`}</span>
                    </span>
                    <div className="flex shrink-0 items-center gap-3">
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
                placeholder="Search unbilled shipments (tracking no., sender, receiver)..."
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
              <button
                type="button"
                onClick={() => setShowCustomerManager(true)}
                className="text-xs font-medium text-brand-amber hover:underline"
              >
                + Manage Customers
              </button>
            }
          >
        <div className="mb-2 flex gap-1.5">
          <button
            type="button"
            onClick={() => setCustomerSearchScope("billing")}
            className={`inline-flex shrink-0 items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${
              customerSearchScope === "billing" ? "bg-brand-amber/15 text-brand-amber" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
            }`}
          >
            Tax Invoice Customers
          </button>
          <button
            type="button"
            onClick={() => setCustomerSearchScope("shipment")}
            className={`inline-flex shrink-0 items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${
              customerSearchScope === "shipment" ? "bg-brand-amber/15 text-brand-amber" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
            }`}
          >
            Shipment Customers
          </button>
        </div>
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
            placeholder={customerSearchScope === "billing" ? "Search tax invoice customers..." : "Search shipment customers..."}
            className={fieldClass}
          />
          {customerDropdownOpen && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
              {customerSearchScope === "billing" ? (
                customerResults.length > 0 ? (
                  customerResults.map((c) => (
                    <button
                      type="button"
                      key={`bc-${c.id}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectBillingCustomer(c)}
                      className="flex w-full flex-col items-start border-b border-slate-50 px-3 py-2 text-left text-xs last:border-0 hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-700">{c.name}</span>
                      <span className="text-slate-400">{c.tax_id}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-center text-xs text-slate-400">
                    {customerQuery.trim().length < 2 ? "Type to search..." : "No matches"}
                  </p>
                )
              ) : customerAddressResults.length > 0 ? (
                customerAddressResults.map((a) => (
                  <button
                    type="button"
                    key={`addr-${a.id}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectCustomerAddress(a)}
                    className="flex w-full flex-col items-start border-b border-slate-50 px-3 py-2 text-left text-xs last:border-0 hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-700">{a.company_name || a.customer?.name || a.contact_name}</span>
                    <span className="text-slate-400">{[a.customer?.name, a.tax_id].filter(Boolean).join(" · ")}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-3 text-center text-xs text-slate-400">
                  {customerQuery.trim().length < 2 ? "Type to search..." : "No matches"}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="col-span-2 flex flex-col gap-1">
            <span className={labelClass}>Buyer Name</span>
            <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value.toUpperCase())} className={fieldClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Tax ID</span>
            <input type="text" value={buyerTaxId} onChange={(e) => setBuyerTaxId(e.target.value)} className={fieldClass} />
          </label>
          <div className="flex items-center gap-4 pt-5 text-sm text-slate-600">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="buyer-office-scope"
                checked={buyerIsHeadOffice}
                onChange={() => setBuyerIsHeadOffice(true)}
                className="h-4 w-4 accent-brand-amber"
              />
              Head Office
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="buyer-office-scope"
                checked={!buyerIsHeadOffice}
                onChange={() => setBuyerIsHeadOffice(false)}
                className="h-4 w-4 accent-brand-amber"
              />
              Branch
            </label>
          </div>
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
            <button type="button" onClick={mergeIntoOneLine} className="text-xs font-semibold text-brand-navy-dark hover:underline">
              {preMergeLines ? "Split into itemized lines" : "Merge into one line"}
            </button>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-1 text-xs font-semibold text-brand-navy-dark hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add Line
            </button>
          </div>
        }
      >
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-navy-dark text-xs uppercase text-white/90">
              <tr>
                <th className="w-auto px-3 py-2 font-medium">Description</th>
                <th className="w-32 px-3 py-2 font-medium">Invoice No.</th>
                <th className="w-16 px-3 py-2 text-center font-medium">Non-VAT</th>
                <th className="w-32 px-3 py-2 text-right font-medium">Amount</th>
                <th className="w-10 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-t border-slate-100">
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {extractCarrierTag(line.description) && <CarrierBadge carrier={extractCarrierTag(line.description)!} />}
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(index, { description: e.target.value.toUpperCase() })}
                        className={underlineClass}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <input
                      type="text"
                      value={line.invoice_no ?? ""}
                      onChange={(e) => updateLine(index, { invoice_no: e.target.value })}
                      placeholder="optional"
                      className={underlineClass}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={line.is_non_vat ?? false}
                      onChange={(e) => updateLine(index, { is_non_vat: e.target.checked })}
                      className="h-4 w-4 accent-brand-amber"
                    />
                  </td>
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
            <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold text-slate-800">
              <span>Grand Total</span>
              <span>{money(grandTotal)}</span>
            </div>
            <p className={`text-right text-xs ${hasVariance ? "text-amber-600" : "text-slate-400"}`}>
              Lines {money(linesTotal)} / Sell Price {targetTotal != null ? money(targetTotal) : "-"}
              {hasVariance && variance != null && (
                <> — ส่วนต่าง {variance > 0 ? "+" : ""}
                  {money(variance)}
                </>
              )}
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
          className="rounded-lg bg-brand-navy-dark px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-50"
        >
          {submitting ? "Issuing..." : "Issue Cash Receipt & Tax Invoice"}
        </button>
      </div>

      {showCustomerManager && (
        <BillingCustomerManagerModal
          onClose={() => setShowCustomerManager(false)}
          onSelect={(c) => {
            selectBillingCustomer(c);
            setShowCustomerManager(false);
          }}
        />
      )}
    </div>
  );
}
