"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { Branch } from "@/lib/branches";

type Props = {
  branches: Branch[];
  value: number | null;
  onChange: (id: number | null) => void;
  className?: string;
};

function label(b: Branch): string {
  return `${b.name} (${b.code})`;
}

// Searchable Branch combobox — replaces a plain native <select> (which renders an unstyled
// system list and gives no way to tell branches apart when several share the same `name`,
// e.g. several branches all labeled with the company name) with a filterable, styled dropdown
// that shows both the branch name and its unique code.
export default function BranchSelect({ branches, value, onChange, className }: Props) {
  const selected = branches.find((b) => b.id === value) ?? null;
  const [query, setQuery] = useState(selected ? label(selected) : "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(selected ? label(selected) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, branches.length]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(selected ? label(selected) : "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const term = query.trim().toLowerCase();
  const results =
    open && term && term !== (selected ? label(selected).toLowerCase() : "")
      ? branches.filter((b) => `${b.name} ${b.code} ${b.company_name}`.toLowerCase().includes(term))
      : branches;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Select branch..."
          className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
        />
      </div>
      {open && (
        <div className="absolute right-0 z-20 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No branches found.</p>
          ) : (
            results.map((b) => (
              <button
                type="button"
                key={b.id}
                onClick={() => {
                  onChange(b.id);
                  setOpen(false);
                }}
                className={`flex w-full flex-col items-start gap-0.5 border-b border-slate-50 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50 ${
                  b.id === value ? "bg-amber-50" : ""
                }`}
              >
                <span className="font-medium text-slate-700">{b.name}</span>
                <span className="text-xs text-slate-400">
                  {b.code} — {b.company_name}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
