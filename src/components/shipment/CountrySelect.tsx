"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { listCountries, type Country } from "@/lib/countries";

type Props = {
  value: string;
  onChange: (code: string) => void;
};

/** Searchable Country dropdown — shows "Name (ISO2)" and filters as you type.
 * Sourced from our own `countries` table (synced from restcountries.com), not a
 * hardcoded list, so it reflects whatever is toggled active in Country Settings. */
export default function CountrySelect({ value, onChange }: Props) {
  const [countries, setCountries] = useState<Country[]>([]);
  const selected = countries.find((c) => c.iso2 === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listCountries()
      .then((all) => setCountries(all.filter((c) => c.status)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setQuery(selected ? `${selected.name} (${selected.iso2})` : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, countries.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const term = query.trim().toLowerCase();
  const results =
    open && term
      ? countries.filter((c) => c.name.toLowerCase().includes(term) || c.iso2.toLowerCase().includes(term))
      : countries;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search country..."
          className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
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
        </div>
      )}
    </div>
  );
}

