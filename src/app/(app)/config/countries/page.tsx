"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, Search, Upload } from "lucide-react";
import { useAccess } from "@/components/auth/AccessProvider";
import PageHeader from "@/components/layout/PageHeader";
import PageLoading from "@/components/ui/PageLoading";
import ZonePricesPanel from "@/components/countries/ZonePricesPanel";
import {
  downloadCountryZones,
  importCountryZones,
  listCountries,
  syncCountries,
  updateCountryStatus,
  updateCountryZones,
  type Country,
} from "@/lib/countries";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15";

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function FlagIcon({ iso2, name }: { iso2: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className="inline-block h-[15px] w-[20px] rounded-sm bg-slate-100" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/24x18/${iso2.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/48x36/${iso2.toLowerCase()}.png 2x`}
      alt={name}
      width={20}
      height={15}
      loading="lazy"
      className="inline-block rounded-sm border border-slate-200 object-cover"
      onError={() => setBroken(true)}
    />
  );
}

export default function CountriesPage() {
  const { can } = useAccess();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  // Staff's own zones per carrier + prices per zone ({ZONE_PRICE} in Fixed Charges / Mark-up).
  const canZones = can("config.zone_prices");
  const [tab, setTab] = useState<"countries" | "prices">("countries");
  const [uploadingZones, setUploadingZones] = useState(false);
  const zoneFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      setCountries(await listCountries());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load countries");
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage("");
    setError("");
    try {
      const res = await syncCountries();
      setSyncMessage(res.message);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync countries from restcountries.com");
    } finally {
      setSyncing(false);
    }
  }

  async function handleZoneChange(country: Country, column: "ups_zone" | "dhl_zone", value: string) {
    const zone = value.trim().toUpperCase() || null;
    if (zone === country[column]) return;
    setError("");
    try {
      const updated = await updateCountryZones(country.id, { [column]: zone });
      setCountries((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึก Zone ไม่สำเร็จ");
    }
  }

  async function handleZoneUpload(file: File) {
    setUploadingZones(true);
    setError("");
    setSyncMessage("");
    try {
      const res = await importCountryZones(file);
      setSyncMessage(res.message);
      setCountries(await listCountries());
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลด Zone ไม่สำเร็จ");
    } finally {
      setUploadingZones(false);
      if (zoneFileRef.current) zoneFileRef.current.value = "";
    }
  }

  async function handleZoneDownload() {
    setError("");
    try {
      await downloadCountryZones();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ดาวน์โหลดไม่สำเร็จ");
    }
  }

  async function handleToggleStatus(country: Country) {
    const updated = await updateCountryStatus(country.id, !country.status);
    setCountries((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  const searchTerm = search.trim().toLowerCase();
  const visibleCountries = countries.filter(
    (c) =>
      !searchTerm ||
      c.name.toLowerCase().includes(searchTerm) ||
      c.iso2.toLowerCase().includes(searchTerm) ||
      (c.region ?? "").toLowerCase().includes(searchTerm) ||
      // "z1" / "zone 1" finds every country in UPS or DHL zone 1
      ((/^z(one)?\s*/.test(searchTerm) || false) &&
        [c.ups_zone, c.dhl_zone].some((z) => z && z.toLowerCase() === searchTerm.replace(/^z(one)?\s*/, "")))
  );
  const totalPages = Math.max(1, Math.ceil(visibleCountries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedCountries = visibleCountries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const rangeStart = visibleCountries.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, visibleCountries.length);

  return (
    <div>
      <PageHeader
        title="Countries"
        description="รายชื่อประเทศที่ใช้เป็นปลายทางในหน้า Create Shipment — ซิงค์จาก restcountries.com, เปิด/ปิดการใช้งาน และตั้ง Zone / ราคาตาม Zone เองได้"
      />

      {canZones && (
        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200">
          {(
            [
              ["countries", "ประเทศ & Zone"],
              ["prices", "ราคาตาม Zone"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
                tab === key ? "border-brand-navy text-brand-navy" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <PageLoading label="Loading Countries..." />
      ) : canZones && tab === "prices" ? (
        <ZonePricesPanel countries={countries} />
      ) : (
        <>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {syncMessage && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">{syncMessage}</p>}

          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="flex flex-1 min-w-[200px] flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-600">Search</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={canZones ? "Name, ISO2, region, z1 (Zone 1)..." : "Name, ISO2, region..."}
                  className={`${inputClass} pl-9`}
                />
              </div>
            </label>
            {canZones && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleZoneDownload}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Download Zone (Template + ข้อมูล)
                </button>
                <button
                  type="button"
                  onClick={() => zoneFileRef.current?.click()}
                  disabled={uploadingZones}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  {uploadingZones ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload Zone
                </button>
                <input
                  ref={zoneFileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleZoneUpload(file);
                  }}
                />
              </div>
            )}
            {can("config.countries_sync") && (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 rounded-lg bg-brand-navy-dark px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy-dark/90 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync from restcountries.com"}
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-gradient-to-r from-brand-navy-dark to-brand-navy text-xs uppercase text-white/90">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Flag</th>
                  <th className="px-5 py-2.5 font-medium">ISO2</th>
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-5 py-2.5 font-medium">Region</th>
                  <th className="px-5 py-2.5 font-medium">Subregion</th>
                  {canZones && <th className="px-5 py-2.5 font-medium">UPS Zone</th>}
                  {canZones && <th className="px-5 py-2.5 font-medium">DHL Zone</th>}
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleCountries.length === 0 ? (
                  <tr>
                    <td colSpan={canZones ? 8 : 6} className="px-5 py-6 text-center text-sm text-slate-400">
                      {countries.length === 0
                        ? 'No countries yet. Click "Sync from restcountries.com" to load them.'
                        : "No matching countries."}
                    </td>
                  </tr>
                ) : (
                  pagedCountries.map((c) => (
                    <tr key={c.id} className="border-b border-slate-200 last:border-0">
                      <td className="px-5 py-3">
                        <FlagIcon iso2={c.iso2} name={c.name} />
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-700">{c.iso2}</td>
                      <td className="px-5 py-3 text-slate-500">{c.name}</td>
                      <td className="px-5 py-3 text-slate-500">{c.region ?? "-"}</td>
                      <td className="px-5 py-3 text-slate-500">{c.subregion ?? "-"}</td>
                      {canZones &&
                        (["ups_zone", "dhl_zone"] as const).map((column) => (
                          <td key={column} className="px-5 py-2">
                            <input
                              // Re-mount on save/upload so the field shows the stored value.
                              key={`${c.id}-${column}-${c[column] ?? ""}`}
                              defaultValue={c[column] ?? ""}
                              onBlur={(e) => handleZoneChange(c, column, e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                              placeholder="-"
                              className="w-16 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-center text-sm text-slate-700 outline-none focus:border-brand-navy focus:bg-white"
                            />
                          </td>
                        ))}
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(c)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            c.status ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {c.status ? "Active" : "Inactive"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <span>
                Showing {rangeStart}-{rangeEnd} of {visibleCountries.length}
              </span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-sm text-slate-700 outline-none focus:border-brand-navy"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <span className="font-medium text-slate-600">
                Page {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
