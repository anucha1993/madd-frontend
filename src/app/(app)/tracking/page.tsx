"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileImage,
  IdCard,
  MapPin,
  Package,
  PackageCheck,
  Search,
  Truck,
} from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
import { listAgentAccounts, type AgentAccount } from "@/lib/agentAccounts";
import { trackDhlShipment } from "@/lib/dhlTracking";
import { trackUpsShipment, type UpsTrackingAccount, type UpsTrackingActivity, type UpsTrackingPackage } from "@/lib/upsTracking";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";

type Carrier = "ups" | "dhl";
type SearchMode = "inquiry" | "reference";

type Tone = {
  badge: string;
  dot: string;
  iconBg: string;
  iconColor: string;
  topBar: string;
  icon: typeof CheckCircle2;
};

const TONES: Record<"delivered" | "exception" | "transit" | "pickup" | "default", Tone> = {
  delivered: {
    badge: "bg-emerald-50 text-emerald-600",
    dot: "bg-emerald-500",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    topBar: "from-emerald-500 to-emerald-400",
    icon: CheckCircle2,
  },
  exception: {
    badge: "bg-amber-50 text-amber-600",
    dot: "bg-amber-500",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    topBar: "from-amber-500 to-red-400",
    icon: AlertTriangle,
  },
  transit: {
    badge: "bg-sky-50 text-sky-600",
    dot: "bg-sky-500",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    topBar: "from-sky-500 to-brand-navy",
    icon: Truck,
  },
  pickup: {
    badge: "bg-violet-50 text-violet-600",
    dot: "bg-violet-500",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    topBar: "from-violet-500 to-sky-400",
    icon: PackageCheck,
  },
  default: {
    badge: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
    topBar: "from-slate-400 to-slate-300",
    icon: MapPin,
  },
};

function classifyText(text: string | null): keyof typeof TONES {
  const t = (text ?? "").toLowerCase();
  if (t.includes("delivered") || t.includes("success")) return "delivered";
  if (t.includes("delay") || t.includes("exception") || t.includes("late") || t.includes("damage") || t.includes("fail")) return "exception";
  if (t.includes("pickup") || t.includes("drop-off") || t.includes("label")) return "pickup";
  if (t.includes("transit") || t.includes("departed") || t.includes("arrived") || t.includes("out for delivery") || t.includes("processing"))
    return "transit";
  return "default";
}

function getPackageTone(pkg: UpsTrackingPackage): Tone {
  return TONES[classifyText(pkg.currentStatusDescription)];
}

function getActivityTone(activity: UpsTrackingActivity): Tone {
  return TONES[classifyText(activity.description)];
}

