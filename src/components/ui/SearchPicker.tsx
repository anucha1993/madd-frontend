"use client";

import { useState } from "react";
import { Search } from "lucide-react";

export type SearchPickerOption = { value: string; label: string; hint?: string };

type Props = {
  options: SearchPickerOption[];
  onPick: (value: string) => void;
  placeholder?: string;
  className?: string;
  // Open the list above the box (inside modals / near the bottom of a card).
  openUp?: boolean;
};

/**
 * A "+ add …" box: type to filter (value, label or hint), click or Enter to pick the first match.
 * Clears itself after each pick — for adding items to a list, not for holding a value.
 */
export default function SearchPicker({ options, onPick, placeholder = "ค้นหา…", className = "w-80", openUp = false }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = q
    ? options.filter((o) => o.value.toLowerCase().includes(q) || o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q))
    : options;

  const pick = (value: string) => {
    onPick(value);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Let a click on an option land before the list closes.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && matches[0]) {
            e.preventDefault();
            pick(matches[0].value);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-700 outline-none focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15"
      />
      {open && (
        <ul
          className={`absolute left-0 z-20 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg ${
            openUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-400">ไม่พบรายการ</li>
          ) : (
            matches.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.value)}
                  className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-amber-50"
                >
                  <span className="w-20 shrink-0 font-mono text-xs text-slate-500">{o.value}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-xs text-slate-400">{o.hint}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
