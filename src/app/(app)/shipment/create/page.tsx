"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Code, Loader2, Lock, Package, Plus, Printer, Receipt, Search, ShieldCheck, Sparkles, Tag, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import ThaiAddressSearch from "@/components/shipment/ThaiAddressSearch";
import CountrySelect from "@/components/shipment/CountrySelect";
import CustomerAddressPicker from "@/components/shipment/CustomerAddressPicker";
import { listCountries, type Country } from "@/lib/countries";
import { listAgents, type Agent } from "@/lib/agentAccounts";
import { listSupplies, type Supply } from "@/lib/supplies";
import { listAddonItems, type AddonItem } from "@/lib/addonItems";
import { parseAddressWithAi } from "@/lib/ai";
import { useAiEnabled } from "@/hooks/useAiEnabled";
import { listProductWeightBands, matchProductWeightBand, pickForcedWeightBand, type ProductWeightBand } from "@/lib/productWeightBands";
import { listManifestOptions, type ManifestOption } from "@/lib/manifestOptions";
import { getThaiSubdistrictsByZipCode } from "@/lib/thaiSubdistricts";
import { checkRate, type CheckRateInput, type RateQuote, type ShipmentPackageInput } from "@/lib/shipping";
import { lookupInsuranceCountryCap, type InsuranceCountryCap } from "@/lib/insuranceCountryCaps";
import { bookShipment, openShipmentLabel, printShipmentReceipt, type BookShipmentInput, type Shipment } from "@/lib/shipments";
import { getShipmentDraft, createShipmentDraft, updateShipmentDraft, deleteShipmentDraft } from "@/lib/shipmentDrafts";
import { getUser } from "@/lib/auth";
import {
  listCustomers,
  createCustomer,
  createCustomerAddress,
  listCustomerAddresses,
  type CustomerAddressType,
  type CustomerAddressWithCustomer,
} from "@/lib/customers";

// Loose text match helper for reconciling AI-parsed Thai subdistrict/district names (which
// often have inconsistent romanization, e.g. "Phlabphla" vs the DB's "Phlapphla") against the
// thai_subdistricts lookup table — see handleAiFillApply.

// DHL insures Documents with a flat, non-value-based lump sum (its own "Extended Liability"
// service, 'IB') rather than a percentage of a declared value — so Document insurance is just a
// Yes/No toggle; this is the fixed compensation DHL states on its own MyDHL portal.
const DHL_DOCUMENT_FIXED_COVERAGE_THB = 17000;

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[b.length];
}

const STEPS = [
  { number: 1 as const, label: "Ship Info" },
  { number: 2 as const, label: "Product & Rate" },
  { number: 3 as const, label: "Add On" },
  { number: 4 as const, label: "Payment Info" },
];

// Product Type is per-box (each package can be a different classification) — which Insurance
// items apply and at what rate is driven by each AddonItem's product_types config (see
// getInsuranceOptionsForPackage), e.g. UPSC is configured to only apply to Silver boxes.
// "OTHER" lets staff type a free-text classification (productTypeOther) not covered by the two presets.
type ProductType = "SILVER" | "NON_SILVER" | "OTHER" | null;

type PackageRow = ShipmentPackageInput & {
  key: number;
  forcedWeightBandId: number | null;
  insured: boolean;
  productType: ProductType;
  productTypeOther: string;
};

let rowKeySeq = 1;
const newRow = (): PackageRow => ({
  key: rowKeySeq++,
  weight: 1,
  length: 10,
  width: 10,
  height: 10,
  quantity: 1,
  description: "",
  is_document: false,
  declared_value: 0,
  insured: false,
  // Non Silver is the default Product Type for every new box (see selectPackageInsurance / renderInsurancePicker).
  productType: "NON_SILVER",
  productTypeOther: "",
  forcedWeightBandId: null,
});

// A free-form Add-on order line (POS-style row) — can be quick-filled from a catalog suggestion
// or added blank and typed in manually.
type AddonRow = {
  key: number;
  addonItemId: number | null;
  name: string;
  nameLocked: boolean;
  category: string;
  carriers: string;
  quantity: number;
  unitPrice: string;
  priceLocked: boolean;
  // Real carrier API charge (e.g. UPS chargeBreakdown code "400") for carrier-own insurance —
  // kept only as an internal cost reference, never shown to or charged to the customer.
  costPrice?: string;
  // Insurance rows are scoped to ONE package (see selectPackageInsurance) — each box may use a
  // different insurer. Undefined for every other (shipment-wide) Add-on category.
  packageKey?: number;
};
let addonRowKeySeq = 1;
const newAddonRow = (init?: Partial<AddonRow>): AddonRow => ({
  key: addonRowKeySeq++,
  addonItemId: null,
  name: "",
  nameLocked: false,
  category: "Other",
  carriers: "",
  quantity: 1,
  unitPrice: "",
  priceLocked: false,
  costPrice: undefined,
  ...init,
});

// Sentinel value for the first Add-on tab, which lists Packing Supplies (from /config/supplies)
// as quick-add suggestions instead of the configured Add-on catalog.
const SUPPLIES_TAB = "__supplies__";

// Only "UPSC"-coded items are the third-party insurer product governed by /config/insurance-caps
// (country coverage caps / sanctions). Carrier-own insurance (ICDV, DHL) is priced by that
// carrier's own API and must NOT be capped/blocked by our third-party country caps data.
const isThirdPartyInsuranceItem = (item: Pick<AddonItem, "name">) => item.name.toUpperCase().startsWith("UPSC");

const ENTITY_TYPE_OPTIONS: { value: "INDIVIDUAL" | "COMPANY"; label: string; description: string }[] = [
  { value: "INDIVIDUAL", label: "INDIVIDUAL", description: "การจัดส่งเพื่อการใช้งานส่วนตัว ของขวัญ หรือของใช้ในบ้าน" },
  { value: "COMPANY", label: "COMPANY", description: "การจัดส่งเพื่อวัตถุประสงค์ทางการค้าด้วย VAT/ID ภาษี" },
];

