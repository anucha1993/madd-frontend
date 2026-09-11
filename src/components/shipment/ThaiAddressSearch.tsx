"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import { listThaiSubdistricts, type ThaiSubdistrict } from "@/lib/thaiSubdistricts";

type Props = {
  onSelect: (row: ThaiSubdistrict) => void;
  placeholder?: string;
  /** Lets a parent (e.g. paste-and-auto-fill) programmatically set the displayed search text. */
  value?: string;
};

/** Single combined search box for subdistrict/district/province/zip code — inspired
 * by KEX Express's "sendNow" UI, which merges these 4 fields into one searchable field
 * instead of separate postcode + district inputs. */
export default function ThaiAddressSearch({ onSelect, placeholder, value }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ThaiSubdistrict[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const externalUpdate = useRef(false);

  useEffect(() => {
    if (value !== undefined && value !== query) {
      externalUpdate.current = true;
      setQuery(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (externalUpdate.current) {
      externalUpdate.current = false;
      setResults([]);
      setOpen(false);
      return;
    }
    if (query.trim().length < 3) {
      setResults([]);
      return;
    }
    const isNumeric = /^\d+$/.test(query.trim());
    setLoading(true);
    const timer = setTimeout(() => {
      listThaiSubdistricts(isNumeric ? { zip_code: query.trim(), per_page: 8 } : { q: query.trim(), per_page: 8 })
        .then((res) => {
          setResults(res.data);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Search subdistrict / district / province / postcode"}
          className={`w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15 ${
            query ? "pr-8" : ""
          }`}
        />
        {query && (
          <CheckCircle2 className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
        )}
      </div>

      {open && (loading || results.length > 0) && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading ? (
            <div className="px-3 py-2 text-sm text-slate-400">Searching...</div>
          ) : (
            results.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  onSelect(row);
                  setQuery(`${row.name_en}, ${row.district_name_en}, ${row.province_name_en} - ${row.zip_code}`);
                  setOpen(false);
                }}
                className="block w-full border-b border-slate-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"
              >
                <div>
                  <span className="font-medium text-slate-700">{row.name_th}</span>
                  <span className="text-slate-400"> — {row.district_name_th}, {row.province_name_th} {row.zip_code}</span>
                </div>
                <div className="text-xs text-slate-400">
                  {row.name_en}, {row.district_name_en}, {row.province_name_en}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
