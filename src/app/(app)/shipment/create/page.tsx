"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, Lock, Package, Plus, Search, ShieldCheck, Tag, Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import Modal from "@/components/ui/Modal";
import ThaiAddressSearch from "@/components/shipment/ThaiAddressSearch";
import CountrySelect from "@/components/shipment/CountrySelect";
import { listCountries, type Country } from "@/lib/countries";
import { listAgents, type Agent } from "@/lib/agentAccounts";
import { listSupplies, type Supply } from "@/lib/supplies";
import { listAddonItems, type AddonItem } from "@/lib/addonItems";
import { listProductWeightBands, matchProductWeightBand, pickForcedWeightBand, type ProductWeightBand } from "@/lib/productWeightBands";
import { getThaiSubdistrictsByZipCode } from "@/lib/thaiSubdistricts";
import { checkRate, type CheckRateInput, type RateQuote, type ShipmentPackageInput } from "@/lib/shipping";

const STEPS = [
  { number: 1 as const, label: "Ship Info" },
  { number: 2 as const, label: "Product & Rate" },
  { number: 3 as const, label: "Payment & Add-on" },
];

type PackageRow = ShipmentPackageInput & { key: number; forcedWeightBandId: number | null };

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
  forcedWeightBandId: null,
});

type GoodsRow = { key: number; name: string; hsCode: string; quantity: number; value: number };
let goodsKeySeq = 1;
const newGoodsRow = (): GoodsRow => ({ key: goodsKeySeq++, name: "", hsCode: "", quantity: 1, value: 0 });

const CUSTOMER_TYPE_OPTIONS: { value: "DAILY" | "CR" | "WI"; label: string; description: string }[] = [
  { value: "DAILY", label: "DAILY", description: "ลูกค้าบัญชีประจำ ส่งสินค้าเป็นประจำทุกวันผ่านบัญชี Agent" },
  { value: "CR", label: "Shop CR", description: "ลูกค้าร้านค้าที่มาส่งที่เคาน์เตอร์ (Shop Counter Rate)" },
  { value: "WI", label: "WI", description: "ลูกค้าทั่วไปที่เดินเข้ามาส่งเอง (Walk-in)" },
];

const ENTITY_TYPE_OPTIONS: { value: "INDIVIDUAL" | "COMPANY"; label: string; description: string }[] = [
  { value: "INDIVIDUAL", label: "INDIVIDUAL", description: "การจัดส่งเพื่อการใช้งานส่วนตัว ของขวัญ หรือของใช้ในบ้าน" },
  { value: "COMPANY", label: "COMPANY", description: "การจัดส่งเพื่อวัตถุประสงค์ทางการค้าด้วย VAT/ID ภาษี" },
];

const INSURANCE_SERVICES: Record<"DAILY" | "CR" | "WI", { code: string; label: string; multiplier: number }[]> = {
  DAILY: [
    { code: "UPSC", label: "UPS Shipment Care", multiplier: 0.011 },
    { code: "ICDV", label: "International Carriage of Dangerous Goods", multiplier: 0.011 },
  ],
  WI: [
    { code: "UPSC", label: "UPS Shipment Care", multiplier: 0.011 },
    { code: "ICDV", label: "International Carriage of Dangerous Goods", multiplier: 0.011 },
  ],
  CR: [
    { code: "UPSC", label: "UPS Shipment Care", multiplier: 0.004 },
    { code: "ICDV", label: "International Carriage of Dangerous Goods", multiplier: 0.004 },
  ],
};

