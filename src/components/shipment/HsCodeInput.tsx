"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { lookupHsCodes, type HsCode } from "@/lib/hsCodes";

type Props = {
  value: string;
  onChange: (text: string) => void;
  // A row picked from the list — without it the field just takes the row's code.
  onPick?: (hsCode: HsCode) => void;
  // "code": the HS Code field (shows the picked code's description under it).
  // "description": the goods Description field — searches the same list by product name.
  mode?: "code" | "description";
  placeholder?: string;
  className?: string;
};

const LIST_WIDTH = 320;

// HS Code field with a lookup dropdown from /config/hs-codes (search by code or product). Any
// code can still be typed by hand — the list is a helper, not a restriction. The list is portaled
// to <body> with fixed positioning: the Commercial Invoice table scrolls horizontally, and an
// absolutely-positioned list inside it would be clipped out of sight.
export default function HsCodeInput({ value, onChange, onPick, mode = "code", placeholder, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<HsCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // Description of the code now in the field (when it's in the list) — shown under the input.
  const [described, setDescribed] = useState<{ code: string; description: string } | null>(null);

  const query = value.trim();
  const showList = open && query.length >= 2;

  useEffect(() => {
    if (!showList) return;
    const t = setTimeout(() => {
      setLoading(true);
      lookupHsCodes(query)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [showList, query]);

  // A code typed by hand or loaded from a draft gets its description too, once it's a full code.
  const digits = mode === "code" ? value.replace(/\D/g, "") : "";
  useEffect(() => {
    if (digits.length < 6 || described?.code === digits) return;
    const t = setTimeout(() => {
      lookupHsCodes(digits)
        .then((rows) => {
          const hit = rows.find((r) => r.code === digits);
          setDescribed(hit ? { code: hit.code, description: hit.description } : null);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [digits, described?.code]);
  const description = described && described.code === digits ? described.description : null;

  // Keep the list under the input while the page or the table scrolls.
  useLayoutEffect(() => {
    if (!showList) return;
    const place = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.right - LIST_WIDTH, window.innerWidth - LIST_WIDTH - 8)) });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [showList]);

  return (
    <>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={className}
        title={description ?? undefined}
      />
      {description && (
        <p className="truncate px-1.5 text-[10px] leading-tight text-slate-500" title={description}>
          {description}
        </p>
      )}
      {showList &&
        pos &&
        createPortal(
          <div
            style={{ position: "fixed", top: pos.top, left: pos.left, width: LIST_WIDTH }}
            className="z-[100] max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white text-left shadow-lg"
          >
            {results.length > 0 ? (
              results.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (onPick) onPick(r);
                    else onChange(r.code);
                    setDescribed({ code: r.code, description: r.description });
                    setOpen(false);
                  }}
                  className="flex w-full flex-col items-start border-b border-slate-50 px-3 py-1.5 text-xs last:border-0 hover:bg-slate-50"
                >
                  {mode === "description" ? (
                    <>
                      <span className="font-semibold text-slate-800">{r.description}</span>
                      <span className="font-mono text-slate-500">HS {r.code_formatted}</span>
                    </>
                  ) : (
                    <>
                      <span className="font-mono font-semibold text-slate-800">{r.code_formatted}</span>
                      <span className="text-slate-500">{r.description}</span>
                    </>
                  )}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-xs text-slate-400">
                {loading ? "กำลังค้นหา..." : `ไม่พบ "${query}" ในฐานข้อมูล HS Code — ใช้ตามที่พิมพ์ได้`}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
