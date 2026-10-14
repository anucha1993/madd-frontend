"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

type Props = {
  data: unknown;
  // Height / padding of the dark code box, e.g. "max-h-[65vh] p-4 text-xs".
  className?: string;
};

/**
 * A carrier's raw JSON (rate quote / booking response) with a search box: every match is
 * highlighted, ↑ / ↓ (or Enter / Shift+Enter) jumps between them.
 */
export default function RawJsonViewer({ data, className = "max-h-[65vh] p-4 text-xs" }: Props) {
  const text = useMemo(() => JSON.stringify(data, null, 2) ?? "", [data]);
  const [query, setQuery] = useState("");
  const [current, setCurrent] = useState(0);
  const boxRef = useRef<HTMLPreElement>(null);

  // Text split around every (case-insensitive) match.
  const parts = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    const lower = text.toLowerCase();
    const needle = q.toLowerCase();
    const out: { text: string; match: boolean }[] = [];
    let from = 0;
    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + needle.length)) {
      if (at > from) out.push({ text: text.slice(from, at), match: false });
      out.push({ text: text.slice(at, at + needle.length), match: true });
      from = at + needle.length;
    }
    out.push({ text: text.slice(from), match: false });
    return out;
  }, [text, query]);
  const total = parts ? parts.filter((p) => p.match).length : 0;
  const active = total ? ((current % total) + total) % total : 0;

  // Keep the active match in view.
  useEffect(() => {
    boxRef.current?.querySelector(`[data-match="${active}"]`)?.scrollIntoView({ block: "center" });
  }, [active, parts]);

  let matchIndex = -1;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            autoFocus
            onChange={(e) => {
              setQuery(e.target.value);
              setCurrent(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setCurrent((c) => c + (e.shiftKey ? -1 : 1));
              }
            }}
            placeholder="ค้นหาใน JSON เช่น 119001, Additional Handling, BillingWeight…"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-brand-navy focus:bg-white focus:ring-2 focus:ring-brand-navy/15"
          />
        </div>
        {query.trim() !== "" && (
          <span className={`w-20 shrink-0 text-right text-xs ${total ? "text-slate-500" : "text-red-500"}`}>
            {total ? `${active + 1} / ${total}` : "ไม่พบ"}
          </span>
        )}
        <button
          type="button"
          onClick={() => setCurrent((c) => c - 1)}
          disabled={!total}
          className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          aria-label="ก่อนหน้า"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setCurrent((c) => c + 1)}
          disabled={!total}
          className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          aria-label="ถัดไป"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <pre ref={boxRef} className={`overflow-auto rounded-lg bg-slate-900 text-slate-100 ${className}`}>
        {parts
          ? parts.map((p, i) => {
              if (!p.match) return <span key={i}>{p.text}</span>;
              matchIndex++;
              return (
                <mark
                  key={i}
                  data-match={matchIndex}
                  className={`rounded-sm ${matchIndex === active ? "bg-orange-400 text-slate-900" : "bg-yellow-300/70 text-slate-900"}`}
                >
                  {p.text}
                </mark>
              );
            })
          : text}
      </pre>
    </div>
  );
}