export default function ShipmentCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { enabled: aiEnabled } = useAiEnabled();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Staff creating this shipment / their branch — shown in Order Summary as a final review.
  const currentUser = getUser();
  const currentUserBranchLabel = currentUser?.can_access_all_branches
    ? "ทุกสาขา"
    : currentUser?.branches?.map((b) => b.name).join(", ") || "-";

  const [originContactName, setOriginContactName] = useState("");
  // Set when a saved address is picked via CustomerAddressPicker — lets auto-save reuse the
  // exact same customer even if that address had blank phone/tax_id (so it can't be re-matched
  // by those fields alone). Cleared if the contact name is retyped (treated as a different person).
  const [originCustomerId, setOriginCustomerId] = useState<number | null>(null);
  const [originCompany, setOriginCompany] = useState("");
  const [originTaxId, setOriginTaxId] = useState("");
  const [originPostcode, setOriginPostcode] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [originAddress, setOriginAddress] = useState("");
  const [originAddress2, setOriginAddress2] = useState("");
  const [originAddress3, setOriginAddress3] = useState("");
  const [originPhone, setOriginPhone] = useState("");
  const [originNotes, setOriginNotes] = useState("");
  const [originSearchValue, setOriginSearchValue] = useState("");
  const [originLookup, setOriginLookup] = useState<{ status: "idle" | "loading" | "found" | "not-found"; label?: string }>({
    status: "idle",
  });
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [autoFillText, setAutoFillText] = useState("");
  const [autoFillError, setAutoFillError] = useState("");

  const [aiFillTarget, setAiFillTarget] = useState<"from" | "to" | null>(null);
  const [aiFillText, setAiFillText] = useState("");
  const [aiFillLoading, setAiFillLoading] = useState(false);
  const [aiFillError, setAiFillError] = useState("");

  const [destinationContactName, setDestinationContactName] = useState("");
  const [destinationCustomerId, setDestinationCustomerId] = useState<number | null>(null);
  const [destinationCompany, setDestinationCompany] = useState("");
  const [destinationTaxId, setDestinationTaxId] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationPostcode, setDestinationPostcode] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [destinationAddress2, setDestinationAddress2] = useState("");
  const [destinationAddress3, setDestinationAddress3] = useState("");
  const [destinationPhone, setDestinationPhone] = useState("");
  const [destinationEmail, setDestinationEmail] = useState("");
  const [destinationNotes, setDestinationNotes] = useState("");

  const [packages, setPackages] = useState<PackageRow[]>([newRow()]);
  // Which package row Common Sizes / dimension edits apply to — only one row is "unlocked" at a time.
  const [activePackageKey, setActivePackageKey] = useState<number | null>(packages[0]?.key ?? null);

  // Declared Value is set PER PACKAGE (UPS insurance is a package-level field) — this total feeds
  // any Add-on catalog item priced as "Percent of Declared Value" (e.g. Insurance).
  const totalDeclaredValue = packages.reduce((sum, p) => sum + (p.insured ? Number(p.declared_value) || 0 : 0), 0);

  const [customerTypeOptions, setCustomerTypeOptions] = useState<ManifestOption[]>([]);
  const [customerType, setCustomerType] = useState("DAILY");
  const [entityType, setEntityType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [paymentOptions, setPaymentOptions] = useState<ManifestOption[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [billTransportationOptions, setBillTransportationOptions] = useState<ManifestOption[]>([]);
  const [billTransportationTo, setBillTransportationTo] = useState("");
  const [billDutyTaxOptions, setBillDutyTaxOptions] = useState<ManifestOption[]>([]);
  const [billDutyTaxTo, setBillDutyTaxTo] = useState("");
  const [refInvoiceNo, setRefInvoiceNo] = useState("");
  const [refInsuranceNo, setRefInsuranceNo] = useState("");
  const [refPurchaseNo, setRefPurchaseNo] = useState("");

  // Third-party insurance coverage cap / sanction note for the destination country — see /config/insurance-caps.
  const [insuranceCap, setInsuranceCap] = useState<InsuranceCountryCap | null>(null);

  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [stockSupplyId, setStockSupplyId] = useState<number | null>(null);
  const [supplySearch, setSupplySearch] = useState("");

  const [addonItems, setAddonItems] = useState<AddonItem[]>([]);
  const [addonRows, setAddonRows] = useState<AddonRow[]>([]);
  const [addonSearch, setAddonSearch] = useState("");
  const [activeAddonCategory, setActiveAddonCategory] = useState(SUPPLIES_TAB);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [weightBands, setWeightBands] = useState<ProductWeightBand[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);

  useEffect(() => {
    listSupplies()
      .then((all) => setSupplies(all.filter((s) => s.status)))
      .catch(() => {});
    listAddonItems()
      .then((all) => setAddonItems(all.filter((a) => a.status)))
      .catch(() => {});
    listAgents()
      .then(setAgents)
      .catch(() => {});
    listProductWeightBands()
      .then((all) => setWeightBands(all.filter((b) => b.status)))
      .catch(() => {});
    listCountries()
      .then((all) => {
        const active = all.filter((c) => c.status);
        setCountries(active);
        setDestinationCountry((current) => current || active[0]?.iso2 || "");
      })
      .catch(() => {});
    listManifestOptions("customer_type")
      .then((all) => {
        const active = all.filter((o) => o.status);
        setCustomerTypeOptions(active);
        setCustomerType((current) => (active.some((o) => o.code === current) ? current : active[0]?.code ?? current));
      })
      .catch(() => {});
    listManifestOptions("payment_option")
      .then((all) => {
        const active = all.filter((o) => o.status);
        setPaymentOptions(active);
        setPaymentMethod((current) => current || active[0]?.code || "");
      })
      .catch(() => {});
    listManifestOptions("bill_transportation_to")
      .then((all) => {
        const active = all.filter((o) => o.status);
        setBillTransportationOptions(active);
        setBillTransportationTo((current) => current || (active.some((o) => o.code === "SHIPPER") ? "SHIPPER" : active[0]?.code ?? ""));
      })
      .catch(() => {});
    listManifestOptions("bill_duty_tax_to")
      .then((all) => {
        const active = all.filter((o) => o.status);
        setBillDutyTaxOptions(active);
        setBillDutyTaxTo((current) => current || (active.some((o) => o.code === "RECEIVER") ? "RECEIVER" : active[0]?.code ?? ""));
      })
      .catch(() => {});
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<RateQuote[] | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<RateQuote | null>(null);
  // Declared Value actually SENT for each package on the last successful Check Rate — lets
  // API_COST insurance (e.g. DHL's own) tell when its frozen price is stale (Declared Value
  // edited since) even if the addon row itself was already cleared/reselected.
  const [quotedDeclaredValues, setQuotedDeclaredValues] = useState<Record<number, number>>({});
  // "Confirm & Book Shipment" (Step 4) — opens a review Modal first, actual booking only fires
  // when staff clicks Confirm inside it (this hits the real UPS/DHL API, not reversible).
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [bookedShipment, setBookedShipment] = useState<Shipment | null>(null);
  const [openingLabel, setOpeningLabel] = useState(false);
  const [viewRawQuote, setViewRawQuote] = useState<RateQuote | null>(null);
  // Which carrier(s) to check — lets staff narrow to just UPS or just DHL so the insurance
  // picker (which needs a known carrier) can be driven right after Check Rate, without waiting
  // to manually pick a quote card out of a mixed UPS+DHL results list.
  const [selectedCarriers, setSelectedCarriers] = useState<("UPS" | "DHL")[]>(["UPS", "DHL"]);

  function toggleCarrierFilter(carrier: "UPS" | "DHL") {
    setSelectedCarriers((prev) => {
      const next = prev.includes(carrier) ? prev.filter((c) => c !== carrier) : [...prev, carrier];
      return next.length > 0 ? next : prev; // must always keep at least one carrier selected
    });
  }

  // Rate Quotes reflect whatever the packages looked like at the moment "Check Rate" was
  // clicked — if weight/dimensions/quantity/box-vs-document change afterwards, the old quotes no
  // longer match and must be invalidated. Still deliberately EXCLUDES Box Declared Value (typing a
  // new value must not wipe the just-selected quote — see the isStaleApiCost pattern instead) —
  // but DOCUMENT insurance is a flat toggle (never typed) that changes the quoted total outright
  // (DHL's IB charge), so flipping it always invalidates old quotes, forcing a guaranteed-fresh
  // re-check instead of ever showing a quote whose price doesn't match the current Insurance state.
  const rateAffectingSignature = JSON.stringify(
    packages.map((p) => [p.weight, p.length, p.width, p.height, p.quantity, p.is_document, p.is_document ? p.insured : false]),
  );
  useEffect(() => {
    setResults(null);
    setSelectedQuote(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rateAffectingSignature, selectedCarriers.join(",")]);

  // UPS never covers Document packages with insurance at all — if the selected quote is UPS,
  // force-clear "Insurance" (and any leftover addon rows) on every Document package so staff
  // can't get stuck with a checked-but-unselectable Insurance state.
  const insuredDocumentSignature = packages.map((p) => `${p.key}:${p.is_document ? 1 : 0}:${p.insured ? 1 : 0}`).join(",");
  useEffect(() => {
    if (selectedQuote?.carrier !== "UPS") return;
    const blockedKeys = packages.filter((p) => p.is_document && p.insured).map((p) => p.key);
    if (blockedKeys.length === 0) return;
    setPackages((prev) => prev.map((p) => (blockedKeys.includes(p.key) ? { ...p, insured: false } : p)));
    setAddonRows((prev) =>
      prev.filter((r) => {
        if (r.category !== "Insurance" || r.packageKey == null) return true;
        return !blockedKeys.includes(r.packageKey);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuote, insuredDocumentSignature]);

  // getInsuranceOptionsForPackage requires a selectedQuote to know which carrier's item applies
  // — so checking "Insurance" BEFORE ever running Check Rate leaves NO addon row selected at all
  // (autoSelectPackageInsurer has nothing to pick from yet). Backfill it now that a real quote
  // exists, for every package still marked insured. MUST check stillEligible first (same as
  // setPackageProductType) — selectPackageInsurance TOGGLES OFF an already-selected item, so
  // calling autoSelectPackageInsurer unconditionally on every selectedQuote change (e.g. just
  // switching between two DHL quote cards) would silently deselect/remove the existing row.
  useEffect(() => {
    if (!selectedQuote) return;
    packages.forEach((pkg) => {
      if (!pkg.insured || (selectedQuote.carrier === "UPS" && pkg.is_document)) return;
      const { carrierOption, thirdPartyOption } = getInsuranceOptionsForPackage(pkg.productType);
      const selectedRow = addonRows.find((r) => r.packageKey === pkg.key && r.category === "Insurance");
      const stillEligible =
        !!selectedRow && (selectedRow.addonItemId === carrierOption?.id || selectedRow.addonItemId === thirdPartyOption?.id);
      if (!stillEligible) autoSelectPackageInsurer(pkg);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuote]);

  // Carrier-own (API_COST) insurance rows are created with whatever real charge is available AT
  // SELECTION TIME (see selectPackageInsurance) — often 0/stale if Insurance was checked before a
  // Rate Quote existed yet. Re-sync every such row's price whenever the selected quote's real
  // chargeBreakdown changes, so "ราคาประกันสินค้า" always reflects the actual API cost.
  useEffect(() => {
    if (!selectedQuote) return;
    setAddonRows((prev) =>
      prev.map((row) => {
        if (row.category !== "Insurance" || row.packageKey == null) return row;
        const item = addonItems.find((i) => i.id === row.addonItemId);
        if (!item || item.price_type !== "API_COST" || isThirdPartyInsuranceItem(item)) return row;
        const pkg = packages.find((p) => p.key === row.packageKey);
        if (!pkg) return row;
        const dhlChargeCode = pkg.is_document ? "IB" : "II";
        const charge = selectedQuote.chargeBreakdown?.find(
          (c) => c.code === (selectedQuote.carrier === "DHL" ? dhlChargeCode : "400"),
        )?.amount;
        const newUnitPrice = String(charge ?? 0);
        const newCostPrice = charge != null ? String(charge) : undefined;
        if (row.unitPrice === newUnitPrice && row.costPrice === newCostPrice) return row;
        return { ...row, unitPrice: newUnitPrice, costPrice: newCostPrice };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuote]);

  useEffect(() => {
    if (!destinationCountry) {
      setInsuranceCap(null);
      return;
    }
    let cancelled = false;
    lookupInsuranceCountryCap(destinationCountry)
      .then((cap) => {
        if (!cancelled) setInsuranceCap(cap);
      })
      .catch(() => {
        if (!cancelled) setInsuranceCap(null);
      });
    return () => {
      cancelled = true;
    };
  }, [destinationCountry]);

  // Draft saving — lets staff save an in-progress shipment (any step) and resume it later via
  // /shipment/create?draft=<id>. A draft can only be edited/deleted while it's still a draft —
  // once successfully booked into a real Shipment, the draft is deleted (see handleConfirmBooking).
  const [draftId, setDraftId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [draftError, setDraftError] = useState("");
  const [loadingDraft, setLoadingDraft] = useState(false);

  // Every piece of state a staff member actually fills in across all 4 steps — restored as-is
  // when resuming a draft. Deliberately excludes purely-fetched reference data (agents,
  // countries, weightBands, addonItems, supplies, customerTypeOptions, etc.) and transient UI
  // state (modals, search box text, loading flags) that doesn't represent user input.
  function buildDraftSnapshot() {
    return {
      step,
      customerType,
      entityType,
      origin: {
        contactName: originContactName,
        customerId: originCustomerId,
        company: originCompany,
        taxId: originTaxId,
        postcode: originPostcode,
        city: originCity,
        address: originAddress,
        address2: originAddress2,
        address3: originAddress3,
        phone: originPhone,
        notes: originNotes,
      },
      destination: {
        contactName: destinationContactName,
        customerId: destinationCustomerId,
        company: destinationCompany,
        taxId: destinationTaxId,
        country: destinationCountry,
        city: destinationCity,
        postcode: destinationPostcode,
        address: destinationAddress,
        address2: destinationAddress2,
        address3: destinationAddress3,
        phone: destinationPhone,
        email: destinationEmail,
        notes: destinationNotes,
      },
      packages,
      activePackageKey,
      addonRows,
      stockSupplyId,
      selectedCarriers,
      // Rate Quotes/selected quote are live carrier API data (prices can go stale by the time the
      // draft is resumed) but restoring them still saves staff from re-running Check Rate for
      // every minor edit — they can always re-check if prices look out of date.
      results,
      selectedQuote,
      quotedDeclaredValues,
      paymentMethod,
      billTransportationTo,
      billDutyTaxTo,
      refInvoiceNo,
      refInsuranceNo,
      refPurchaseNo,
    };
  }

  // Draft payloads are our own serialized snapshots (see buildDraftSnapshot) — trusted shape,
  // just defensively guarded against missing/older fields so an older draft never crashes the page.
  function applyDraftSnapshot(raw: Record<string, unknown>) {
    const s = raw as Record<string, any>;
    if (s.step === 1 || s.step === 2 || s.step === 3 || s.step === 4) setStep(s.step);
    if (typeof s.customerType === "string") setCustomerType(s.customerType);
    if (s.entityType === "INDIVIDUAL" || s.entityType === "COMPANY") setEntityType(s.entityType);

    const o = s.origin ?? {};
    setOriginContactName(o.contactName ?? "");
    setOriginCustomerId(o.customerId ?? null);
    setOriginCompany(o.company ?? "");
    setOriginTaxId(o.taxId ?? "");
    setOriginPostcode(o.postcode ?? "");
    setOriginCity(o.city ?? "");
    setOriginAddress(o.address ?? "");
    setOriginAddress2(o.address2 ?? "");
    setOriginAddress3(o.address3 ?? "");
    setOriginPhone(o.phone ?? "");
    setOriginNotes(o.notes ?? "");

    const d = s.destination ?? {};
    setDestinationContactName(d.contactName ?? "");
    setDestinationCustomerId(d.customerId ?? null);
    setDestinationCompany(d.company ?? "");
    setDestinationTaxId(d.taxId ?? "");
    setDestinationCountry(d.country ?? "");
    setDestinationCity(d.city ?? "");
    setDestinationPostcode(d.postcode ?? "");
    setDestinationAddress(d.address ?? "");
    setDestinationAddress2(d.address2 ?? "");
    setDestinationAddress3(d.address3 ?? "");
    setDestinationPhone(d.phone ?? "");
    setDestinationEmail(d.email ?? "");
    setDestinationNotes(d.notes ?? "");

    if (Array.isArray(s.packages) && s.packages.length > 0) {
      setPackages(s.packages);
      setActivePackageKey(s.activePackageKey ?? s.packages[0]?.key ?? null);
      // Restored rows keep their original `key` values — bump the module-level sequence past the
      // highest one so any NEW row added later can never collide with a restored one.
      rowKeySeq = Math.max(rowKeySeq, ...s.packages.map((p: PackageRow) => p.key)) + 1;
    }
    if (Array.isArray(s.addonRows)) {
      setAddonRows(s.addonRows);
      if (s.addonRows.length > 0) {
        addonRowKeySeq = Math.max(addonRowKeySeq, ...s.addonRows.map((r: AddonRow) => r.key)) + 1;
      }
    }
    if (s.stockSupplyId !== undefined) setStockSupplyId(s.stockSupplyId);
    if (Array.isArray(s.selectedCarriers)) setSelectedCarriers(s.selectedCarriers);
    if (Array.isArray(s.results)) setResults(s.results);
    if (s.selectedQuote) setSelectedQuote(s.selectedQuote);
    if (s.quotedDeclaredValues) setQuotedDeclaredValues(s.quotedDeclaredValues);
    if (typeof s.paymentMethod === "string") setPaymentMethod(s.paymentMethod);
    if (typeof s.billTransportationTo === "string") setBillTransportationTo(s.billTransportationTo);
    if (typeof s.billDutyTaxTo === "string") setBillDutyTaxTo(s.billDutyTaxTo);
    if (typeof s.refInvoiceNo === "string") setRefInvoiceNo(s.refInvoiceNo);
    if (typeof s.refInsuranceNo === "string") setRefInsuranceNo(s.refInsuranceNo);
    if (typeof s.refPurchaseNo === "string") setRefPurchaseNo(s.refPurchaseNo);
  }

  useEffect(() => {
    const draftParam = searchParams.get("draft");
    if (!draftParam) return;
    const id = Number(draftParam);
    if (!Number.isFinite(id)) return;
    setLoadingDraft(true);
    getShipmentDraft(id)
      .then((draft) => {
        applyDraftSnapshot(draft.form_state);
        setDraftId(draft.id);
        setDraftName(draft.name ?? "");
      })
      .catch(() => setDraftError("โหลดฉบับร่างไม่สำเร็จ — อาจถูกลบไปแล้ว"))
      .finally(() => setLoadingDraft(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveDraft() {
    setSavingDraft(true);
    setDraftError("");
    setDraftMessage("");
    try {
      const payload = { name: draftName.trim() || undefined, form_state: buildDraftSnapshot() };
      const saved = draftId ? await updateShipmentDraft(draftId, payload) : await createShipmentDraft(payload);
      setDraftId(saved.id);
      setDraftMessage("บันทึกฉบับร่างเรียบร้อย");
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "บันทึกฉบับร่างไม่สำเร็จ");
    } finally {
      setSavingDraft(false);
    }
  }

  function updatePackage(key: number, patch: Partial<PackageRow>) {
    setPackages((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  // API_COST insurance (e.g. DHL's own) freezes its sell price from the LAST Check Rate's real
  // chargeBreakdown — editing Declared Value after that makes that frozen price stale (it no
  // longer reflects what the carrier would actually charge for the new value), so the selection
  // is cleared and staff must re-run Check Rate + reselect to get an accurate price.
  function updateDeclaredValue(pkg: PackageRow, declaredValue: number) {
    updatePackage(pkg.key, { declared_value: declaredValue });
    const selectedRow = addonRows.find((r) => r.packageKey === pkg.key && r.category === "Insurance");
    const selectedItem = selectedRow ? addonItems.find((i) => i.id === selectedRow.addonItemId) : undefined;
    if (selectedItem?.price_type === "API_COST" && quotedDeclaredValues[pkg.key] !== declaredValue) {
      setAddonRows((prev) => prev.filter((r) => !(r.packageKey === pkg.key && r.category === "Insurance")));
      alert("มูลค่าสินค้าที่แจ้งเปลี่ยนไป — ราคาประกันนี้อ้างอิงจากราคาจริงของ carrier ครั้งก่อน กรุณากด Check Rate ใหม่แล้วเลือกประกันอีกครั้งเพื่อราคาที่ถูกต้อง");
    }
  }

  function addPackage() {
    const row = newRow();
    setPackages((prev) => [...prev, row]);
    setActivePackageKey(row.key);
  }

  function removePackage(key: number) {
    setPackages((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((p) => p.key !== key);
      if (activePackageKey === key) setActivePackageKey(next[next.length - 1].key);
      return next;
    });
    // Drop any insurance row that was scoped to this package so it doesn't linger orphaned.
    setAddonRows((prev) => prev.filter((r) => r.packageKey !== key));
  }

  // Clicking a suggested catalog item quick-fills a new row — its name comes from the catalog
  // and is locked (not editable); only fully blank/custom rows (see addAddonRow) have a free-text name.
  // Insurance is never added through here — it's selected per package via selectPackageInsurance.
  function addAddonFromSuggestion(item: AddonItem) {
    // PERCENT items snapshot their price as Declared Value × rate at the moment they're added —
    // editing Declared Value afterwards does not retroactively change the row.
    const unitPrice =
      item.price_type === "FIXED"
        ? String(item.price ?? 0)
        : item.price_type === "PERCENT"
          ? (totalDeclaredValue * ((Number(item.price) || 0) / 100)).toFixed(2)
          : "";
    setAddonRows((prev) => [
      ...prev,
      newAddonRow({
        addonItemId: item.id,
        name: item.name,
        nameLocked: true,
        category: item.category?.name ?? "Other",
        carriers: item.carriers.join("/"),
        unitPrice,
        priceLocked: item.price_type === "FIXED" || item.price_type === "PERCENT",
      }),
    ]);
  }

  // Insurance is chosen PER PACKAGE (not shipment-wide) — different boxes in the same shipment
  // may use different insurers, and which items are even selectable is driven entirely by each
  // AddonItem's product_types/carriers/customer_types config (see getInsuranceOptionsForPackage) —
  // not hardcoded here. Each package may have at most one Insurance addon row, tagged with
  // packageKey; picking one clears that package's previous choice, picking the same one again deselects it.
  function selectPackageInsurance(pkg: PackageRow, item: AddonItem) {
    const alreadySelected = addonRows.some((r) => r.packageKey === pkg.key && r.addonItemId === item.id);
    if (alreadySelected) {
      setAddonRows((prev) => prev.filter((r) => !(r.packageKey === pkg.key && r.addonItemId === item.id)));
      return;
    }
    const isThirdParty = isThirdPartyInsuranceItem(item);
    if (isThirdParty && insuranceCap?.note) {
      alert(`ไม่สามารถขายประกันบุคคลที่สามสำหรับปลายทาง ${insuranceCap.country_name} ได้: ${insuranceCap.note}`);
      return;
    }
    // UPS does not cover Document shipments with its own insurance (ICDV) at all.
    if (!isThirdParty && selectedQuote?.carrier === "UPS" && pkg.is_document) {
      alert("UPS ไม่คุ้มครองพัสดุประเภทเอกสาร (Document) ด้วยประกันของ UPS เอง");
      return;
    }
    // API_COST's price is frozen from the last Check Rate's real chargeBreakdown — refuse to
    // (re)select it with a Declared Value that's changed since, instead of silently reusing a
    // stale carrier cost that no longer matches what was actually sent to Check Rate.
    if (item.price_type === "API_COST" && quotedDeclaredValues[pkg.key] !== (Number(pkg.declared_value) || 0)) {
      alert("มูลค่าสินค้าเปลี่ยนไปตั้งแต่เช็ค Rate ล่าสุด — กรุณากด Check Rate ใหม่ก่อนเลือกประกันนี้ เพื่อราคาที่ถูกต้อง");
      return;
    }

    // Third-party insurance (UPSC) is clamped to the destination country's max declared value
    // cap (per carrier), per /config/insurance-caps — see InsuranceCountryCap. Carrier-own
    // insurance (ICDV, DHL) is unaffected — its real price comes from that carrier's own API.
    const carrierMaxDeclared =
      selectedQuote?.carrier === "DHL"
        ? insuranceCap?.dhl_max_declared
        : selectedQuote?.carrier === "UPS"
          ? insuranceCap?.ups_max_declared
          : null;
    const rawDeclaredValue = Number(pkg.declared_value) || 0;
    const effectiveDeclaredValue =
      isThirdParty && carrierMaxDeclared != null ? Math.min(rawDeclaredValue, Number(carrierMaxDeclared)) : rawDeclaredValue;

    // Carrier-own insurance (ICDV/DHL) SELLING price still follows whatever is configured for
    // this item at /config/addon (FIXED/PERCENT/MANUAL). The real charge the carrier's own API
    // returned (UPS code "400", DHL code "II" for boxes / "IB" for documents) is kept separately
    // as our internal cost, purely for margin reference — it does NOT set the price.
    const dhlChargeCode = pkg.is_document ? "IB" : "II";
    const carrierInsuranceCharge = !isThirdParty
      ? selectedQuote?.chargeBreakdown?.find((c) => c.code === (selectedQuote.carrier === "DHL" ? dhlChargeCode : "400"))?.amount
      : undefined;

    const unitPrice =
      item.price_type === "FIXED"
        ? String(item.price ?? 0)
        : item.price_type === "PERCENT"
          ? (effectiveDeclaredValue * ((Number(item.price) || 0) / 100)).toFixed(2)
          : item.price_type === "API_COST"
            ? String(carrierInsuranceCharge ?? 0)
            : "";

    setAddonRows((prev) => [
      ...prev.filter((r) => !(r.category === "Insurance" && r.packageKey === pkg.key)),
      newAddonRow({
        addonItemId: item.id,
        name: item.name,
        nameLocked: true,
        category: item.category?.name ?? "Insurance",
        carriers: item.carriers.join("/"),
        unitPrice,
        priceLocked: item.price_type === "FIXED" || item.price_type === "PERCENT" || item.price_type === "API_COST",
        costPrice: carrierInsuranceCharge != null ? String(carrierInsuranceCharge) : undefined,
        packageKey: pkg.key,
      }),
    ]);
  }

  // Product Type is set per box; each Product Type has its own eligible Insurance items/rates
  // (configured at /config/addon via product_types) — if the box is already insured and the
  // currently-picked item no longer applies to the new Product Type (e.g. price differs between
  // Silver/Non Silver), auto-replace it with whatever now applies instead of leaving it stale.
  function setPackageProductType(key: number, productType: ProductType) {
    updatePackage(key, { productType });
    const pkg = packages.find((p) => p.key === key);
    if (!pkg?.insured) return;
    const { carrierOption, thirdPartyOption } = getInsuranceOptionsForPackage(productType);
    const selectedRow = addonRows.find((r) => r.packageKey === key && r.category === "Insurance");
    const stillEligible =
      !!selectedRow && (selectedRow.addonItemId === carrierOption?.id || selectedRow.addonItemId === thirdPartyOption?.id);
    if (stillEligible) return;
    applyDefaultInsurer(pkg, productType, carrierOption, thirdPartyOption);
  }

  // Silver defaults to UPSC (third-party) first; every other Product Type defaults to the
  // carrier's own insurance — either way falls back to whichever option is actually available.
  function applyDefaultInsurer(
    pkg: PackageRow,
    productType: ProductType,
    carrierOption: ReturnType<typeof getInsuranceOptionsForPackage>["carrierOption"],
    thirdPartyOption: ReturnType<typeof getInsuranceOptionsForPackage>["thirdPartyOption"],
  ) {
    const preferred = productType === "SILVER" ? thirdPartyOption ?? carrierOption : carrierOption ?? thirdPartyOption;
    if (preferred) selectPackageInsurance(pkg, preferred);
    else setAddonRows((prev) => prev.filter((r) => !(r.packageKey === pkg.key && r.category === "Insurance")));
  }

  // A checked "Insurance" box must never end up with no insurer/charge actually selected.
  function autoSelectPackageInsurer(pkg: PackageRow) {
    const { carrierOption, thirdPartyOption } = getInsuranceOptionsForPackage(pkg.productType);
    applyDefaultInsurer(pkg, pkg.productType, carrierOption, thirdPartyOption);
  }

  function addAddonFromSupply(supply: Supply) {
    setAddonRows((prev) => [
      ...prev,
      newAddonRow({
        name: supply.name,
        nameLocked: true,
        category: "Packing Supplies",
        unitPrice: String(supply.sale_price ?? 0),
        priceLocked: true,
      }),
    ]);
  }

  function addAddonRow() {
    // A blank custom row belongs to whichever tab is currently active, not a fixed "Other" bucket.
    const category = activeAddonCategory === SUPPLIES_TAB ? "Packing Supplies" : activeAddonCategory;
    setAddonRows((prev) => [...prev, newAddonRow({ category })]);
  }

  function updateAddonRow(key: number, patch: Partial<AddonRow>) {
    setAddonRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeAddonRow(key: number) {
    setAddonRows((prev) => prev.filter((r) => r.key !== key));
  }

  // Finds a 5-digit Thai zip code in the pasted text and looks up its subdistrict/district/province.
  async function handleAutoFillApply() {
    setAutoFillError("");
    const zipMatch = autoFillText.match(/\b\d{5}\b/);
    if (!zipMatch) {
      setAutoFillError("Could not find a 5-digit postcode in the pasted text.");
      return;
    }
    try {
      const matches = await getThaiSubdistrictsByZipCode(zipMatch[0]);
      if (matches.length === 0) {
        setAutoFillError(`No subdistrict found for postcode ${zipMatch[0]}.`);
        return;
      }
      const row = matches[0];
      setOriginPostcode(row.zip_code);
      setOriginCity(row.district_name_en ?? row.district_name_th);
      setOriginSearchValue(`${row.name_en}, ${row.district_name_en}, ${row.province_name_en} - ${row.zip_code}`);
      setOriginLookup({
        status: "found",
        label: `${row.name_en}, ${row.district_name_en}, ${row.province_name_en}`,
      });
      setOriginAddress(autoFillText.trim());
      setShowAutoFill(false);
      setAutoFillText("");
    } catch {
      setAutoFillError("Failed to look up the postcode. Please try again.");
    }
  }

  // AI-powered address parsing — works for both Ship From and Ship To, and unlike the
  // Thai-postcode regex above, can handle messy/international addresses in any language.
  async function handleAiFillApply() {
    if (!aiFillTarget || !aiFillText.trim()) return;
    setAiFillLoading(true);
    setAiFillError("");
    try {
      const fields = await parseAddressWithAi(aiFillText.trim());
      if (aiFillTarget === "from") {
        if (fields.contact_name) {
          setOriginContactName(fields.contact_name);
          setOriginCustomerId(null);
        }
        if (fields.company) setOriginCompany(fields.company);
        if (fields.address1) setOriginAddress(fields.address1);
        if (fields.address2) setOriginAddress2(fields.address2);

        // Ship From is always a Thai domestic address, so resolve the real
        // subdistrict/district/province record for the postcode (like the manual
        // ThaiAddressSearch picker does) instead of just echoing the AI's city/province guess,
        // which drops the subdistrict/district entirely.
        let matchedSubdistrict = false;
        const zip = fields.postal_code?.replace(/\D/g, "");
        if (zip && zip.length === 5) {
          try {
            const matches = await getThaiSubdistrictsByZipCode(zip);
            if (matches.length > 0) {
              // The DB's English names carry an admin-level prefix (e.g. "Khwaeng Phlapphla",
              // "Khet Wang Thonglang") the AI's bare "Phlapphla"/"Wang Thonglang" doesn't have —
              // strip it before comparing, otherwise it skews substring/fuzzy matching.
              const stripAdminPrefix = (s: string) =>
                s.replace(/^(khwaeng|tambon|khet|amphoe|king amphoe|changwat)\s+/i, "").replace(/^(แขวง|ตำบล|เขต|อำเภอ|จังหวัด)/, "");
              const normalize = (s: string) => stripAdminPrefix(s).toLowerCase().replace(/[^a-z0-9ก-๙]/g, "");
              const subHint = normalize(fields.subdistrict ?? "");
              const districtHint = normalize(fields.district ?? "");

              // Narrow to the matching district first (several subdistricts can share a
              // postcode), then find the closest subdistrict within that pool — falling back
              // to a fuzzy (edit-distance) match to tolerate romanization spelling variance.
              const districtPool = districtHint
                ? matches.filter((m) => {
                    const dist = normalize(m.district_name_en ?? m.district_name_th);
                    return dist !== "" && (districtHint.includes(dist) || dist.includes(districtHint));
                  })
                : [];
              const pool = districtPool.length > 0 ? districtPool : matches;

              let row = subHint
                ? pool.find((m) => {
                    const sub = normalize(m.name_en ?? m.name_th);
                    return sub !== "" && (subHint.includes(sub) || sub.includes(subHint));
                  })
                : undefined;

              if (!row && subHint) {
                let bestDistance = Infinity;
                for (const candidate of pool) {
                  const sub = normalize(candidate.name_en ?? candidate.name_th);
                  if (!sub) continue;
                  const distance = levenshteinDistance(subHint, sub);
                  if (distance < bestDistance) {
                    bestDistance = distance;
                    row = candidate;
                  }
                }
                if (bestDistance > Math.max(2, Math.ceil(subHint.length * 0.3))) row = undefined;
              }

              row = row ?? pool[0];
              setOriginPostcode(row.zip_code);
              setOriginCity(row.district_name_en ?? row.district_name_th);
              setOriginSearchValue(`${row.name_en}, ${row.district_name_en}, ${row.province_name_en} - ${row.zip_code}`);
              setOriginLookup({
                status: "found",
                label: `${row.name_en}, ${row.district_name_en}, ${row.province_name_en}`,
              });
              matchedSubdistrict = true;
            }
          } catch {
            // fall through to the plain city/province fallback below
          }
        }
        if (!matchedSubdistrict) {
          const cityLabel = fields.city || fields.province;
          if (cityLabel) {
            setOriginCity(cityLabel);
            setOriginSearchValue([cityLabel, fields.province, fields.postal_code].filter(Boolean).join(", "));
          }
          if (fields.postal_code) setOriginPostcode(fields.postal_code);
        }
        if (fields.phone) setOriginPhone(fields.phone);
      } else {
        if (fields.contact_name) {
          setDestinationContactName(fields.contact_name);
          setDestinationCustomerId(null);
        }
        if (fields.company) setDestinationCompany(fields.company);
        if (fields.address1) setDestinationAddress(fields.address1);
        if (fields.address2) setDestinationAddress2(fields.address2);
        if (fields.city || fields.province) setDestinationCity(fields.city || fields.province || "");
        if (fields.postal_code) setDestinationPostcode(fields.postal_code);
        if (fields.phone) setDestinationPhone(fields.phone);
        if (fields.email) setDestinationEmail(fields.email);
        if (fields.country_iso2) {
          const match = countries.find((c) => c.iso2.toLowerCase() === fields.country_iso2!.toLowerCase() && c.status);
          if (match) setDestinationCountry(match.iso2);
        }
      }
      setAiFillTarget(null);
      setAiFillText("");
    } catch (err) {
      setAiFillError(err instanceof Error ? err.message : "AI parsing failed. Please try again.");
    } finally {
      setAiFillLoading(false);
    }
  }

  // Saves the currently-typed Ship From/Ship To fields as a reusable customer address — finds
  // an existing customer by phone (best-effort match) so repeat customers don't get duplicated,
  // otherwise creates a new one. Does NOT block/alter the shipment form itself.
  //
  // Rules: (1) the same customer may have several addresses, but never an exact duplicate
  // (all fields equal) — silently skip saving if one already matches; (2) if the user picked a
  // saved address from the picker and then edited any field, that no longer matches an existing
  // record, so it's saved as a brand-new address instead of overwriting the original; (3) saved
  // addresses can only ever be EDITED from the Customers menu — this flow only ever creates.
  async function autoSaveAddress(target: "from" | "to") {
    const contactName = (target === "from" ? originContactName : destinationContactName).trim();
    if (!contactName) return;

    const type: CustomerAddressType = target === "from" ? "ship_from" : "ship_to";
    const fields = {
      contact_name: contactName,
      company_name: (target === "from" ? originCompany : destinationCompany).trim(),
      tax_id: (target === "from" ? originTaxId : destinationTaxId).trim(),
      phone: (target === "from" ? originPhone : destinationPhone).trim(),
      email: (target === "from" ? "" : destinationEmail).trim(),
      country: (target === "from" ? "TH" : destinationCountry).trim(),
      city: (target === "from" ? originCity : destinationCity).trim(),
      postcode: (target === "from" ? originPostcode : destinationPostcode).trim(),
      address1: (target === "from" ? originAddress : destinationAddress).trim(),
      address2: (target === "from" ? originAddress2 : destinationAddress2).trim(),
      address3: (target === "from" ? originAddress3 : destinationAddress3).trim(),
      notes: (target === "from" ? originNotes : destinationNotes).trim(),
    };

    try {
      // Prefer the customer the user actually picked from the saved-address search — matching
      // by phone alone fails when the saved address itself had a blank phone field. Only fall
      // back to a phone lookup / new customer when nothing was explicitly selected.
      let customerId: number | null = target === "from" ? originCustomerId : destinationCustomerId;
      if (!customerId && fields.phone) {
        const matches = await listCustomers(fields.phone);
        customerId = matches.find((c) => c.phone === fields.phone)?.id ?? null;
      }
      if (!customerId) {
        const customer = await createCustomer({
          name: fields.contact_name,
          company_name: fields.company_name || undefined,
          tax_id: fields.tax_id || undefined,
          phone: fields.phone || undefined,
          email: fields.email || undefined,
        });
        customerId = customer.id;
      }

      const existing = await listCustomerAddresses(customerId, type);
      const norm = (v: string | null) => (v ?? "").trim().toLowerCase();
      const isDuplicate = existing.some(
        (addr) =>
          norm(addr.contact_name) === norm(fields.contact_name) &&
          norm(addr.company_name) === norm(fields.company_name) &&
          norm(addr.tax_id) === norm(fields.tax_id) &&
          norm(addr.phone) === norm(fields.phone) &&
          norm(addr.email) === norm(fields.email) &&
          norm(addr.country) === norm(fields.country) &&
          norm(addr.city) === norm(fields.city) &&
          norm(addr.postcode) === norm(fields.postcode) &&
          norm(addr.address1) === norm(fields.address1) &&
          norm(addr.address2) === norm(fields.address2) &&
          norm(addr.address3) === norm(fields.address3) &&
          norm(addr.notes) === norm(fields.notes),
      );
      if (isDuplicate) return;

      await createCustomerAddress(customerId, {
        type,
        contact_name: fields.contact_name,
        company_name: fields.company_name || undefined,
        tax_id: fields.tax_id || undefined,
        phone: fields.phone || undefined,
        email: fields.email || undefined,
        country: fields.country || undefined,
        city: fields.city || undefined,
        postcode: fields.postcode || undefined,
        address1: fields.address1 || undefined,
        address2: fields.address2 || undefined,
        address3: fields.address3 || undefined,
        notes: fields.notes || undefined,
      });
    } catch {
      // Best-effort background save — never block or surface errors on the shipment flow.
    }
  }

  // Fills the Ship From/Ship To form from a picked saved customer address.
  function applyCustomerAddress(target: "from" | "to", addr: CustomerAddressWithCustomer) {
    if (target === "from") {
      setOriginContactName(addr.contact_name);
      setOriginCustomerId(addr.customer_id);
      setOriginCompany(addr.company_name ?? "");
      setOriginTaxId(addr.tax_id ?? "");
      setOriginPhone(addr.phone ?? "");
      setOriginCity(addr.city ?? "");
      setOriginPostcode(addr.postcode ?? "");
      setOriginAddress(addr.address1 ?? "");
      setOriginAddress2(addr.address2 ?? "");
      setOriginAddress3(addr.address3 ?? "");
      setOriginNotes(addr.notes ?? "");
      setOriginSearchValue(
        [addr.city, addr.postcode].filter(Boolean).join(" - "),
      );
    } else {
      setDestinationContactName(addr.contact_name);
      setDestinationCustomerId(addr.customer_id);
      setDestinationCompany(addr.company_name ?? "");
      setDestinationTaxId(addr.tax_id ?? "");
      setDestinationPhone(addr.phone ?? "");
      setDestinationEmail(addr.email ?? "");
      if (addr.country) setDestinationCountry(addr.country);
      setDestinationCity(addr.city ?? "");
      setDestinationPostcode(addr.postcode ?? "");
      setDestinationAddress(addr.address1 ?? "");
      setDestinationAddress2(addr.address2 ?? "");
      setDestinationAddress3(addr.address3 ?? "");
      setDestinationNotes(addr.notes ?? "");
    }
  }

  // The currently "active" (unlocked) package row — used to decide whether to show the
  // Common Sizes guide / dimension fields, since box vs document is now chosen per row.
  const activeRow = packages.find((p) => p.key === activePackageKey) ?? packages[0];

  // Shipment Weight Range — auto-matched from total weight (legacy system required manually
  // picking this from a radio list; here it's derived automatically instead). A supply box
  // linked to a fixed Weight Range (e.g. CPM10/CPM25) always overrides the weight-based match,
  // even if the actual total weight doesn't reach that band's threshold.
  const totalShipmentWeight = packages.reduce((sum, p) => sum + (Number(p.weight) || 0) * (Number(p.quantity) || 1), 0);
  const overallPackageType: "box" | "document" = packages.every((p) => p.is_document) ? "document" : "box";
  const forcedBandIds = packages.map((p) => p.forcedWeightBandId).filter((id): id is number => !!id);
  const matchedWeightBand =
    pickForcedWeightBand(weightBands, forcedBandIds) ?? matchProductWeightBand(weightBands, totalShipmentWeight, overallPackageType);

  // Applying a stock size only fills in the dimensions as a guide — it does not add a purchase.
  // Targets whichever package row is currently "active" (unlocked), not always the first one.
  // If the supply is linked to a fixed Weight Range (CPM10/CPM25), that row now forces it.
  function applyStockSize(supply: Supply) {
    setStockSupplyId(supply.id);
    const targetKey = activePackageKey ?? packages[0].key;
    updatePackage(targetKey, {
      weight: Number(supply.weight) || packages.find((p) => p.key === targetKey)?.weight,
      length: Number(supply.length) || undefined,
      width: Number(supply.width) || undefined,
      height: Number(supply.height) || undefined,
      is_document: false,
      forcedWeightBandId: supply.weight_band_id ?? null,
    });
  }

  // Show the admin-pinned "Common Sizes" guide (max 6, configured in /config/supplies);
  // fall back to the first 3 supplies if none are pinned yet. Search reveals everything.
  const featuredSupplies = supplies.filter((s) => s.is_featured);
  const visibleSupplies = supplySearch.trim()
    ? supplies.filter(
        (s) =>
          s.name.toLowerCase().includes(supplySearch.trim().toLowerCase()) ||
          (s.description ?? "").toLowerCase().includes(supplySearch.trim().toLowerCase()),
      )
    : featuredSupplies.length > 0
      ? featuredSupplies
      : supplies.slice(0, 3);

  async function handleSubmit() {
    setError("");
    setResults(null);

    if (!originPostcode.trim() || !originCity.trim() || !originAddress.trim()) {
      setError("Please fill in the origin postcode, city, and address (Thailand).");
      return;
    }
    if (!destinationCity.trim()) {
      setError("Please fill in the destination city.");
      return;
    }

    // Auto-save Ship From/Ship To as reusable customer addresses — fire-and-forget so a slow
    // or failed save never blocks/delays the rate check itself (see autoSaveAddress for the
    // dedup rules: never overwrites, only creates a new address when something doesn't match).
    void autoSaveAddress("from");
    void autoSaveAddress("to");

    const effectivePackages: ShipmentPackageInput[] = packages.map((p) => {
      // The carrier's own Declared Value/insurance charge (baked into Freight) is only ever used
      // as a COST reference now, never the actual sell price — so it's fine to send for every
      // Product Type; the real sell price is computed separately from the Insurance Add-on item.
      const sendDeclaredValue = p.insured;
      return p.is_document
        ? {
            weight: p.weight,
            quantity: p.quantity,
            description: p.description,
            is_document: true,
            declared_value: sendDeclaredValue ? p.declared_value : undefined,
          }
        : {
            weight: p.weight,
            length: p.length,
            width: p.width,
            height: p.height,
            quantity: p.quantity,
            description: p.description,
            is_document: false,
            declared_value: sendDeclaredValue ? p.declared_value : undefined,
          };
    });

    const payload: CheckRateInput = {
      origin_contact_name: originContactName.trim() || undefined,
      origin_company: originCompany.trim() || undefined,
      origin_postcode: originPostcode.trim(),
      origin_city: originCity.trim(),
      origin_address: originAddress.trim(),
      origin_address2: originAddress2.trim() || undefined,
      origin_address3: originAddress3.trim() || undefined,
      origin_phone: originPhone.trim() || undefined,
      destination_contact_name: destinationContactName.trim() || undefined,
      destination_company: destinationCompany.trim() || undefined,
      destination_country: destinationCountry,
      destination_city: destinationCity.trim(),
      destination_postcode: destinationPostcode.trim() || undefined,
      destination_address: destinationAddress.trim() || undefined,
      destination_address2: destinationAddress2.trim() || undefined,
      destination_address3: destinationAddress3.trim() || undefined,
      destination_phone: destinationPhone.trim() || undefined,
      destination_email: destinationEmail.trim() || undefined,
      packages: effectivePackages,
      declared_value_currency: "THB",
      carriers: selectedCarriers,
    };

    setLoading(true);
    try {
      const res = await checkRate(payload);
      setResults(res.results);
      const cheapest = res.results
        .filter((r) => !r.error)
        .sort((a, b) => (a.negotiated ?? a.published ?? Infinity) - (b.negotiated ?? b.published ?? Infinity))[0];
      setSelectedQuote(cheapest ?? null);
      setQuotedDeclaredValues(Object.fromEntries(packages.map((p) => [p.key, Number(p.declared_value) || 0])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check rate. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Builds the real booking payload from the currently selected quote + everything typed in the
  // wizard so far — null if there's no selected quote yet (booking is impossible without one).
  function buildBookingPayload(): BookShipmentInput | null {
    if (!selectedQuote) return null;

    return {
      agent_account_id: selectedQuote.accountId,
      carrier: selectedQuote.carrier,
      service_code: selectedQuote.serviceCode ?? "",
      service_label: selectedQuote.serviceLabel,
      origin: {
        contact_name: originContactName.trim() || undefined,
        company: originCompany.trim() || undefined,
        tax_id: originTaxId.trim() || undefined,
        postcode: originPostcode.trim(),
        city: originCity.trim(),
        address: originAddress.trim(),
        address2: originAddress2.trim() || undefined,
        address3: originAddress3.trim() || undefined,
        phone: originPhone.trim() || undefined,
        notes: originNotes.trim() || undefined,
      },
      destination: {
        contact_name: destinationContactName.trim() || undefined,
        company: destinationCompany.trim() || undefined,
        tax_id: destinationTaxId.trim() || undefined,
        country: destinationCountry,
        city: destinationCity.trim(),
        postcode: destinationPostcode.trim() || undefined,
        address: destinationAddress.trim() || undefined,
        address2: destinationAddress2.trim() || undefined,
        address3: destinationAddress3.trim() || undefined,
        phone: destinationPhone.trim() || undefined,
        email: destinationEmail.trim() || undefined,
        notes: destinationNotes.trim() || undefined,
      },
      packages: packages.map((p) => {
        // Which Insurance item was sold for THIS package — lets the backend tell the carrier
        // apart from third-party UPSC (see ShipmentController::store's useCarrierInsurance).
        const insuranceRow = addonRows.find((r) => r.packageKey === p.key && r.category === "Insurance");
        return {
          weight: p.weight,
          length: p.is_document ? undefined : p.length,
          width: p.is_document ? undefined : p.width,
          height: p.is_document ? undefined : p.height,
          quantity: p.quantity,
          description: p.description || undefined,
          is_document: p.is_document,
          declared_value: p.insured ? Number(p.declared_value) || 0 : undefined,
          insured: p.insured,
          product_type: p.productType,
          product_type_other: p.productTypeOther || undefined,
          insurance_addon_item_id: insuranceRow?.addonItemId ?? null,
        };
      }),
      declared_value_currency: "THB",
      addon_lines: addonRows.map((row) => ({
        name: row.name,
        category: row.category,
        quantity: row.quantity,
        unit_price: Number(row.unitPrice) || 0,
      })),
      freight_amount: freightAmount,
      addon_total: addonTotal,
      order_total: orderTotal,
      currency: selectedQuote.currency ?? "THB",
      customer_type: customerType,
      entity_type: entityType,
      payment_method: paymentMethod || undefined,
      bill_transportation_to: billTransportationTo || undefined,
      bill_duty_tax_to: billDutyTaxTo || undefined,
      ref_invoice_no: refInvoiceNo.trim() || undefined,
      ref_insurance_no: refInsuranceNo.trim() || undefined,
      ref_purchase_no: refPurchaseNo.trim() || undefined,
      rate_quote: selectedQuote,
    };
  }

  async function handleConfirmBooking() {
    const payload = buildBookingPayload();
    if (!payload) return;

    setBooking(true);
    setBookingError("");
    try {
      const shipment = await bookShipment(payload);
      setBookedShipment(shipment);
      // A draft can only be edited while no Shipment has been created from it yet — once booked,
      // delete it so it can never be resumed/edited again (best-effort; a failure here shouldn't
      // block the already-successful booking from being shown to staff).
      if (draftId) {
        deleteShipmentDraft(draftId)
          .then(() => setDraftId(null))
          .catch(() => {});
      }
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "สร้าง Shipment ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBooking(false);
    }
  }

  async function handleOpenLabel() {
    if (!bookedShipment) return;
    setOpeningLabel(true);
    try {
      await openShipmentLabel(bookedShipment.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "เปิด Label ไม่สำเร็จ");
    } finally {
      setOpeningLabel(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";
  const labelClass = "text-sm font-medium text-slate-600";

  const okResults = (results ?? []).filter((r) => !r.error).sort((a, b) => (a.negotiated ?? a.published ?? Infinity) - (b.negotiated ?? b.published ?? Infinity));

  const addonByCategory = addonItems.reduce<Record<string, AddonItem[]>>((acc, item) => {
    const key = item.category?.name ?? "Other";
    acc[key] = acc[key] ? [...acc[key], item] : [item];
    return acc;
  }, {});
  const addonCategoryNames = Object.keys(addonByCategory);
  // Product Type (Silver/Non Silver) and Insurance are both selected in the Packages section
  // (Step 2), not the Add-on catalog tabs — hide their tabs to avoid a second, redundant control.
  const addonTabCategoryNames = addonCategoryNames.filter((c) => c !== "Product Type" && c !== "Insurance");
  // Suggestions are capped to 4 per tab so the list stays compact — searching (any text) lifts the cap.
  const MAX_SUGGESTIONS = 4;
  const isAddonSearching = addonSearch.trim().length > 0;
  const matchingSupplySuggestions = supplies.filter(
    (s) => !isAddonSearching || s.name.toLowerCase().includes(addonSearch.trim().toLowerCase()),
  );
  const visibleSupplySuggestions = isAddonSearching ? matchingSupplySuggestions : matchingSupplySuggestions.slice(0, MAX_SUGGESTIONS);
  const matchingAddonSuggestions =
    activeAddonCategory === SUPPLIES_TAB
      ? []
      : (addonByCategory[activeAddonCategory] ?? []).filter((item) => {
          // Silently limited to the selected Rate Quote's carrier — no items for a carrier the
          // customer didn't book with (e.g. hide DHL-only add-ons once a UPS quote is selected).
          const matchesCarrier = !selectedQuote || item.carriers.includes(selectedQuote.carrier);
          // Some items (e.g. Insurance) have a different rate per Customer Type — only the
          // variant configured for the currently selected Customer Type is shown.
          const matchesCustomerType = !item.customer_types?.length || item.customer_types.includes(customerType);
          const matchesSearch = !isAddonSearching || item.name.toLowerCase().includes(addonSearch.trim().toLowerCase());
          return matchesCarrier && matchesCustomerType && matchesSearch;
        });
  const visibleAddonSuggestions = isAddonSearching ? matchingAddonSuggestions : matchingAddonSuggestions.slice(0, MAX_SUGGESTIONS);

  // Insurance is rendered as a pick-one control, not a multi-add list — computed independent of
  // the currently active Add-on tab so it can also surface in the Packages card (Step 2), before
  // the customer ever visits the Add-on tab. Requires a selected Rate Quote so the carrier-own
  // option always matches the booked carrier (UPS → ICDV, DHL → DHL API) — never an arbitrary pick.
  const isInsuranceCategory = activeAddonCategory === "Insurance";
  // Scoped PER PACKAGE (not just carrier/customer type) — an Insurance item configured with
  // product_types at /config/addon only shows up for boxes with a matching Product Type
  // (Silver/Non Silver/Other), letting admins price/restrict insurance differently per type.
  function getInsuranceOptionsForPackage(productType: ProductType) {
    const items = selectedQuote
      ? (addonByCategory["Insurance"] ?? []).filter((item) => {
          const matchesCarrier = item.carriers.includes(selectedQuote.carrier);
          const matchesCustomerType = !item.customer_types?.length || item.customer_types.includes(customerType);
          const matchesProductType = !item.product_types?.length || (productType != null && item.product_types.includes(productType));
          return matchesCarrier && matchesCustomerType && matchesProductType;
        })
      : [];
    return {
      carrierOption: items.find((i) => !isThirdPartyInsuranceItem(i)) ?? null,
      thirdPartyOption: items.find((i) => isThirdPartyInsuranceItem(i)) ?? null,
    };
  }

  // POS-style order summary (Step 3) — itemized freight + insurance + add-ons, mirroring a checkout receipt.
  // Note: stockSupplyId (Common Sizes in the Packages step) is only a dimension-filling guide — it
  // is NOT a purchase and must never be charged here. Packaging only costs money once it's
  // explicitly added as an Add-on row (see addAddonFromSupply), which already flows through addonLines below.
  const selectedQuoteLogo = selectedQuote ? agents.find((a) => a.agent_code === selectedQuote.carrier)?.logo_url : undefined;
  // The carrier's own quoted total includes ITS OWN real Declared Value/insurance charge
  // (DHL codes "II" for boxes / "IB" for documents, UPS code "400") baked into Freight —
  // that's cost-reference only (see selectPackageInsurance), the customer is billed for
  // insurance ONLY via the separate Insurance Add-on line below, so it must be subtracted here
  // to avoid double-charging.
  function getSellFreightAmount(r: RateQuote) {
    const costOnlyCodes = r.carrier === "DHL" ? ["II", "IB"] : ["400"];
    const costOnlyAmount = (r.chargeBreakdown ?? [])
      .filter((c) => c.code && costOnlyCodes.includes(c.code))
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
    const rawTotal = r.negotiated ?? r.published ?? 0;
    return { sellAmount: rawTotal - costOnlyAmount, costOnlyCodes };
  }
  const { sellAmount: freightAmount, costOnlyCodes: carrierCostOnlyCodes } = selectedQuote
    ? getSellFreightAmount(selectedQuote)
    : { sellAmount: 0, costOnlyCodes: [] as string[] };
  // Whether ANY package is actually selling the carrier's own insurance (API_COST, e.g. DHL
  // Declared Value) — if every insured package uses third-party UPSC instead, the carrier's own
  // insurance cost line in chargeBreakdown is pure noise (never charged, never "bought") and
  // showing it next to an "excluded from sell total" note only invites confusion about whether
  // it was purchased.
  const sellingCarrierOwnInsurance = addonRows.some(
    (row) => row.category === "Insurance" && addonItems.find((i) => i.id === row.addonItemId)?.price_type === "API_COST",
  );
  const addonLines = addonRows.map((row) => ({
    row,
    amount: row.quantity * (Number(row.unitPrice) || 0),
  }));
  const addonTotal = addonLines.reduce((sum, l) => sum + l.amount, 0);
  // Once added, order-table rows are grouped into sections by their category — Packing Supplies
  // first, then catalog categories in their configured order, then any leftover category.
  const addonRowCategoryOrder = ["Packing Supplies", ...addonCategoryNames.filter((c) => c !== "Packing Supplies")];
  const activeAddonCategoryName = activeAddonCategory === SUPPLIES_TAB ? "Packing Supplies" : activeAddonCategory;
  const addonLinesByCategory = addonRowCategoryOrder
    .map((category) => ({ category, lines: addonLines.filter((l) => (l.row.category || "Other") === category) }))
    .concat(
      Array.from(new Set(addonLines.map((l) => l.row.category || "Other")))
        .filter((category) => !addonRowCategoryOrder.includes(category))
        .map((category) => ({ category, lines: addonLines.filter((l) => (l.row.category || "Other") === category) })),
    )
    // Only the currently active tab's section renders — switching tabs shouldn't dump every
    // category's items on screen at once.
    .filter((section) => section.category === activeAddonCategoryName);
  const orderTotal = freightAmount + addonTotal;

  // Shared between the Payment Info and Add On steps so the running total stays visible on both.
  const orderSummaryPanel = (
    <div className="sticky top-4 flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Receipt className="h-4 w-4" /> Order Summary
        </h2>

        <div className="mb-3 grid grid-cols-1 gap-2 text-xs">
          <div>
            <span className="font-medium uppercase tracking-wide text-slate-400">Staff / Branch</span>
            <p className="text-slate-600">{currentUser?.name || "-"}</p>
            <p className="text-slate-400">{currentUserBranchLabel}</p>
          </div>
          <div>
            <span className="font-medium uppercase tracking-wide text-slate-400">Ship From</span>
            <p className="text-slate-600">{originContactName || "-"}</p>
            <p className="text-slate-400">{[originAddress, originCity].filter(Boolean).join(", ") || "-"}</p>
          </div>
          <div>
            <span className="font-medium uppercase tracking-wide text-slate-400">Ship To</span>
            <p className="text-slate-600">{destinationContactName || "-"}</p>
            <p className="text-slate-400">
              {[destinationAddress, destinationCity, countries.find((c) => c.iso2 === destinationCountry)?.name]
                .filter(Boolean)
                .join(", ") || "-"}
            </p>
          </div>
          <div>
            <span className="font-medium uppercase tracking-wide text-slate-400">Packages</span>
            {packages.map((p, idx) => (
              <p key={p.key} className="text-slate-600">
                #{idx + 1} {p.is_document ? "Document" : `${p.length}x${p.width}x${p.height} cm`}, {p.weight}kg x{p.quantity}
                {!p.is_document && (
                  <>
                    {" — "}
                    {p.productType === "SILVER"
                      ? "Silver"
                      : p.productType === "NON_SILVER"
                        ? "Non Silver"
                        : p.productType === "OTHER"
                          ? `Other${p.productTypeOther ? `: ${p.productTypeOther}` : ""}`
                          : "-"}
                  </>
                )}
                {p.insured && <span className="text-emerald-600"> · Insured</span>}
              </p>
            ))}
          </div>
        </div>

        {selectedQuote ? (
          <div className="rounded-xl border border-brand-amber bg-amber-50/60 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedQuoteLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedQuoteLogo} alt={selectedQuote.carrier} className="h-5 w-auto object-contain" />
                ) : (
                  <Tag className="h-4 w-4 text-slate-300" />
                )}
                <span className="text-sm font-semibold text-slate-700">{selectedQuote.carrier}</span>
              </div>
              <span className="text-sm font-bold text-brand-navy-dark">
                {freightAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {selectedQuote.currency}
              </span>
            </div>
            <p className="text-xs text-slate-500">{selectedQuote.serviceLabel}</p>
            <p className="text-[11px] text-slate-400">
              Account: <span className="font-medium text-slate-500">{selectedQuote.username}</span>
              {selectedQuote.zone && (
                <>
                  {" "}
                  · Zone <span className="font-medium text-slate-500">{selectedQuote.zone}</span>
                </>
              )}
            </p>
            {selectedQuote.chargeBreakdown && selectedQuote.chargeBreakdown.length > 0 && (
              <div className="mt-2 flex flex-col gap-0.5 border-t border-amber-100 pt-2">
                <p className="text-[11px] text-slate-400">
                  รายการด้านล่างคือค่าใช้จ่ายจริงที่ {selectedQuote.carrier} เรียกเก็บ (ต้นทุน) — ยอดด้านบนหักรายการ{" "}
                  {carrierCostOnlyCodes.join(", ")} ออกแล้ว เพราะประกันคิดแยกเป็น Insurance Add-on ต่างหาก ไม่คิดซ้ำในค่า Freight
                </p>
                {selectedQuote.chargeBreakdown
                  .filter((line) => sellingCarrierOwnInsurance || !carrierCostOnlyCodes.includes(line.code ?? ""))
                  .map((line, li) => {
                  const isCarrierInsuranceLine = carrierCostOnlyCodes.includes(line.code ?? "");
                  return (
                    <div key={li} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {line.description}
                        {line.code ? <span className="text-slate-300"> ({line.code})</span> : null}
                        {isCarrierInsuranceLine && (
                          <span className="ml-1 text-amber-600">— ต้นทุน ไม่รวมในยอดขาย Freight ด้านบน</span>
                        )}
                      </span>
                      <span className="font-medium text-slate-600">
                        {line.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {line.currency}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">
            ยังไม่ได้เลือกบริการขนส่ง — กลับไปเลือกที่หน้า Product &amp; Rate
          </p>
        )}

        <div className="mt-3 flex flex-col gap-1.5 border-t border-dashed border-slate-200 pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-500">
              {selectedQuoteLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedQuoteLogo} alt={selectedQuote?.carrier} className="h-4 w-auto object-contain" />
              )}
              Freight ({selectedQuote?.carrier ?? "-"})
            </span>
            <span className="font-medium text-slate-700">{freightAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} THB</span>
          </div>
          {addonLines.map(({ row, amount }) => (
            <div key={row.key} className="flex items-center justify-between">
              <span className="text-slate-500">
                Add-on: {row.name || "(unnamed)"}
                {row.packageKey != null && ` (Package #${packages.findIndex((p) => p.key === row.packageKey) + 1})`}
              </span>
              <span className="font-medium text-slate-700">{amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} THB</span>
            </div>
          ))}
          {freightAmount === 0 && addonLines.length === 0 && <p className="text-xs text-slate-400">ยังไม่มีรายการ</p>}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-sm font-semibold text-slate-700">Total</span>
          <span className="text-lg font-bold text-brand-navy-dark">
            {orderTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })} THB
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-1 border-t border-dashed border-slate-200 pt-3 text-xs">
          <span className="font-medium uppercase tracking-wide text-slate-400">Payment / Reference</span>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Payment Method</span>
            <span className="font-medium text-slate-700">{paymentOptions.find((o) => o.code === paymentMethod)?.name || "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Bill Transportation to</span>
            <span className="font-medium text-slate-700">
              {billTransportationOptions.find((o) => o.code === billTransportationTo)?.name || "-"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Bill Duty and Tax to</span>
            <span className="font-medium text-slate-700">{billDutyTaxOptions.find((o) => o.code === billDutyTaxTo)?.name || "-"}</span>
          </div>
          {refInvoiceNo && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Ref. Invoice No.</span>
              <span className="font-medium text-slate-700">{refInvoiceNo}</span>
            </div>
          )}
          {refInsuranceNo && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Ref. Insurance No.</span>
              <span className="font-medium text-slate-700">{refInsuranceNo}</span>
            </div>
          )}
          {refPurchaseNo && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Ref. Purchase No.</span>
              <span className="font-medium text-slate-700">{refPurchaseNo}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Renders the two-option (carrier-own vs. UPSC) insurer picker for ONE package — reused in
  // both the Packages card (Step 2) and the Add-on tab (Step 3), since insurance is now chosen
  // per package rather than once for the whole shipment. Just two inline radio + label — details
  // (price basis / block reason) are in the title tooltip, not on-screen, to stay compact.
  function renderInsurancePicker(pkg: PackageRow) {
    const { carrierOption: insuranceCarrierOption, thirdPartyOption: insuranceThirdPartyOption } = getInsuranceOptionsForPackage(
      pkg.productType,
    );
    if (!insuranceCarrierOption && !insuranceThirdPartyOption) {
      return <p className="text-sm text-slate-400">ไม่มีตัวเลือกประกันที่ตรงเงื่อนไข — กรุณาเลือก Rate Quote ก่อน</p>;
    }
    const radioName = `insurance-${pkg.key}`;
    const isStaleApiCost =
      insuranceCarrierOption?.price_type === "API_COST" &&
      quotedDeclaredValues[pkg.key] !== (Number(pkg.declared_value) || 0);
    // UPS does not cover Document shipments with its own insurance (ICDV) at all — confirmed
    // business rule, not a config-driven restriction like the insurance country caps below.
    const upsDocumentNotCovered = selectedQuote?.carrier === "UPS" && !!pkg.is_document;
    const carrierOptionDisabled = isStaleApiCost || upsDocumentNotCovered;
    return (
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-4 text-sm">
        {insuranceCarrierOption &&
          (() => {
            const selected = addonRows.some((r) => r.packageKey === pkg.key && r.addonItemId === insuranceCarrierOption.id);
            return (
              <label
                title={
                  upsDocumentNotCovered
                    ? "⚠ UPS ไม่คุ้มครองพัสดุประเภทเอกสาร (Document) ด้วยประกันของ UPS เอง"
                    : isStaleApiCost
                    ? "⚠ มูลค่าสินค้าเปลี่ยนไปตั้งแต่เช็ค Rate ล่าสุด — กรุณากด Check Rate ใหม่ก่อนเลือกประกันนี้"
                    : `ประกันของผู้ให้บริการขนส่งเอง (${insuranceCarrierOption.carriers.join("/")}) — ${
                        insuranceCarrierOption.price_type === "API_COST"
                          ? "ราคาขาย = ค่าประกันจริงที่ carrier เรียกเก็บ (ตาม API)"
                          : "ราคาขายตามที่ตั้งค่าไว้ที่ Config"
                      }`
                }
                className={`flex items-center gap-1.5 ${
                  carrierOptionDisabled ? "cursor-not-allowed text-slate-300" : "cursor-pointer text-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name={radioName}
                  checked={selected}
                  disabled={carrierOptionDisabled}
                  onChange={() => selectPackageInsurance(pkg, insuranceCarrierOption)}
                  className="h-3.5 w-3.5 text-brand-amber focus:ring-brand-amber/30"
                />
                {insuranceCarrierOption.name}
              </label>
            );
          })()}
        {insuranceThirdPartyOption &&
          (() => {
            const selected = addonRows.some((r) => r.packageKey === pkg.key && r.addonItemId === insuranceThirdPartyOption.id);
            const blocked = !!insuranceCap?.note;
            return (
              <label
                title={
                  blocked
                    ? `⚠ ไม่พร้อมขายสำหรับปลายทางนี้ (${insuranceCap?.note})`
                    : `ประกันบุคคลที่สาม (${insuranceThirdPartyOption.carriers.join("/")}) — ${
                        insuranceThirdPartyOption.price != null ? `${Number(insuranceThirdPartyOption.price).toLocaleString()}% ของมูลค่าสินค้า` : "-"
                      }`
                }
                className={`flex items-center gap-1.5 ${blocked ? "cursor-not-allowed text-slate-300" : "cursor-pointer text-slate-700"}`}
              >
                <input
                  type="radio"
                  name={radioName}
                  checked={selected}
                  disabled={blocked}
                  onChange={() => selectPackageInsurance(pkg, insuranceThirdPartyOption)}
                  className="h-3.5 w-3.5 text-brand-amber focus:ring-brand-amber/30"
                />
                {insuranceThirdPartyOption.name}
              </label>
            );
          })()}
        </div>
        {upsDocumentNotCovered && (
          <p className="text-xs font-medium text-amber-600">⚠ UPS ไม่คุ้มครองพัสดุประเภทเอกสาร (Document) ด้วยประกันของ UPS เอง</p>
        )}
        {!upsDocumentNotCovered && isStaleApiCost && (
          <p className="text-xs font-medium text-amber-600">
            ⚠ มูลค่าสินค้าเปลี่ยนไปตั้งแต่เช็ค Rate ล่าสุด — กรุณากด Check Rate ใหม่ก่อนเลือก {insuranceCarrierOption?.name}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Create Shipment / Check Rate" description="Origin: Thailand — Destination: international only" />
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="ชื่อฉบับร่าง (optional)"
              className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
            />
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={savingDraft || loadingDraft}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {draftId ? "บันทึกฉบับร่าง (อัปเดต)" : "บันทึกฉบับร่าง"}
            </button>
          </div>
          {loadingDraft && <span className="text-xs text-slate-400">กำลังโหลดฉบับร่าง...</span>}
          {draftMessage && <span className="text-xs font-medium text-emerald-600">{draftMessage}</span>}
          {draftError && <span className="text-xs font-medium text-red-600">{draftError}</span>}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {STEPS.map((s, idx) => (
          <div key={s.number} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(s.number)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition ${
                step === s.number
                  ? "bg-brand-amber text-brand-navy-dark"
                  : step > s.number
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {s.number}
            </button>
            <span className={`text-sm font-medium ${step === s.number ? "text-slate-700" : "text-slate-400"}`}>{s.label}</span>
            {idx < STEPS.length - 1 && <div className="mx-1 h-px w-8 bg-slate-200" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Customer Type</h2>
          <div className="flex flex-wrap items-center gap-2">
            {customerTypeOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                title={opt.name}
                onClick={() => setCustomerType(opt.code)}
                className={`relative flex min-w-[120px] items-center justify-center gap-1.5 rounded-lg border px-5 py-1.5 text-xs font-semibold transition ${
                  customerType === opt.code
                    ? "border-brand-amber bg-amber-50 text-amber-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {customerType === opt.code && <CheckCircle2 className="h-3.5 w-3.5 text-brand-amber" />}
                {opt.name}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Individual Category</h2>
          <div className="flex flex-wrap items-center gap-2">
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.description}
                onClick={() => setEntityType(opt.value)}
                className={`relative flex min-w-[120px] items-center justify-center gap-1.5 rounded-lg border px-5 py-1.5 text-xs font-semibold transition ${
                  entityType === opt.value
                    ? "border-brand-amber bg-amber-50 text-amber-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {entityType === opt.value && <CheckCircle2 className="h-3.5 w-3.5 text-brand-amber" />}
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ship From</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAutoFill(true)}
                className="text-xs font-medium text-amber-600 hover:underline"
              >
                + Add address automatically
              </button>
              {aiEnabled && (
                <button
                  type="button"
                  onClick={() => setAiFillTarget("from")}
                  className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline"
                >
                  <Sparkles className="h-3.5 w-3.5" /> AI Fill
                </button>
              )}
            </div>
          </div>
          <CustomerAddressPicker type="ship_from" onSelect={(addr) => applyCustomerAddress("from", addr)} />
          <div className="mt-2.5 flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Contact Name</span>
                <div className="relative">
                  <input
                    type="text"
                    value={originContactName}
                    onChange={(e) => {
                      setOriginContactName(e.target.value);
                      setOriginCustomerId(null);
                    }}
                    placeholder="e.g. John Smith"
                    className={`${inputClass} ${originContactName ? "pr-8" : ""}`}
                  />
                  {originContactName && <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Company</span>
                <div className="relative">
                  <input type="text" value={originCompany} onChange={(e) => setOriginCompany(e.target.value)} placeholder="Company name (optional)" className={`${inputClass} ${originCompany ? "pr-8" : ""}`} />
                  {originCompany && <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}
                </div>
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Tax ID No.</span>
              <div className="relative">
                <input type="text" value={originTaxId} onChange={(e) => setOriginTaxId(e.target.value)} placeholder="Tax ID / เลขประจำตัวผู้เสียภาษี (optional)" className={`${inputClass} ${originTaxId ? "pr-8" : ""}`} />
                {originTaxId && <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}
              </div>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Subdistrict / District / Province / Postcode</span>
              <ThaiAddressSearch
                value={originSearchValue}
                onSelect={(row) => {
                  setOriginPostcode(row.zip_code);
                  setOriginCity(row.district_name_en ?? row.district_name_th);
                  setOriginSearchValue(`${row.name_en}, ${row.district_name_en}, ${row.province_name_en} - ${row.zip_code}`);
                  setOriginLookup({
                    status: "found",
                    label: `${row.name_en}, ${row.district_name_en}, ${row.province_name_en}`,
                  });
                }}
              />
            </label>
            {originLookup.status === "found" && <p className="text-xs text-emerald-600">Matched: {originLookup.label}</p>}
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Address 1</span>
              <div className="relative">
                <input type="text" value={originAddress} onChange={(e) => setOriginAddress(e.target.value)} placeholder="House no., street" className={`${inputClass} ${originAddress ? "pr-8" : ""}`} />
                {originAddress && <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}
              </div>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Address 2</span>
                <div className="relative">
                  <input type="text" value={originAddress2} onChange={(e) => setOriginAddress2(e.target.value)} placeholder="Building, floor, room (optional)" className={`${inputClass} ${originAddress2 ? "pr-8" : ""}`} />
                  {originAddress2 && <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Address 3</span>
                <div className="relative">
                  <input type="text" value={originAddress3} onChange={(e) => setOriginAddress3(e.target.value)} placeholder="Additional info (optional)" className={`${inputClass} ${originAddress3 ? "pr-8" : ""}`} />
                  {originAddress3 && <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}
                </div>
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Telephone</span>
              <div className="relative">
                <input type="text" value={originPhone} onChange={(e) => setOriginPhone(e.target.value)} placeholder="e.g. 0812345678" className={`${inputClass} ${originPhone ? "pr-8" : ""}`} />
                {originPhone && <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}
              </div>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Notes</span>
              <textarea
                value={originNotes}
                onChange={(e) => setOriginNotes(e.target.value)}
                placeholder="บันทึกเพิ่มเติม (optional)"
                rows={2}
                className={`${inputClass} resize-y`}
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ship To</h2>
            {aiEnabled && (
              <button
                type="button"
                onClick={() => setAiFillTarget("to")}
                className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline"
              >
                <Sparkles className="h-3.5 w-3.5" /> AI Fill
              </button>
            )}
          </div>
          <CustomerAddressPicker type="ship_to" onSelect={(addr) => applyCustomerAddress("to", addr)} />
          <div className="mt-2.5 flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Contact Name</span>
                <div className="relative">
                  <input
                    type="text"
                    value={destinationContactName}
                    onChange={(e) => {
                      setDestinationContactName(e.target.value);
                      setDestinationCustomerId(null);
                    }}
                    placeholder="e.g. Jane Doe"
                    className={`${inputClass} ${destinationContactName ? "pr-8" : ""}`}
                  />
                  {destinationContactName && (
                    <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Company</span>
                <div className="relative">
                  <input
                    type="text"
                    value={destinationCompany}
                    onChange={(e) => setDestinationCompany(e.target.value)}
                    placeholder="Company name (optional)"
                    className={`${inputClass} ${destinationCompany ? "pr-8" : ""}`}
                  />
                  {destinationCompany && (
                    <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Tax ID No.</span>
              <div className="relative">
                <input
                  type="text"
                  value={destinationTaxId}
                  onChange={(e) => setDestinationTaxId(e.target.value)}
                  placeholder="Tax ID (optional)"
                  className={`${inputClass} ${destinationTaxId ? "pr-8" : ""}`}
                />
                {destinationTaxId && (
                  <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                )}
              </div>
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Country</span>
              <CountrySelect value={destinationCountry} onChange={setDestinationCountry} />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>City</span>
                <div className="relative">
                  <input type="text" value={destinationCity} onChange={(e) => setDestinationCity(e.target.value)} placeholder="e.g. Singapore" className={`${inputClass} ${destinationCity ? "pr-8" : ""}`} />
                  {destinationCity && <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />}
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Postal Code</span>
                <div className="relative">
                  <input
                    type="text"
                    value={destinationPostcode}
                    onChange={(e) => setDestinationPostcode(e.target.value)}
                    placeholder="e.g. 018956"
                    className={`${inputClass} ${destinationPostcode ? "pr-8" : ""}`}
                  />
                  {destinationPostcode && (
                    <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Address 1</span>
              <div className="relative">
                <input
                  type="text"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  placeholder="House no., street"
                  className={`${inputClass} ${destinationAddress ? "pr-8" : ""}`}
                />
                {destinationAddress && (
                  <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                )}
              </div>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Address 2</span>
                <div className="relative">
                  <input
                    type="text"
                    value={destinationAddress2}
                    onChange={(e) => setDestinationAddress2(e.target.value)}
                    placeholder="Building, floor, room (optional)"
                    className={`${inputClass} ${destinationAddress2 ? "pr-8" : ""}`}
                  />
                  {destinationAddress2 && (
                    <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Address 3</span>
                <div className="relative">
                  <input
                    type="text"
                    value={destinationAddress3}
                    onChange={(e) => setDestinationAddress3(e.target.value)}
                    placeholder="Additional info (optional)"
                    className={`${inputClass} ${destinationAddress3 ? "pr-8" : ""}`}
                  />
                  {destinationAddress3 && (
                    <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Telephone</span>
                <div className="relative">
                  <input
                    type="text"
                    value={destinationPhone}
                    onChange={(e) => setDestinationPhone(e.target.value)}
                    placeholder="e.g. +65 81234567"
                    className={`${inputClass} ${destinationPhone ? "pr-8" : ""}`}
                  />
                  {destinationPhone && (
                    <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Email</span>
                <div className="relative">
                  <input
                    type="email"
                    value={destinationEmail}
                    onChange={(e) => setDestinationEmail(e.target.value)}
                    placeholder="name@example.com"
                    className={`${inputClass} ${destinationEmail ? "pr-8" : ""}`}
                  />
                  {destinationEmail && (
                    <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Notes</span>
              <textarea
                value={destinationNotes}
                onChange={(e) => setDestinationNotes(e.target.value)}
                placeholder="บันทึกเพิ่มเติม (optional)"
                rows={2}
                className={`${inputClass} resize-y`}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="flex items-center gap-2 rounded-lg bg-brand-amber px-6 py-2.5 text-sm font-semibold text-brand-navy-dark shadow-sm hover:bg-brand-amber/90"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
        </>
      )}

      {step === 2 && (
        <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Product Type</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1">
            <span className={labelClass}>Shipment Weight Range</span>
            <span className="flex h-[34px] items-center rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-600">
              {matchedWeightBand ? matchedWeightBand.label : "-"}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            คำนวณอัตโนมัติจากน้ำหนักรวมและประเภทกล่องที่เลือกในหัวข้อ Packages ด้านล่าง — ถ้าเลือกกล่อง CPM ระบบจะบังคับใช้ช่วงน้ำหนักของกล่องนั้นเสมอ
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Ship Info</h2>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Ship From</span>
            <p className="font-medium text-slate-700">{originContactName || "-"}</p>
            <p className="text-xs text-slate-500">
              {[originAddress, originCity].filter(Boolean).join(", ") || "-"}
            </p>
          </div>
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Ship To</span>
            <p className="font-medium text-slate-700">{destinationContactName || "-"}</p>
            <p className="text-xs text-slate-500">
              {[destinationAddress, destinationCity, countries.find((c) => c.iso2 === destinationCountry)?.name]
                .filter(Boolean)
                .join(", ") || "-"}
            </p>
          </div>
        </div>
      </div>
      </div>

      {/* <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <ShieldCheck className="h-4 w-4" /> Declared Value
        </h2>
        <p className="text-sm text-slate-600">รวม {totalDeclaredValue.toLocaleString()} THB (กรอกมูลค่าต่อกล่องในหัวข้อ Packages ด้านล่าง)</p>
        <p className="mt-2 text-xs text-slate-400">
          ต้องกำหนดต่อกล่อง ไม่ใช่ยอดรวม เพราะ UPS ใช้ Declared Value ระดับกล่อง (Package Service Options) ในการคิดค่าประกันจริง — ส่งให้
          UPS/DHL ตอน Check Rate เพื่อขอราคาค่าประกันจริงจากผู้ให้บริการขนส่ง (แสดงเป็นรายการ &quot;Declared Value (Insurance)&quot; ใน
          Rate Quotes) และใช้คำนวณ Add-on ที่ตั้งเป็น &quot;Percent of Declared Value&quot; (เช่น ประกันบุคคลที่สาม UPSC) ในขั้นตอนถัดไป
        </p>
        {insuranceCap?.note ? (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            ⚠ ปลายทาง {insuranceCap.country_name} ไม่สามารถขายประกันบุคคลที่สาม (UPSC) ได้ ({insuranceCap.note}) — ตาม Insurance Country Caps
            (ไม่กระทบประกันของ UPS/DHL เอง เช่น ICDV/DHL API)
          </p>
        ) : insuranceCap ? (
          <p className="mt-2 text-xs text-slate-400">
            วงเงินคุ้มครองสูงสุดของประกันบุคคลที่สาม (UPSC) ที่ {insuranceCap.country_name}: UPS{" "}
            {insuranceCap.ups_max_declared != null ? Number(insuranceCap.ups_max_declared).toLocaleString() : "-"} THB / DHL{" "}
            {insuranceCap.dhl_max_declared != null ? Number(insuranceCap.dhl_max_declared).toLocaleString() : "-"} THB
            (ตาม Insurance Country Caps — มูลค่าที่เกินจะถูกจำกัดอัตโนมัติเมื่อคิดค่าประกัน UPSC เท่านั้น ไม่กระทบ ICDV/DHL API)
          </p>
        ) : null}
      </div> */}

      <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Packages</h2>
          {!activeRow.is_document && (
            <div className="flex items-center gap-3">
              <span className={labelClass}>Common Sizes (guide — click to fill dimensions)</span>
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={supplySearch}
                  onChange={(e) => setSupplySearch(e.target.value)}
                  placeholder="Search other sizes..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
                />
              </div>
            </div>
          )}
        </div>

        <div className={activeRow.is_document ? "" : "flex flex-col gap-3 lg:flex-row lg:items-start"}>
          <div className={activeRow.is_document ? "flex flex-col gap-2.5" : "flex flex-col gap-2.5 lg:flex-1"}>
            {packages.map((pkg) => {
              const isActive = pkg.key === activePackageKey;
              // Preview only — actual carrier-own (ICDV/DHL) insurance price comes from the real
              // Rate Quote API instead; this estimates whichever insurer is ACTUALLY selected for
              // this package (UPSC, ICDV, or DHL) so staff see roughly what it'll cost before
              // running Check Rate. Third-party (UPSC) declared value is clamped to the
              // destination's Insurance Country Cap; carrier-own items are not.
              const selectedInsuranceRow = addonRows.find((r) => r.packageKey === pkg.key && r.category === "Insurance");
              const selectedInsuranceItem = selectedInsuranceRow
                ? addonItems.find((i) => i.id === selectedInsuranceRow.addonItemId)
                : undefined;
              const isSelectedThirdParty = selectedInsuranceItem ? isThirdPartyInsuranceItem(selectedInsuranceItem) : false;
              const capValues = [insuranceCap?.ups_max_declared, insuranceCap?.dhl_max_declared]
                .filter((v): v is number | string => v != null)
                .map(Number);
              const maxCap = capValues.length > 0 ? Math.min(...capValues) : null;
              const declaredValueNum = Number(pkg.declared_value) || 0;
              const coveredValue = isSelectedThirdParty && maxCap != null ? Math.min(declaredValueNum, maxCap) : declaredValueNum;
              // API_COST items (e.g. DHL's own insurance) must reflect whatever service is
              // CURRENTLY selected — computed fresh from selectedQuote's real chargeBreakdown on
              // every render instead of a stored addon-row price, so switching between Rate
              // Quote cards never shows a stale/missing premium while an effect catches up.
              const estimatedPremium =
                selectedInsuranceItem?.price_type === "API_COST"
                  ? selectedQuote && !isSelectedThirdParty
                    ? (selectedQuote.chargeBreakdown?.find(
                        (c) => c.code === (selectedQuote.carrier === "DHL" ? (pkg.is_document ? "IB" : "II") : "400"),
                      )?.amount ?? null)
                    : null
                  : selectedInsuranceItem?.price != null
                    ? coveredValue * (Number(selectedInsuranceItem.price) / 100)
                    : null;
              return (
                <div
                  key={pkg.key}
                  onClick={() => !isActive && setActivePackageKey(pkg.key)}
                  className={`relative flex flex-col gap-2 rounded-lg border p-2.5 transition ${
                    isActive ? "border-brand-amber bg-amber-50/40" : "cursor-pointer border-slate-100 bg-slate-50"
                  }`}
                >
                  {!isActive && (
                    <span
                      title="Click to edit this package"
                      className="absolute -left-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-white shadow"
                    >
                      <Lock className="h-3 w-3" />
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!isActive}
                      onClick={() => updatePackage(pkg.key, { is_document: false, forcedWeightBandId: null })}
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold transition disabled:cursor-not-allowed ${
                        !pkg.is_document ? "bg-brand-navy-dark text-white" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      Box
                    </button>
                    <button
                      type="button"
                      disabled={!isActive}
                      onClick={() => updatePackage(pkg.key, { is_document: true, forcedWeightBandId: null })}
                      className={`rounded-md px-2 py-0.5 text-xs font-semibold transition disabled:cursor-not-allowed ${
                        pkg.is_document ? "bg-violet-600 text-white" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      Document
                    </button>
                    {pkg.forcedWeightBandId && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Fixed Weight Range: {weightBands.find((b) => b.id === pkg.forcedWeightBandId)?.label}
                      </span>
                    )}
                  </div>
                  {/* Product Type (Silver/Non Silver) only classifies Box insurance eligibility — a
                      Document package has no such concept, so hide the picker entirely for it. */}
                  {!pkg.is_document && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={labelClass}>Product Type</span>
                      <button
                        type="button"
                        disabled={!isActive}
                        onClick={() => setPackageProductType(pkg.key, pkg.productType === "SILVER" ? null : "SILVER")}
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold transition disabled:cursor-not-allowed ${
                          pkg.productType === "SILVER" ? "bg-brand-navy-dark text-white" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        Silver
                      </button>
                      <button
                        type="button"
                        disabled={!isActive}
                        onClick={() => setPackageProductType(pkg.key, pkg.productType === "NON_SILVER" ? null : "NON_SILVER")}
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold transition disabled:cursor-not-allowed ${
                          pkg.productType === "NON_SILVER" ? "bg-brand-navy-dark text-white" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        Non Silver
                      </button>
                      <button
                        type="button"
                        disabled={!isActive}
                        onClick={() => setPackageProductType(pkg.key, pkg.productType === "OTHER" ? null : "OTHER")}
                        className={`rounded-md px-2 py-0.5 text-xs font-semibold transition disabled:cursor-not-allowed ${
                          pkg.productType === "OTHER" ? "bg-brand-navy-dark text-white" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        Other
                      </button>
                      {pkg.productType === "OTHER" && (
                        <input
                          type="text"
                          value={pkg.productTypeOther}
                          disabled={!isActive}
                          onChange={(e) => updatePackage(pkg.key, { productTypeOther: e.target.value })}
                          placeholder="Specify product type"
                          className="w-40 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15 disabled:bg-slate-100"
                        />
                      )}
                    </div>
                  )}
                  <div className="flex items-end gap-3">
                  <label className="flex w-24 flex-col gap-1">
                    <span className={labelClass}>Weight (kg)</span>
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={pkg.weight}
                      disabled={!isActive}
                      onChange={(e) => updatePackage(pkg.key, { weight: Number(e.target.value) })}
                      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15 disabled:bg-slate-100 ${
                        !isActive ? "pointer-events-none" : ""
                      }`}
                    />
                  </label>
                  {!pkg.is_document && (
                    <div className="flex flex-col gap-1">
                      <div className="flex">
                        <span className={`${labelClass} w-16`}>Length</span>
                        <span className={`${labelClass} w-16`}>Width</span>
                        <span className={`${labelClass} w-16`}>Height</span>
                      </div>
                      <div className="flex divide-x divide-slate-300 rounded-lg border border-slate-300 bg-white focus-within:border-brand-navy focus-within:ring-2 focus-within:ring-brand-navy/15">
                        <input
                          type="number"
                          min={1}
                          value={pkg.length}
                          disabled={!isActive}
                          onChange={(e) => updatePackage(pkg.key, { length: Number(e.target.value) })}
                          className={`w-16 rounded-l-lg px-3 py-1.5 text-sm outline-none disabled:bg-slate-100 ${
                            !isActive ? "pointer-events-none" : ""
                          }`}
                        />
                        <input
                          type="number"
                          min={1}
                          value={pkg.width}
                          disabled={!isActive}
                          onChange={(e) => updatePackage(pkg.key, { width: Number(e.target.value) })}
                          className={`w-16 px-3 py-1.5 text-sm outline-none disabled:bg-slate-100 ${
                            !isActive ? "pointer-events-none" : ""
                          }`}
                        />
                        <input
                          type="number"
                          min={1}
                          value={pkg.height}
                          disabled={!isActive}
                          onChange={(e) => updatePackage(pkg.key, { height: Number(e.target.value) })}
                          className={`w-16 rounded-r-lg px-3 py-1.5 text-sm outline-none disabled:bg-slate-100 ${
                            !isActive ? "pointer-events-none" : ""
                          }`}
                        />
                      </div>
                    </div>
                  )}
                  <label className="flex w-20 flex-col gap-1">
                    <span className={labelClass}>Qty</span>
                    <input
                      type="number"
                      min={1}
                      value={pkg.quantity}
                      disabled={!isActive}
                      onChange={(e) => updatePackage(pkg.key, { quantity: Number(e.target.value) })}
                      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15 disabled:bg-slate-100 ${
                        !isActive ? "pointer-events-none" : ""
                      }`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removePackage(pkg.key)}
                    disabled={packages.length <= 1}
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Remove package"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  </div>
                  <div className="flex items-end gap-3">
                  <div className="flex w-24 flex-col gap-1">
                    {/* <span className={labelClass}>Insurance</span> */}
                    <label
                      className="flex h-[34px] items-center gap-1.5"
                      title={selectedQuote?.carrier === "UPS" && pkg.is_document ? "UPS ไม่คุ้มครองพัสดุประเภทเอกสาร (Document) ด้วยประกันของ UPS เอง" : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={pkg.insured}
                        disabled={!isActive || (selectedQuote?.carrier === "UPS" && !!pkg.is_document)}
                        onChange={(e) => {
                          const insured = e.target.checked;
                          // Documents have no Declared Value input (see below) — insurance is a
                          // flat Yes/No, so just stamp the fixed coverage amount straight in.
                          updatePackage(pkg.key, {
                            insured,
                            ...(insured && pkg.is_document ? { declared_value: DHL_DOCUMENT_FIXED_COVERAGE_THB } : {}),
                          });
                          if (!insured) {
                            setAddonRows((prev) => prev.filter((r) => !(r.category === "Insurance" && r.packageKey === pkg.key)));
                          } else {
                            // Only auto-picks an insurer once a Rate Quote is selected (need the
                            // carrier to know which options apply) — otherwise just leaves Declared
                            // Value ready to go so it's included the moment Check Rate runs.
                            autoSelectPackageInsurer(pkg);
                          }
                        }}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-brand-navy focus:ring-brand-navy/30"
                      />
                      <span className="text-xs text-slate-500">Insurance</span>
                    </label>
                  </div>
                  {pkg.insured && !pkg.is_document && (
                    <label className="flex w-48 flex-col gap-1">
                      <span className={labelClass}>Declared Value (THB)</span>
                      <input
                        type="number"
                        min={0}
                        value={pkg.declared_value ?? 0}
                        disabled={!isActive}
                        onChange={(e) => updateDeclaredValue(pkg, Number(e.target.value))}
                        className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15 disabled:bg-slate-100 ${
                          !isActive ? "pointer-events-none" : ""
                        }`}
                      />
                    </label>
                  )}
                  {pkg.insured && pkg.is_document && (
                    <p className="max-w-xs text-xs text-slate-500">
                      In the rare event of physical loss of your documents, DHL will compensate for the cost of recovery with a
                      fixed lump sum of <strong className="text-slate-700">17,000 THB</strong>.
                    </p>
                  )}
                  {pkg.insured && (
                    <div className="flex flex-col justify-center gap-0.5 text-xs">
                      <span className="text-slate-400" title="วงเงินประกันที่จะได้รับหากสินค้าเสียหาย (หลังจำกัดตาม Insurance Country Caps)">
                        ราคาครอบคลุมสินค้า (THB)
                      </span>
                      <span className={`font-semibold ${coveredValue < declaredValueNum ? "text-amber-600" : "text-slate-700"}`}>
                        {coveredValue.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {pkg.insured && (
                    <div className="flex flex-col justify-center gap-0.5 text-xs">
                      <span className="text-slate-400">ราคาประกันสินค้า{selectedInsuranceItem ? ` (${selectedInsuranceItem.name})` : ""}</span>
                      <span className="font-semibold text-slate-700">
                        {estimatedPremium != null ? estimatedPremium.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-"}
                      </span>
                    </div>
                  )}
                  </div>
                  {pkg.insured && coveredValue < declaredValueNum && (
                    <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
                      ⚠ มูลค่าสินค้าที่แจ้ง ({declaredValueNum.toLocaleString()} บาท) เกินวงเงินคุ้มครองสูงสุดของ{" "}
                      {selectedInsuranceItem?.name ?? "ประกันนี้"} ที่ปลายทางนี้ — คุ้มครองได้สูงสุดแค่{" "}
                      <strong>{coveredValue.toLocaleString()} บาท</strong> เท่านั้น (ส่วนเกินจะไม่ได้รับความคุ้มครอง)
                    </p>
                  )}
                  {/* Documents only ever have one eligible insurer (DHL's own) — the "Insurance"
                      checkbox above already decides/auto-selects it, no picker needed. */}
                  {pkg.insured && !pkg.is_document && renderInsurancePicker(pkg)}
                  <label className="flex flex-col gap-1">
                    <span className={labelClass}>Description of Goods</span>
                    <input
                      type="text"
                      value={pkg.description ?? ""}
                      disabled={!isActive}
                      onChange={(e) => updatePackage(pkg.key, { description: e.target.value })}
                      placeholder="e.g. Cotton T-shirts, 10 pcs"
                      className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15 disabled:bg-slate-100 ${
                        !isActive ? "pointer-events-none" : ""
                      }`}
                    />
                  </label>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addPackage}
              className="flex items-center gap-1 text-sm font-medium text-amber-600 hover:underline"
            >
              <Plus className="h-4 w-4" /> Add package
            </button>
          </div>

          {!activeRow.is_document && (
            <div className="w-full shrink-0 rounded-lg border border-slate-100 bg-slate-50 p-2.5 lg:w-72">
              {supplies.length === 0 ? (
                <p className="text-sm text-slate-400">No supplies available.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                    {visibleSupplies.length === 0 ? (
                      <p className="text-sm text-slate-400">No matching sizes found.</p>
                    ) : (
                      visibleSupplies.map((supply) => {
                      const selected = stockSupplyId === supply.id;
                      return (
                        <div
                          key={supply.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => applyStockSize(supply)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") applyStockSize(supply);
                          }}
                          className={`relative flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-xl border-2 p-2 text-center transition ${
                            selected ? "border-brand-amber bg-amber-50" : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <span
                            className={`absolute right-1.5 top-1.5 h-3.5 w-3.5 rounded-full border-2 ${
                              selected ? "border-brand-amber bg-brand-amber" : "border-slate-300"
                            }`}
                          />
                          {supply.icon_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={supply.icon_url} alt={supply.name} className="h-7 w-7 shrink-0 object-contain" />
                          ) : (
                            <Package className="h-7 w-7 shrink-0 text-slate-300" />
                          )}
                          <span className="w-full truncate text-xs font-semibold leading-tight text-slate-700">{supply.name}</span>
                          {supply.length && supply.width && supply.height && (
                            <span className="text-[10px] leading-tight text-slate-400">
                              {supply.length} x {supply.width} x {supply.height} cm
                            </span>
                          )}
                        </div>
                      );
                    })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-4 flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">Rate Quotes</h2>
            <div className="mb-3 flex items-center gap-4 text-sm">
              {(["UPS", "DHL"] as const).map((carrier) => (
                <label key={carrier} className="flex cursor-pointer items-center gap-1.5 text-slate-600">
                  <input
                    type="checkbox"
                    checked={selectedCarriers.includes(carrier)}
                    onChange={() => toggleCarrierFilter(carrier)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-brand-navy focus:ring-brand-navy/30"
                  />
                  {carrier}
                </label>
              ))}
            </div>
            {!results ? (
              <p className="text-sm text-slate-400">Fill in package details and click &quot;Check Rate&quot; to see live quotes from UPS/DHL here.</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-slate-400">เลือก 1 รายการที่ต้องการใช้ (คลิกที่การ์ด)</p>
                <div className="flex max-h-[28rem] flex-col gap-2.5 overflow-y-auto pr-1">
                  {okResults.map((r, i) => {
                    const agentLogo = agents.find((a) => a.agent_code === r.carrier)?.logo_url;
                    const isSelected =
                      selectedQuote != null &&
                      selectedQuote.carrier === r.carrier &&
                      selectedQuote.accountId === r.accountId &&
                      selectedQuote.serviceCode === r.serviceCode;
                    const { sellAmount, costOnlyCodes: rCostOnlyCodes } = getSellFreightAmount(r);
                    return (
                      <div
                        key={`${r.carrier}-${r.accountId}-${r.serviceCode}-${i}`}
                        onClick={() => setSelectedQuote(r)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setSelectedQuote(r);
                        }}
                        className={`w-full cursor-pointer rounded-xl border p-3 text-left transition ${
                          isSelected ? "border-brand-amber bg-amber-50/60 ring-1 ring-brand-amber" : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-amber" />}
                            {agentLogo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={agentLogo} alt={r.carrier} className="h-5 w-auto object-contain" />
                            ) : (
                              <Tag className="h-4 w-4 text-slate-300" />
                            )}
                            <span className="text-sm font-semibold text-slate-700">{r.carrier}</span>
                          </div>
                          <span className="text-sm font-bold text-brand-navy-dark">
                            {sellAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.currency}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {r.serviceLabel}
                          {r.serviceCode && <span className="text-slate-300"> ({r.serviceCode})</span>}
                        </p>
                        <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                          <span>
                            {r.username}
                            {r.zone && ` · Zone ${r.zone}`}
                          </span>
                          <span>{r.transitDays != null ? `${r.transitDays} days` : "-"}</span>
                        </div>
                        {r.billedWeight != null && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            Billed Weight: <span className="font-medium text-slate-500">{r.billedWeight} {r.billedWeightUnit}</span>
                            {r.volumetricWeight != null && (
                              <span> · Volumetric: <span className="font-medium text-slate-500">{r.volumetricWeight} {r.billedWeightUnit}</span></span>
                            )}
                          </p>
                        )}
                        {r.chargeBreakdown && r.chargeBreakdown.length > 0 && (
                          <div className="mt-2 flex flex-col gap-0.5 border-t border-slate-100 pt-2">
                            {r.chargeBreakdown
                              .filter((line) => sellingCarrierOwnInsurance || !rCostOnlyCodes.includes(line.code ?? ""))
                              .map((line, li) => (
                              <div key={li} className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">
                                  {line.description}
                                  {line.code ? <span className="text-slate-300"> ({line.code})</span> : null}
                                  {rCostOnlyCodes.includes(line.code ?? "") && (
                                    <span className="ml-1 text-amber-600">— ต้นทุน ไม่รวมในยอดขายด้านบน</span>
                                  )}
                                </span>
                                <span className="font-medium text-slate-600">
                                  {line.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {line.currency}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {r.raw != null && (
                          <div className="mt-2 flex justify-end border-t border-slate-100 pt-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewRawQuote(r);
                              }}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            >
                              <Code className="h-3 w-3" /> Raw
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {okResults.length === 0 && <p className="text-sm text-slate-400">No valid quotes returned.</p>}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={!selectedQuote}
                    className="flex items-center gap-2 rounded-lg bg-brand-amber px-6 py-2.5 text-sm font-semibold text-brand-navy-dark shadow-sm hover:bg-brand-amber/90 disabled:opacity-60"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
        </div>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-brand-amber px-6 py-2.5 text-sm font-semibold text-brand-navy-dark shadow-sm hover:bg-brand-amber/90 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          {loading ? "Checking rates..." : "Check Rate"}
        </button>
      </div>
        </>
      )}

      {step === 4 && (
        <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
      <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Payment Method</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Payment Method</span>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
              {paymentOptions.map((opt) => (
                <option key={opt.id} value={opt.code}>
                  {opt.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Bill Transportation to</span>
            <select value={billTransportationTo} onChange={(e) => setBillTransportationTo(e.target.value)} className={inputClass}>
              {billTransportationOptions.map((opt) => (
                <option key={opt.id} value={opt.code}>
                  {opt.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Bill Duty and Tax to</span>
            <select value={billDutyTaxTo} onChange={(e) => setBillDutyTaxTo(e.target.value)} className={inputClass}>
              {billDutyTaxOptions.map((opt) => (
                <option key={opt.id} value={opt.code}>
                  {opt.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Ref. Invoice No.</span>
            <input
              type="text"
              value={refInvoiceNo}
              onChange={(e) => setRefInvoiceNo(e.target.value)}
              placeholder="e.g. INV-2026-00123"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Ref. Insurance No.</span>
            <input
              type="text"
              value={refInsuranceNo}
              onChange={(e) => setRefInsuranceNo(e.target.value)}
              placeholder="e.g. INS-2026-00123"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Ref. Purchase No.</span>
            <input
              type="text"
              value={refPurchaseNo}
              onChange={(e) => setRefPurchaseNo(e.target.value)}
              placeholder="e.g. PO-2026-00123"
              className={inputClass}
            />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(3)}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          disabled={!selectedQuote}
          onClick={() => {
            setBookedShipment(null);
            setBookingError("");
            setBookingModalOpen(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-brand-amber px-5 py-2.5 text-sm font-semibold text-brand-navy-dark shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          สร้าง Shipment <ChevronRight className="h-4 w-4" />
        </button>
      </div>
        </div>

        <div className="lg:col-span-1">{orderSummaryPanel}</div>
      </div>
        </>
      )}

      {step === 3 && (
        <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
      <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <ShieldCheck className="h-4 w-4" /> Declared Value
        </h2>
        <p className="text-sm text-slate-600">
          รวม {totalDeclaredValue.toLocaleString()} THB{" "}
          <button type="button" onClick={() => setStep(2)} className="ml-1 text-xs font-medium text-amber-600 hover:underline">
            (แก้ไขต่อกล่องที่ Product &amp; Rate)
          </button>
        </p>
        <p className="mt-2 text-xs text-slate-400">
          ใช้คำนวณราคาของ Add-on ที่ตั้งเป็น &quot;Percent of Declared Value&quot; (เช่น ประกันบุคคลที่สาม UPSC) — ตั้งค่าที่ Add-on Settings
        </p>
        {insuranceCap?.note ? (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            ⚠ ปลายทาง {insuranceCap.country_name} ไม่สามารถขายประกันบุคคลที่สาม (UPSC) ได้ ({insuranceCap.note}) — ตาม Insurance UPSC
            (ไม่กระทบประกันของ UPS/DHL เอง เช่น ICDV/DHL API)
          </p>
        ) : insuranceCap ? (
          <p className="mt-2 text-xs text-slate-400">
            วงเงินคุ้มครองสูงสุดของประกันบุคคลที่สาม (UPSC) ที่ {insuranceCap.country_name}: UPS{" "}
            {insuranceCap.ups_max_declared != null ? Number(insuranceCap.ups_max_declared).toLocaleString() : "-"} THB / DHL{" "}
            {insuranceCap.dhl_max_declared != null ? Number(insuranceCap.dhl_max_declared).toLocaleString() : "-"} THB
            (ตาม Insurance UPSC — มูลค่าที่เกินจะถูกจำกัดอัตโนมัติเมื่อคิดค่าประกัน UPSC เท่านั้น ไม่กระทบ ICDV/DHL API)
          </p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Tag className="h-4 w-4" /> Add-on
        </h2>

        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveAddonCategory(SUPPLIES_TAB)}
              className={`rounded-t-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeAddonCategory === SUPPLIES_TAB
                  ? "border-b-2 border-brand-amber text-brand-navy-dark"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Packing Supplies
            </button>
            {addonTabCategoryNames.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveAddonCategory(category)}
                className={`rounded-t-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeAddonCategory === category
                    ? "border-b-2 border-brand-amber text-brand-navy-dark"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="relative w-56 shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={addonSearch}
              onChange={(e) => setAddonSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
            />
          </div>
        </div>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">รายการแนะนำ (คลิกเพื่อเพิ่ม)</p>

        <div className="mb-4 flex flex-col gap-1">
          {activeAddonCategory === SUPPLIES_TAB ? (
            visibleSupplySuggestions.length === 0 ? (
              <p className="text-sm text-slate-400">No matching supplies.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                  {visibleSupplySuggestions.map((supply) => (
                    <button
                      type="button"
                      key={supply.id}
                      onClick={() => addAddonFromSupply(supply)}
                      className="flex min-w-0 flex-col items-center gap-1 rounded-xl border-2 border-slate-200 bg-white p-2 text-center transition hover:border-brand-amber hover:bg-amber-50"
                    >
                      {supply.icon_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={supply.icon_url} alt={supply.name} className="h-7 w-7 shrink-0 object-contain" />
                      ) : (
                        <Package className="h-7 w-7 shrink-0 text-slate-300" />
                      )}
                      <span className="w-full truncate text-xs font-semibold leading-tight text-slate-700">{supply.name}</span>
                      <span className="text-[10px] font-semibold leading-tight text-brand-navy-dark">
                        {Number(supply.sale_price).toLocaleString()} THB
                      </span>
                    </button>
                  ))}
                </div>
                {!isAddonSearching && matchingSupplySuggestions.length > MAX_SUGGESTIONS && (
                  <p className="mt-1 text-xs text-slate-400">พิมพ์ค้นหาเพื่อดูรายการอื่นเพิ่มเติม ({matchingSupplySuggestions.length} รายการทั้งหมด)</p>
                )}
              </>
            )
          ) : isInsuranceCategory ? (
            packages.filter((p) => p.insured).length === 0 ? (
              <p className="text-sm text-slate-400">ยังไม่มีกล่องที่เลือกทำประกันสินค้า — กลับไปที่ Packages (Step 2) เพื่อเลือก</p>
            ) : (
              <div className="flex flex-col gap-3">
                {packages
                  .filter((p) => p.insured)
                  .map((pkg) => (
                    <div key={pkg.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold text-slate-500">
                        Package #{packages.findIndex((p) => p.key === pkg.key) + 1}
                        {pkg.description ? ` — ${pkg.description}` : ""}
                      </p>
                      {renderInsurancePicker(pkg)}
                    </div>
                  ))}
              </div>
            )
          ) : visibleAddonSuggestions.length === 0 ? (
            <p className="text-sm text-slate-400">No matching add-on items.</p>
          ) : (
            <>
              {visibleAddonSuggestions.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => addAddonFromSuggestion(item)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm transition hover:border-brand-amber hover:bg-amber-50"
                >
                  <span className="flex items-center gap-2 font-medium text-slate-700">
                    <Plus className="h-3.5 w-3.5 shrink-0 text-brand-amber" />
                    {item.name}
                    <span className="text-xs font-normal text-slate-400">({item.carriers.join("/")})</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-600">
                    {item.price_type === "FIXED"
                      ? item.price != null
                        ? `${Number(item.price).toLocaleString()} THB`
                        : "-"
                      : item.price_type === "PERCENT"
                        ? item.price != null
                          ? `${Number(item.price).toLocaleString()}% of Declared Value`
                          : "-"
                        : "Manual price"}
                  </span>
                </button>
              ))}
              {!isAddonSearching && matchingAddonSuggestions.length > MAX_SUGGESTIONS && (
                <p className="mt-1 text-xs text-slate-400">พิมพ์ค้นหาเพื่อดูรายการอื่นเพิ่มเติม ({matchingAddonSuggestions.length} รายการทั้งหมด)</p>
              )}
            </>
          )}
        </div>

        {addonLinesByCategory.length > 0 && (
          <div className="mb-3 flex flex-col gap-3">
            {addonLinesByCategory.map(({ category, lines }) => {
              const sectionTotal = lines.reduce((sum, l) => sum + l.amount, 0);
              const isActiveCategory = category === activeAddonCategoryName;
              return (
                <div key={category} className="overflow-x-auto rounded-xl border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {category}
                  </div>
                  {lines.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-slate-400">ยังไม่มีรายการในหมวดนี้</p>
                  ) : (
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
                        <tr>
                          <th className="px-3 py-2 font-medium">รายการ</th>
                          <th className="px-3 py-2 font-medium text-right">จำนวน</th>
                          <th className="px-3 py-2 font-medium text-right">ราคา/@</th>
                          <th className="px-3 py-2 font-medium text-right">รวมเงิน</th>
                          <th className="px-3 py-2 font-medium text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map(({ row, amount }) => (
                          <tr key={row.key} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.name}
                                disabled={row.nameLocked}
                                onChange={(e) => updateAddonRow(row.key, { name: e.target.value })}
                                placeholder="e.g. Bubble wrap"
                                className="w-full min-w-[160px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15 disabled:bg-slate-100"
                              />
                              {row.packageKey != null && (
                                <p className="mt-1 text-[11px] text-slate-400">
                                  Package #{packages.findIndex((p) => p.key === row.packageKey) + 1}
                                </p>
                              )}
                              {row.costPrice != null && (
                                <p className="mt-1 text-[11px] text-slate-400">
                                  ต้นทุนจาก API: {Number(row.costPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} THB
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={1}
                                value={row.quantity}
                                onChange={(e) => updateAddonRow(row.key, { quantity: Number(e.target.value) })}
                                className="ml-auto w-16 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                disabled={row.priceLocked}
                                value={row.unitPrice}
                                onChange={(e) => updateAddonRow(row.key, { unitPrice: e.target.value })}
                                className="ml-auto w-24 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15 disabled:bg-slate-100"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-slate-700">
                              {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeAddonRow(row.key)}
                                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                                aria-label="Remove add-on"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold text-slate-500">
                            รวม {category}
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-bold text-brand-navy-dark">
                            {sectionTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  )}
                  {isActiveCategory && (
                    <div className="border-t border-slate-200 px-3 py-2">
                      <button
                        type="button"
                        onClick={addAddonRow}
                        className="flex items-center gap-1 text-sm font-medium text-amber-600 hover:underline"
                      >
                        <Plus className="h-4 w-4" /> เพิ่มแถวรายการ ({category})
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              <span className="text-sm font-semibold text-slate-500">รวมเป็นเงินทั้งหมด</span>
              <span className="text-sm font-bold text-brand-navy-dark">
                {addonTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          onClick={() => setStep(4)}
          className="flex items-center gap-2 rounded-lg bg-brand-amber px-6 py-2.5 text-sm font-semibold text-brand-navy-dark shadow-sm hover:bg-brand-amber/90"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
        </div>

        <div className="lg:col-span-1">{orderSummaryPanel}</div>
      </div>
        </>
      )}

      {showAutoFill && (
        <Modal title="Add address automatically" onClose={() => setShowAutoFill(false)}>
          <div className="flex flex-col gap-3">
            <div>
              <span className={labelClass}>Paste address text</span>
              <p className="mt-1 text-xs text-slate-400">
                Paste the full address as-is (name, phone, address, subdistrict, postcode). We&apos;ll find the postcode
                and fill in the Subdistrict/District/Province and Address fields.
              </p>
            </div>
            <textarea
              value={autoFillText}
              onChange={(e) => setAutoFillText(e.target.value)}
              rows={6}
              maxLength={500}
              placeholder={"Eg. Somchai Fast Delivery 099-999-9999\n906 Charoen Krung Rd, Bang Rak,\nBang Rak, Bangkok 10500"}
              className={`${inputClass} resize-y`}
            />
            <div className="text-right text-xs text-slate-400">{autoFillText.length} / 500</div>
            {autoFillError && <p className="text-xs text-red-600">{autoFillError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAutoFill(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAutoFillApply}
                className="rounded-lg bg-brand-amber px-4 py-2 text-sm font-semibold text-brand-navy-dark hover:brightness-95"
              >
                Save and Apply
              </button>
            </div>
          </div>
        </Modal>
      )}

      {aiFillTarget && (
        <Modal title={`AI Fill — ${aiFillTarget === "from" ? "Ship From" : "Ship To"}`} onClose={() => setAiFillTarget(null)}>
          <div className="flex flex-col gap-3">
            <div>
              <span className={labelClass}>Paste any address (any language / format)</span>
              <p className="mt-1 text-xs text-slate-400">
                วางที่อยู่แบบไหนก็ได้ ยาวแค่ไหนก็ได้ (ไทยหรือต่างประเทศ) — AI จะแยกชื่อผู้ติดต่อ บริษัท ที่อยู่ เมือง รหัสไปรษณีย์
                {aiFillTarget === "to" && ", ประเทศ,"} เบอร์โทร และอีเมล ให้อัตโนมัติ
              </p>
            </div>
            <textarea
              value={aiFillText}
              onChange={(e) => setAiFillText(e.target.value)}
              rows={6}
              maxLength={2000}
              placeholder={"e.g. John Tan, ABC Trading Pte Ltd\n1 Raffles Place #12-34\nSingapore 048616\n+65 8123 4567 john@abc.com"}
              className={`${inputClass} resize-y`}
            />
            <div className="text-right text-xs text-slate-400">{aiFillText.length} / 2000</div>
            {aiFillError && <p className="text-xs text-red-600">{aiFillError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAiFillTarget(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAiFillApply}
                disabled={aiFillLoading || !aiFillText.trim()}
                className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" />
                {aiFillLoading ? "Parsing with AI..." : "Parse & Apply"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {viewRawQuote && (
        <Modal title={`Raw API Response — ${viewRawQuote.carrier} ${viewRawQuote.serviceLabel}`} onClose={() => setViewRawQuote(null)} maxWidthClassName="max-w-3xl">
          <pre className="max-h-[65vh] overflow-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
            {JSON.stringify(viewRawQuote.raw, null, 2)}
          </pre>
        </Modal>
      )}

      {bookingModalOpen && selectedQuote && (
        <Modal
          title={bookedShipment ? "สร้าง Shipment สำเร็จ" : "ยืนยันการสร้าง Shipment"}
          onClose={() => {
            if (booking) return;
            if (bookedShipment) {
              router.push("/shipment/list");
              return;
            }
            setBookingModalOpen(false);
          }}
          maxWidthClassName="max-w-3xl"
          bodyMaxHeightClassName="max-h-[92vh]"
        >
          {bookedShipment ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white px-6 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-200">
                  <CheckCircle2 className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-base font-bold text-emerald-700">จอง Shipment กับ {bookedShipment.carrier} สำเร็จแล้ว</p>
                  <p className="mt-1 text-sm text-slate-500">บันทึกเข้าระบบเรียบร้อย พร้อมติดตามสถานะได้ทันที</p>
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Tracking No.</span>
                  <span className="font-mono text-lg font-bold text-brand-navy-dark">{bookedShipment.tracking_number ?? "-"}</span>
                </div>
              </div>
              {bookedShipment.label_storage_key && (
                <button
                  type="button"
                  onClick={handleOpenLabel}
                  disabled={openingLabel}
                  className="flex items-center justify-center gap-2 rounded-xl bg-brand-navy-dark px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
                >
                  {openingLabel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                  เปิด Label (พร้อมพิมพ์)
                </button>
              )}
              <button
                type="button"
                onClick={() => printShipmentReceipt(bookedShipment)}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Printer className="h-4 w-4" />
                พิมพ์ใบเสร็จ
              </button>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => router.push("/shipment/list")}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  ปิด
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-3 py-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-xs text-amber-800">
                  <span className="font-bold">การกด Confirm จะสร้าง Shipment จริงกับ {selectedQuote.carrier}</span> ({selectedQuote.serviceLabel})
                  — ไม่สามารถยกเลิกจากระบบนี้ได้ กรุณาตรวจสอบข้อมูลด้านล่างให้ถูกต้องก่อนยืนยัน
                </p>
              </div>

              <div className="[&_.sticky]:!static">{orderSummaryPanel}</div>

              {bookingError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{bookingError}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(false)}
                  disabled={booking}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleConfirmBooking}
                  disabled={booking}
                  className="flex items-center gap-2 rounded-lg bg-brand-amber px-6 py-2.5 text-sm font-bold text-brand-navy-dark shadow-md shadow-amber-200 transition hover:brightness-95 disabled:opacity-60"
                >
                  {booking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  {booking ? "กำลังสร้าง Shipment..." : "Confirm"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
