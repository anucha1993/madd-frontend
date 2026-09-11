"use client";

/** The MADD wordmark rebuilt as text + an SVG triangle, so the triangle
 * (the "A") can spin independently as a loading indicator. Pass `animate={false}`
 * to render it as a static logo (e.g. in the sidebar header). */
export function TruckRouteGraphic({
  label,
  invert = false,
  animate = true,
  size = "3.5rem",
}: {
  label?: string;
  invert?: boolean;
  animate?: boolean;
  size?: string;
}) {
  const letterStyle: React.CSSProperties = {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontWeight: 700,
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div
        className="flex items-center"
        style={{ color: invert ? "var(--color-brand-navy-dark)" : "#fff", fontSize: size, lineHeight: 1 }}
      >
        <span className={animate ? "madd-letter-pulse" : ""} style={{ ...letterStyle, animationDelay: "0s" }}>
          M
        </span>
        <svg viewBox="0 0 60 54" className={`h-[0.85em] w-[0.85em] ${animate ? "madd-triangle-spin" : ""}`} aria-hidden>
          <polygon points="30,2 58,50 2,50" fill="var(--color-brand-amber)" />
          <circle cx="30" cy="38" r="6" fill="var(--color-brand-navy-dark)" />
        </svg>
        <span className={animate ? "madd-letter-pulse" : ""} style={{ ...letterStyle, animationDelay: "0.35s" }}>
          D
        </span>
        <span className={animate ? "madd-letter-pulse" : ""} style={{ ...letterStyle, animationDelay: "0.7s" }}>
          D
        </span>
      </div>
      {label && (
        <p className={`text-sm font-medium ${invert ? "text-brand-navy-dark" : "text-slate-300"}`}>{label}</p>
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
export default function LoadingTruck({ label = "กำลังโหลด...", fullScreen = false, className = "" }: Props) {
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
