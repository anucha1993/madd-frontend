"use client";

import { useState, type ReactNode } from "react";
import { GripVertical, MoveHorizontal } from "lucide-react";
import type { FormLayoutItem } from "@/lib/shipmentFormLayout";

type Props = {
  items: FormLayoutItem[];
  // The rendered field for each key; a key with no block is skipped.
  blocks: Record<string, ReactNode>;
  editing: boolean;
  onChange: (items: FormLayoutItem[]) => void;
  // While arranging: the label typed for each field (renamed right on the tile) — omit to hide the box.
  labels?: Record<string, string>;
  defaultLabels?: Record<string, string>;
  onLabelChange?: (key: string, label: string) => void;
};

/**
 * The Ship From / Ship To fields in a 2-column grid, in the configured order and width. In edit mode
 * ("จัดตำแหน่ง") each field becomes a drag tile with a full / half width toggle, and its inputs are
 * inert so dragging never types into them.
 */
export default function FormLayoutGrid({ items, blocks, editing, onChange, labels, defaultLabels, onLabelChange }: Props) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const moveTo = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    const moving = items.find((i) => i.key === fromKey);
    if (!moving) return;
    const rest = items.filter((i) => i.key !== fromKey);
    const at = rest.findIndex((i) => i.key === toKey);
    // Dropped on a tile further down → lands after it; further up → before it.
    const fromIndex = items.findIndex((i) => i.key === fromKey);
    const toIndex = items.findIndex((i) => i.key === toKey);
    rest.splice(toIndex > fromIndex ? at + 1 : at, 0, moving);
    onChange(rest);
  };

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((item) => {
        const block = blocks[item.key];
        if (block == null) return null;
        const span = item.width === "full" ? "col-span-2" : "col-span-1";
        if (!editing) {
          return (
            <div key={item.key} className={`${span} flex flex-col gap-1`}>
              {block}
            </div>
          );
        }
        return (
          <div
            key={item.key}
            draggable
            onDragStart={(e) => {
              setDragKey(item.key);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverKey(item.key);
            }}
            onDragLeave={() => setOverKey((k) => (k === item.key ? null : k))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragKey) moveTo(dragKey, item.key);
              setDragKey(null);
              setOverKey(null);
            }}
            onDragEnd={() => {
              setDragKey(null);
              setOverKey(null);
            }}
            className={`${span} relative cursor-grab rounded-xl border-2 border-dashed p-2 pt-7 transition active:cursor-grabbing ${
              dragKey === item.key ? "opacity-40" : ""
            } ${overKey === item.key && dragKey !== item.key ? "border-brand-amber bg-amber-50" : "border-slate-300 bg-slate-50/60"}`}
          >
            <div className="absolute inset-x-2 top-1.5 flex items-center gap-2">
              <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
              {labels && onLabelChange ? (
                <input
                  type="text"
                  value={labels[item.key] ?? ""}
                  placeholder={defaultLabels?.[item.key]}
                  maxLength={100}
                  // Typing must not start a drag of the tile.
                  draggable={false}
                  onDragStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onChange={(e) => onLabelChange(item.key, e.target.value)}
                  title="ชื่อช่อง (Label) — ว่าง = ชื่อเดิม"
                  className="min-w-0 flex-1 cursor-text rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 outline-none focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/15"
                />
              ) : (
                <span className="flex-1" />
              )}
              <button
                type="button"
                onClick={() => onChange(items.map((i) => (i.key === item.key ? { ...i, width: i.width === "full" ? "half" : "full" } : i)))}
                className="flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100"
                title="สลับความกว้าง เต็มแถว / ครึ่งแถว"
              >
                <MoveHorizontal className="h-3 w-3" />
                {item.width === "full" ? "เต็มแถว" : "ครึ่งแถว"}
              </button>
            </div>
            <div className="pointer-events-none flex select-none flex-col gap-1 opacity-80">{block}</div>
          </div>
        );
      })}
    </div>
  );
}
