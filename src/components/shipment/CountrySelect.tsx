"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { listCountries, type Country } from "@/lib/countries";

type Props = {
  value: string;
  onChange: (code: string) => void;
  // Tighter padding/font for dense table rows (e.g. Commercial Invoice line items).
  compact?: boolean;
  // ISO2 codes to force-include even when their `status=false` in Country Settings — used
  // by the Country of Origin picker on Commercial Invoice lines so Thailand (usually
  // disabled as a valid DESTINATION) is still selectable as the goods' origin country.
  alwaysInclude?: string[];
};

/** Searchable Country dropdown — shows "Name (ISO2)" and filters as you type.
 * Sourced from our own `countries` table (synced from restcountries.com), not a
 * hardcoded list, so it reflects whatever is toggled active in Country Settings. */
export default function CountrySelect({ value, onChange, compact, alwaysInclude }: Props) {
  const [countries, setCountries] = useState<Country[]>([]);
  const selected = countries.find((c) => c.iso2 === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // The results list is rendered in a portal (see below) so it can't get clipped by an
  // ancestor `overflow-x-auto`/`overflow-hidden` (e.g. the invoice line items table wrapper).
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    listCountries()
      .then((all) => setCountries(all.filter((c) => c.status || alwaysInclude?.includes(c.iso2))))
      .catch(() => {});
    // alwaysInclude is expected to be a stable literal (e.g. ["TH"]) — no need to re-fetch on ref change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setQuery(selected ? `${selected.name} (${selected.iso2})` : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, countries.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    function updatePosition() {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  const term = query.trim().toLowerCase();
  // Rank matches by relevance instead of leaving them in plain alphabetical order —
  // otherwise an exact ISO2 match like "US" (United States) can end up buried at the
  // bottom just because "United States" comes late alphabetically among the matches.
  function matchRank(c: Country): number {
    const name = c.name.toLowerCase();
    const iso2 = c.iso2.toLowerCase();
    if (iso2 === term) return 0;
    if (name.startsWith(term)) return 1;
    if (iso2.startsWith(term)) return 2;
    if (name.includes(term)) return 3;
    return 4;
  }
  const results =
    open && term
      ? countries
          .filter((c) => c.name.toLowerCase().includes(term) || c.iso2.toLowerCase().includes(term))
          .sort((a, b) => matchRank(a) - matchRank(b) || a.name.localeCompare(b.name))
      : countries;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search country..."
          className={`w-full rounded-lg border border-slate-300 bg-slate-50 text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15 ${
            compact ? "py-1 pl-7 pr-2 text-xs" : "py-1.5 pl-9 pr-3 text-sm"
          }`}
        />
      </div>

      {open &&
        dropdownRect &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: dropdownRect.top, left: dropdownRect.left, width: dropdownRect.width }}
            className="z-50 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
          >
            {results.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-400">No countries found.</div>
            ) : (
              results.map((c) => (
                <button
                  key={c.iso2}
                  type="button"
                  onClick={() => {
                    onChange(c.iso2);
                    setQuery(`${c.name} (${c.iso2})`);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between border-b border-slate-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 ${
                    c.iso2 === value ? "bg-amber-50" : ""
                  }`}
                >
                  <span className="text-slate-700">{c.name}</span>
                  <span className="text-xs font-medium text-slate-400">{c.iso2}</span>
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

