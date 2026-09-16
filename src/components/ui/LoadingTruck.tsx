"use client";

/** Loading indicator: two rings spinning opposite ways (amber outer / gray-navy inner)
 * around a pulsing center dot, with an animated "..." after the label. Pass
 * `animate={false}` to freeze it. */
export function TruckRouteGraphic({
  label,
  invert = false,
  animate = true,
  size = "5rem",
}: {
  label?: string;
  invert?: boolean;
  animate?: boolean;
  size?: string;
}) {
  const dotColor = invert ? "var(--color-brand-navy-dark)" : "#fff";

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className={`absolute inset-0 rounded-full ${animate ? "madd-arc-spin" : ""}`}
          style={{ border: "3px solid transparent", borderTopColor: "var(--color-brand-amber)" }}
        />
        <div
          className={`absolute rounded-full ${animate ? "madd-arc-spin-reverse" : ""}`}
          style={{ inset: "15%", border: "3px solid transparent", borderTopColor: "var(--color-brand-navy)" }}
        />
        <span
          className={`absolute left-1/2 top-1/2 rounded-full ${animate ? "madd-dot-grow" : ""}`}
          style={{
            width: `calc(${size} * 0.35)`,
            height: `calc(${size} * 0.35)`,
            marginLeft: `calc(${size} * -0.175)`,
            marginTop: `calc(${size} * -0.175)`,
            background: dotColor,
          }}
        />
      </div>
      {label && (
        <p className={`flex text-sm font-medium ${invert ? "text-brand-navy-dark" : "text-slate-300"}`}>
          {label}
          {animate && <span className="madd-loading-dots" aria-hidden />}
        </p>
      )}
    </div>
  );
}

type Props = {
  label?: string;
  fullScreen?: boolean;
  className?: string;
};

/**
 * fullScreen covers the nearest `relative` ancestor (e.g. the page content area)
 * with `absolute inset-0` — NOT the whole viewport — so the sidebar/topbar stay
 * visible and usable while a page's data is loading.
 */
export default function LoadingTruck({ label = "Loading...", fullScreen = false, className = "" }: Props) {
  if (fullScreen) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center">
        <TruckRouteGraphic label={label} invert />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center rounded-2xl bg-brand-navy-dark py-10 ${className}`}>
      <TruckRouteGraphic label={label} />
    </div>
  );
}