function PackageCard({ pkg }: { pkg: UpsTrackingPackage }) {
  const tone = getPackageTone(pkg);
  const StatusIcon = tone.icon;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`h-1.5 w-full bg-gradient-to-r ${tone.topBar}`} />
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`flex h-8 w-8 items-center justify-center rounded-full ${tone.iconBg}`}>
              <Package className={`h-4 w-4 ${tone.iconColor}`} />
            </span>
            <span className="font-mono text-sm font-semibold text-slate-700">{pkg.trackingNumber ?? "-"}</span>
          </div>
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${tone.badge}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {pkg.currentStatusDescription ?? "Unknown"}
          </span>
        </div>

        {pkg.scheduledDeliveryDate && (
          <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-brand-navy/5 px-3 py-1.5 text-sm text-brand-navy">
            <Clock className="h-3.5 w-3.5" />
            Scheduled delivery: <span className="font-semibold">{pkg.scheduledDeliveryDate}</span>
          </p>
        )}

        {(pkg.podImageBase64 || pkg.signatureImageBase64) && (
          <div className="mb-3 flex flex-wrap gap-3 rounded-lg bg-emerald-50/60 p-3">
            {pkg.podImageBase64 && (
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <FileImage className="h-4 w-4" />
                <a
                  href={`data:application/octet-stream;base64,${pkg.podImageBase64}`}
                  download={`${pkg.trackingNumber ?? "pod"}.pdf`}
                  className="font-medium underline decoration-emerald-300 hover:text-emerald-800"
                >
                  Download Proof of Delivery
                </a>
              </div>
            )}
            {pkg.signatureImageBase64 && (
              <div className="flex items-center gap-2 text-xs text-emerald-700">
                <img
                  src={`data:image/gif;base64,${pkg.signatureImageBase64}`}
                  alt="Signature"
                  className="h-10 rounded border border-emerald-200 bg-white"
                />
                <span>Signature</span>
              </div>
            )}
          </div>
        )}

        {pkg.activities.length > 0 && (
          <ol className="space-y-3 border-l-2 border-slate-100 pl-4">
            {pkg.activities.map((a, i) => {
              const aTone = getActivityTone(a);
              return (
                <li key={i} className="relative">
                  <span
                    className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${
                      i === 0 ? aTone.dot : "bg-slate-300"
                    }`}
                  />
                  <p className={`text-sm font-medium ${i === 0 ? "text-slate-800" : "text-slate-600"}`}>
                    {a.description ?? "-"}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                    <span>
                      {a.date ?? ""} {a.time ?? ""}
                    </span>
                    {a.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {a.location}
                      </span>
                    )}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

export default function TrackingPage() {
  const [carrier, setCarrier] = useState<Carrier>("ups");
  const [mode, setMode] = useState<SearchMode>("inquiry");
  const [number, setNumber] = useState("");
  const [accounts, setAccounts] = useState<AgentAccount[]>([]);
  const [agentAccountId, setAgentAccountId] = useState<number | "">("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [returnPod, setReturnPod] = useState(false);
  const [returnSignature, setReturnSignature] = useState(false);
  const [offset, setOffset] = useState("");
  const [count, setCount] = useState("");
  const [fromPickupDate, setFromPickupDate] = useState("");
  const [toPickupDate, setToPickupDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [packages, setPackages] = useState<UpsTrackingPackage[] | null>(null);
  const [usedAccount, setUsedAccount] = useState<UpsTrackingAccount | null>(null);

  useEffect(() => {
    listAgentAccounts()
      .then(setAccounts)
      .catch(() => {});
  }, []);

  const upsAccounts = useMemo(() => accounts.filter((a) => a.agent?.agent_code === "UPS" && a.status), [accounts]);
  const dhlAccounts = useMemo(() => accounts.filter((a) => a.agent?.agent_code === "DHL" && a.status), [accounts]);
  const carrierAccounts = carrier === "ups" ? upsAccounts : dhlAccounts;

  function handleCarrierChange(next: Carrier) {
    setCarrier(next);
    setAgentAccountId("");
    if (next === "dhl") setMode("inquiry");
  }

  async function handleTrack() {
    if (!number.trim()) return;
    setLoading(true);
    setError("");
    setPackages(null);
    setUsedAccount(null);
    try {
      const res =
        carrier === "dhl"
          ? await trackDhlShipment({
              trackingNumber: number.trim(),
              agentAccountId: agentAccountId === "" ? undefined : agentAccountId,
            })
          : await trackUpsShipment({
              mode,
              number: number.trim(),
              agentAccountId: agentAccountId === "" ? undefined : agentAccountId,
              returnPod,
              returnSignature,
              offset: mode === "inquiry" && offset ? Number(offset) : undefined,
              count: mode === "inquiry" && count ? Number(count) : undefined,
              fromPickupDate: mode === "reference" && fromPickupDate ? fromPickupDate : undefined,
              toPickupDate: mode === "reference" && toPickupDate ? toPickupDate : undefined,
            });
      setPackages(res.packages);
      setUsedAccount(res.account ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to track shipment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Tracking"
        description="ติดตามสถานะพัสดุ UPS หรือ DHL แบบ Real-time ด้วยเลข Tracking Number หรือ Reference Number"
      />

      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5 w-full bg-gradient-to-r from-brand-navy-dark via-sky-500 to-brand-amber" />
        <div className="p-4">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => handleCarrierChange("ups")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition ${
              carrier === "ups" ? "bg-amber-500 text-brand-navy-dark shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            UPS
          </button>
          <button
            type="button"
            onClick={() => handleCarrierChange("dhl")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition ${
              carrier === "dhl" ? "bg-red-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            DHL
          </button>
        </div>

        {carrier === "ups" && (
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("inquiry")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                mode === "inquiry" ? "bg-brand-navy-dark text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Package className="h-4 w-4" />
              Tracking Number
            </button>
            <button
              type="button"
              onClick={() => setMode("reference")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                mode === "reference" ? "bg-violet-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <FileImage className="h-4 w-4" />
              Reference Number
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 min-w-[240px] flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-600">
              {carrier === "dhl"
                ? "DHL Waybill / Tracking Number"
                : mode === "inquiry"
                  ? "UPS Tracking Number"
                  : "Reference Number (Order ID / Invoice)"}
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTrack()}
                placeholder={carrier === "dhl" ? "1234567890" : mode === "inquiry" ? "1Z999AA10123456784" : "ORDER-00123"}
                className={`${inputClass} pl-9`}
              />
            </div>
          </label>

          {carrierAccounts.length > 1 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">{carrier === "ups" ? "UPS Account" : "DHL Account"}</span>
              <select
                value={agentAccountId}
                onChange={(e) => setAgentAccountId(e.target.value ? Number(e.target.value) : "")}
                className={inputClass}
              >
                <option value="">Auto (first active)</option>
                {carrierAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username_acc}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            onClick={handleTrack}
            disabled={loading || !number.trim()}
            className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold shadow-sm hover:brightness-105 disabled:opacity-60 ${
              carrier === "dhl"
                ? "bg-gradient-to-r from-red-600 to-red-500 text-white"
                : "bg-gradient-to-r from-brand-amber to-amber-400 text-brand-navy-dark"
            }`}
          >
            <Truck className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
            {loading ? "Tracking..." : "Track"}
          </button>
        </div>

        {carrier === "ups" && (
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-navy/70 hover:text-brand-navy"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            Advanced options
          </button>
        )}

        {carrier === "ups" && showAdvanced && (
          <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border-t border-slate-100 bg-slate-50/60 p-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={returnPod} onChange={(e) => setReturnPod(e.target.checked)} />
              Return Proof of Delivery
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={returnSignature}
                onChange={(e) => setReturnSignature(e.target.checked)}
              />
              Return Signature
            </label>

            {mode === "inquiry" ? (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-500">Offset</span>
                  <input
                    type="number"
                    min={0}
                    value={offset}
                    onChange={(e) => setOffset(e.target.value)}
                    className={`${inputClass} w-24`}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-500">Count</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    className={`${inputClass} w-24`}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-500">From Pickup Date</span>
                  <input
                    type="date"
                    value={fromPickupDate}
                    onChange={(e) => setFromPickupDate(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-slate-500">To Pickup Date</span>
                  <input
                    type="date"
                    value={toPickupDate}
                    onChange={(e) => setToPickupDate(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </>
            )}
          </div>
        )}
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {usedAccount && (packages?.length ?? 0) > 0 && (
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-slate-400" title="บัญชี API ที่ระบบใช้เชื่อมต่อเพื่อดึงข้อมูล ไม่ใช่บัญชีเจ้าของ shipment นี้">
          <IdCard className="h-3.5 w-3.5" />
          ค้นหาด้วย API credential ({usedAccount.agent_code}):
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-slate-600">{usedAccount.username_acc}</span>
        </p>
      )}

      {packages && packages.length === 0 && !error && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">No tracking results found.</p>
      )}

      {packages && packages.length > 0 && (
        <div className="space-y-4">
          {packages.map((pkg, i) => (
            <PackageCard key={pkg.trackingNumber ?? i} pkg={pkg} />
          ))}
        </div>
      )}

      {!packages && !loading && !error && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-sky-200 bg-gradient-to-b from-sky-50/60 to-white py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-100">
            <Truck className="h-7 w-7 text-sky-500" />
          </span>
          <p className="text-sm text-slate-500">กรอกเลข Tracking หรือ Reference แล้วกด Track เพื่อดูสถานะพัสดุ</p>
        </div>
      )}
    </div>
  );
}
