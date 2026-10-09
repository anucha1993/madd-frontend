"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RateBookRow } from "@/lib/rateBook";

// Validated categorical slots 1-2 (dataviz reference palette, light surface): cost / markup.
const COST_COLOR = "#2a78d6";
const MARKUP_COLOR = "#eb6834";
const SURFACE = "#ffffff";

const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 36, left: 64 };

const money = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Carrier's own total; older runs without it fall back to the charge columns.
function costOf(r: RateBookRow) {
  if (r.cost != null) return Number(r.cost);
  return (["freight", "fuel", "surge", "remote", "peak", "gogreen", "other"] as const).reduce((sum, key) => sum + (Number(r[key]) || 0), 0);
}

// "Nice" axis maximum + step (1/2/5 × 10^n) for ~5 gridlines.
function niceScale(max: number) {
  if (max <= 0) return { top: 1, step: 1 };
  const raw = max / 5;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  return { top: Math.ceil(max / step) * step, step };
}

/**
 * Stacked area of one zone's price per shipment by weight: carrier cost underneath, markup on
 * top — the upper edge is the sell price (before VAT). Per-kg bands aren't plotted (their
 * amounts are per kg, a different unit); only the step weights are.
 */
export default function RateBookChart({ rows, zone }: { rows: RateBookRow[]; zone: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(
    () =>
      rows
        .filter((r) => r.zone === zone && !r.is_per_kg && !r.error && r.sell != null)
        .sort((a, b) => a.weight - b.weight)
        .map((r) => {
          const cost = costOf(r);
          const sell = Number(r.sell);
          return { weight: r.weight, cost, markup: sell - cost, sell };
        }),
    [rows, zone],
  );

  if (points.length < 2) {
    return <p className="py-6 text-center text-sm text-slate-400">ข้อมูลไม่พอสำหรับวาดกราฟ Zone นี้</p>;
  }

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const minW = points[0].weight;
  const maxW = points[points.length - 1].weight;
  const { top, step } = niceScale(Math.max(...points.map((p) => Math.max(p.sell, p.cost))));
  const x = (w: number) => PAD.left + ((w - minW) / (maxW - minW || 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - (Math.max(v, 0) / top) * plotH;
  const baseline = y(0);

  const costLine = points.map((p) => `${x(p.weight)},${y(p.cost)}`).join(" L");
  const sellLine = points.map((p) => `${x(p.weight)},${y(p.sell)}`).join(" L");
  const costArea = `M${x(minW)},${baseline} L${costLine} L${x(maxW)},${baseline} Z`;
  const markupArea = `M${sellLine} L${[...points].reverse().map((p) => `${x(p.weight)},${y(p.cost)}`).join(" L")} Z`;

  const yTicks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const xStep = maxW - minW > 20 ? 5 : maxW - minW > 8 ? 2 : 1;
  const xTicks = points.map((p) => p.weight).filter((w) => w % xStep === 0 || w === minW);

  const active = hover != null ? points[hover] : null;

  function handleMove(e: React.MouseEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * plotW + PAD.left;
    let nearest = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.weight) - px) < Math.abs(x(points[nearest].weight) - px)) nearest = i;
    });
    setHover(nearest);
  }

  return (
    <div ref={wrapRef} className="relative w-full">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: COST_COLOR }} /> ต้นทุน (Carrier)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm" style={{ background: MARKUP_COLOR }} /> กำไร (Markup)
        </span>
        <span className="text-slate-400">ขอบบน = ราคาขายก่อน VAT · ต่อชิ้นงาน (THB)</span>
      </div>
      <svg width={width} height={HEIGHT} role="img" aria-label={`ต้นทุนเทียบราคาขาย Zone ${zone}`}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-slate-500 text-[11px]">
              {t.toLocaleString()}
            </text>
          </g>
        ))}
        {xTicks.map((w) => (
          <text key={w} x={x(w)} y={HEIGHT - PAD.bottom + 18} textAnchor="middle" className="fill-slate-500 text-[11px]">
            {w}
          </text>
        ))}
        <text x={PAD.left + plotW / 2} y={HEIGHT - 4} textAnchor="middle" className="fill-slate-400 text-[11px]">
          น้ำหนัก (kg)
        </text>

        <path d={costArea} fill={COST_COLOR} fillOpacity={0.85} />
        <path d={markupArea} fill={MARKUP_COLOR} fillOpacity={0.85} />
        {/* 2px surface seam between the two layers, then the sell edge on top. */}
        <path d={`M${costLine}`} fill="none" stroke={SURFACE} strokeWidth={2} />
        <path d={`M${sellLine}`} fill="none" stroke={MARKUP_COLOR} strokeWidth={2} />

        {active && (
          <g pointerEvents="none">
            <line x1={x(active.weight)} x2={x(active.weight)} y1={PAD.top} y2={baseline} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(active.weight)} cy={y(active.cost)} r={4.5} fill={COST_COLOR} stroke={SURFACE} strokeWidth={2} />
            <circle cx={x(active.weight)} cy={y(active.sell)} r={4.5} fill={MARKUP_COLOR} stroke={SURFACE} strokeWidth={2} />
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute z-10 min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
          style={{
            top: PAD.top + 28,
            left: x(active.weight) > width - 220 ? x(active.weight) - 196 : x(active.weight) + 12,
          }}
        >
          <p className="mb-1 font-semibold text-slate-700">{active.weight} kg</p>
          <p className="flex justify-between gap-4 text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: COST_COLOR }} />
              ต้นทุน
            </span>
            <span className="tabular-nums">{money(active.cost)}</span>
          </p>
          <p className="flex justify-between gap-4 text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: MARKUP_COLOR }} />
              กำไร
            </span>
            <span className="tabular-nums">
              {money(active.markup)} ({active.sell > 0 ? ((active.markup / active.sell) * 100).toFixed(1) : "0"}%)
            </span>
          </p>
          <p className="mt-1 flex justify-between gap-4 border-t border-slate-100 pt-1 font-semibold text-slate-800">
            <span>ราคาขาย</span>
            <span className="tabular-nums">{money(active.sell)}</span>
          </p>
        </div>
      )}
    </div>
  );
}
