"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

type Option = { value: string; label: string };

type Props = {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  // The look of the closed box — pass the page's own input classes so it lines up with its selects.
  className?: string;
};

/** A select box that takes several values: the chosen ones as chips, a checkbox list when opened. */
export default function MultiSelect({ options, value, onChange, placeholder = "— เลือก —", disabled, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  return (
    <div ref={ref} className="relative">
      <div
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`${className} flex min-h-[2.5rem] cursor-pointer items-center gap-1 pr-8 ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        {value.length === 0 ? (
          <span className="text-slate-400">{placeholder}</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {value.map((v) => (
              <span key={v} className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                {labelOf(v)}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(v);
                    }}
                    className="text-slate-400 hover:text-red-500"
                    aria-label={`เอา ${labelOf(v)} ออก`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </span>
        )}
        <ChevronDown className={`pointer-events-none absolute right-2.5 h-4 w-4 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div id={listId} role="listbox" aria-multiselectable className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((o) => {
            const on = value.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(o.value)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${on ? "font-medium text-brand-navy-dark" : "text-slate-700"}`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-brand-navy-dark bg-brand-navy-dark text-white" : "border-slate-300"}`}>
                  {on && <Check className="h-3 w-3" />}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