export default function ShipmentCreatePage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [originContactName, setOriginContactName] = useState("");
  const [originCompany, setOriginCompany] = useState("");
  const [originPostcode, setOriginPostcode] = useState("");
  const [originCity, setOriginCity] = useState("");
  const [originAddress, setOriginAddress] = useState("");
  const [originAddress2, setOriginAddress2] = useState("");
  const [originAddress3, setOriginAddress3] = useState("");
  const [originPhone, setOriginPhone] = useState("");
  const [originSearchValue, setOriginSearchValue] = useState("");
  const [originLookup, setOriginLookup] = useState<{ status: "idle" | "loading" | "found" | "not-found"; label?: string }>({
    status: "idle",
  });
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [autoFillText, setAutoFillText] = useState("");
  const [autoFillError, setAutoFillError] = useState("");

  const [destinationContactName, setDestinationContactName] = useState("");
  const [destinationCompany, setDestinationCompany] = useState("");
  const [destinationCountry, setDestinationCountry] = useState("");
  const [destinationCity, setDestinationCity] = useState("");
  const [destinationPostcode, setDestinationPostcode] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [destinationAddress2, setDestinationAddress2] = useState("");
  const [destinationAddress3, setDestinationAddress3] = useState("");
  const [destinationPhone, setDestinationPhone] = useState("");
  const [destinationEmail, setDestinationEmail] = useState("");

  const [packages, setPackages] = useState<PackageRow[]>([newRow()]);
  // Which package row Common Sizes / dimension edits apply to — only one row is "unlocked" at a time.
  const [activePackageKey, setActivePackageKey] = useState<number | null>(packages[0]?.key ?? null);

  const [customerType, setCustomerType] = useState<"DAILY" | "CR" | "WI">("DAILY");
  const [entityType, setEntityType] = useState<"INDIVIDUAL" | "COMPANY">("INDIVIDUAL");
  const [paymentMethod, setPaymentMethod] = useState("company_account");

  const [insuranceEnabled, setInsuranceEnabled] = useState(false);
  const [insuranceService, setInsuranceService] = useState(INSURANCE_SERVICES.DAILY[0].code);
  const [declaredValue, setDeclaredValue] = useState("1000");

  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [stockSupplyId, setStockSupplyId] = useState<number | null>(null);
  const [supplySearch, setSupplySearch] = useState("");

  const [addonItems, setAddonItems] = useState<AddonItem[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<number[]>([]);
  const [addonPrices, setAddonPrices] = useState<Record<number, string>>({});

  const [goods, setGoods] = useState<GoodsRow[]>([newGoodsRow()]);
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
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<RateQuote[] | null>(null);

  function updatePackage(key: number, patch: Partial<PackageRow>) {
    setPackages((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
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
  }

  function updateGoods(key: number, patch: Partial<GoodsRow>) {
    setGoods((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  }

  function addGoods() {
    setGoods((prev) => [...prev, newGoodsRow()]);
  }

  function removeGoods(key: number) {
    setGoods((prev) => (prev.length > 1 ? prev.filter((g) => g.key !== key) : prev));
  }

  function toggleAddon(id: number) {
    setSelectedAddonIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
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

  const insuranceServiceOptions = INSURANCE_SERVICES[customerType];
  const selectedInsuranceService = insuranceServiceOptions.find((s) => s.code === insuranceService) ?? insuranceServiceOptions[0];
  const estimatedPremium = insuranceEnabled ? (Number(declaredValue) || 0) * selectedInsuranceService.multiplier : 0;

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

    const effectivePackages: ShipmentPackageInput[] = packages.map((p) =>
      p.is_document
        ? { weight: p.weight, quantity: p.quantity, description: p.description, is_document: true }
        : {
            weight: p.weight,
            length: p.length,
            width: p.width,
            height: p.height,
            quantity: p.quantity,
            description: p.description,
            is_document: false,
          },
    );

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
    };

    setLoading(true);
    try {
      const res = await checkRate(payload);
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check rate. Please try again.");
    } finally {
      setLoading(false);
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

  return (
    <div>
      <PageHeader title="Create Shipment / Check Rate" description="Origin: Thailand — Destination: international only" />

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
            {CUSTOMER_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.description}
                onClick={() => setCustomerType(opt.value)}
                className={`relative flex min-w-[120px] items-center justify-center gap-1.5 rounded-lg border px-5 py-1.5 text-xs font-semibold transition ${
                  customerType === opt.value
                    ? "border-brand-amber bg-amber-50 text-amber-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {customerType === opt.value && <CheckCircle2 className="h-3.5 w-3.5 text-brand-amber" />}
                {opt.label}
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
            <button
              type="button"
              onClick={() => setShowAutoFill(true)}
              className="text-xs font-medium text-amber-600 hover:underline"
            >
              + Add address automatically
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Contact Name</span>
                <div className="relative">
                  <input type="text" value={originContactName} onChange={(e) => setOriginContactName(e.target.value)} placeholder="e.g. John Smith" className={`${inputClass} ${originContactName ? "pr-8" : ""}`} />
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
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Ship To</h2>
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Contact Name</span>
                <div className="relative">
                  <input
                    type="text"
                    value={destinationContactName}
                    onChange={(e) => setDestinationContactName(e.target.value)}
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
            <div className="flex-1 rounded-lg border border-slate-100 bg-slate-50 p-2.5 lg:border-0 lg:bg-transparent lg:p-0">
              {supplies.length === 0 ? (
                <p className="text-sm text-slate-400">No supplies available.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
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

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
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
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-4 flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Rate Quotes</h2>
            {!results ? (
              <p className="text-sm text-slate-400">Fill in package details and click &quot;Check Rate&quot; to see live quotes from UPS/DHL here.</p>
            ) : (
              <>
                <div className="flex flex-col gap-2.5">
                  {okResults.map((r, i) => {
                    const agentLogo = agents.find((a) => a.agent_code === r.carrier)?.logo_url;
                    return (
                      <div key={`${r.carrier}-${r.accountId}-${r.serviceCode}-${i}`} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {agentLogo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={agentLogo} alt={r.carrier} className="h-5 w-auto object-contain" />
                            ) : (
                              <Tag className="h-4 w-4 text-slate-300" />
                            )}
                            <span className="text-sm font-semibold text-slate-700">{r.carrier}</span>
                          </div>
                          <span className="text-sm font-bold text-brand-navy-dark">
                            {(r.negotiated ?? r.published ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {r.currency}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{r.serviceLabel}</p>
                        <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                          <span>{r.username}</span>
                          <span>{r.transitDays != null ? `${r.transitDays} days` : "-"}</span>
                        </div>
                        {r.chargeBreakdown && r.chargeBreakdown.length > 0 && (
                          <div className="mt-2 flex flex-col gap-0.5 border-t border-slate-100 pt-2">
                            {r.chargeBreakdown.map((line, li) => (
                              <div key={li} className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">
                                  {line.description}
                                  {line.code ? <span className="text-slate-300"> ({line.code})</span> : null}
                                </span>
                                <span className="font-medium text-slate-600">
                                  {line.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {line.currency}
                                </span>
                              </div>
                            ))}
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
                    className="flex items-center gap-2 rounded-lg bg-brand-amber px-6 py-2.5 text-sm font-semibold text-brand-navy-dark shadow-sm hover:bg-brand-amber/90"
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
        </>
      )}

      {step === 3 && (
        <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Payment Method</h2>
          <label className="flex max-w-xs flex-col gap-1">
            <span className={labelClass}>Payment Method</span>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
              <option value="company_account">Company Account</option>
              <option value="cod">Cash on Delivery</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Insurance</h2>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={insuranceEnabled}
                onChange={(e) => setInsuranceEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
              />
              Add insurance
            </label>
          </div>
          {insuranceEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Service</span>
                <select value={insuranceService} onChange={(e) => setInsuranceService(e.target.value)} className={inputClass}>
                  {insuranceServiceOptions.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label} ({(s.multiplier * 100).toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Declared Value (THB)</span>
                <input
                  type="number"
                  min={0}
                  value={declaredValue}
                  onChange={(e) => setDeclaredValue(e.target.value)}
                  className={inputClass}
                />
              </label>
              <p className="col-span-2 flex items-center gap-1 text-xs text-slate-500">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Estimated premium: {estimatedPremium.toLocaleString(undefined, { maximumFractionDigits: 2 })} THB
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Tag className="h-4 w-4" /> Add-on
        </h2>
        {addonItems.length === 0 ? (
          <p className="text-sm text-slate-400">No add-on items configured.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(addonByCategory).map(([category, catItems]) => (
              <div key={category}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{category}</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {catItems.map((item) => {
                    const checked = selectedAddonIds.includes(item.id);
                    return (
                      <label
                        key={item.id}
                        className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm ${
                          checked ? "border-brand-amber bg-amber-50" : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAddon(item.id)}
                            className="h-4 w-4 rounded border-slate-300 accent-brand-amber"
                          />
                          <span>
                            {item.name}
                            <span className="ml-1 text-xs text-slate-400">({item.carriers.join("/")})</span>
                          </span>
                        </span>
                        {item.price_type === "FIXED" ? (
                          <span className="text-xs font-medium text-slate-500">
                            {item.price != null ? Number(item.price).toLocaleString() : "-"} THB
                          </span>
                        ) : (
                          checked && (
                            <input
                              type="number"
                              min={0}
                              placeholder="Price"
                              value={addonPrices[item.id] ?? ""}
                              onChange={(e) => setAddonPrices((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
                            />
                          )
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 border-t-4 border-t-brand-amber bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <FileText className="h-4 w-4" /> Description of Goods (Customs Declaration)
        </h2>
        <div className="flex flex-col gap-2.5">
          {goods.map((g) => (
            <div key={g.key} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Item Name</span>
                <input
                  type="text"
                  value={g.name}
                  onChange={(e) => updateGoods(g.key, { name: e.target.value })}
                  className="w-48 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>HS Code</span>
                <input
                  type="text"
                  value={g.hsCode}
                  onChange={(e) => updateGoods(g.key, { hsCode: e.target.value })}
                  className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Qty</span>
                <input
                  type="number"
                  min={1}
                  value={g.quantity}
                  onChange={(e) => updateGoods(g.key, { quantity: Number(e.target.value) })}
                  className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelClass}>Value (THB)</span>
                <input
                  type="number"
                  min={0}
                  value={g.value}
                  onChange={(e) => updateGoods(g.key, { value: Number(e.target.value) })}
                  className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
                />
              </label>
              <button
                type="button"
                onClick={() => removeGoods(g.key)}
                disabled={goods.length <= 1}
                className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Remove item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addGoods}
          className="mt-3 flex items-center gap-1 text-sm font-medium text-amber-600 hover:underline"
        >
          <Plus className="h-4 w-4" /> Add item
        </button>
      </div>

      <div className="mt-4 flex justify-start">
        <button
          type="button"
          onClick={() => setStep(2)}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
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
    </div>
  );
}
