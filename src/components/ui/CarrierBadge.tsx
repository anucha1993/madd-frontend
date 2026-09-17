// Stylized brand-color badges for UPS/DHL — no logo image assets exist in this project, so this
// approximates each brand's look (colors + wordmark) instead of embedding a copyrighted logo file.
export default function CarrierBadge({ carrier }: { carrier: string }) {
  if (carrier === "UPS") {
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded bg-[#2b1a0e] px-1.5 py-0.5 text-[10px] font-extrabold tracking-wide text-[#FFB500]">
        UPS
      </span>
    );
  }
  if (carrier === "DHL") {
    return (
      <span className="inline-flex shrink-0 items-center justify-center rounded bg-[#FFCC00] px-1.5 py-0.5 text-[10px] font-extrabold italic tracking-wide text-[#D40511]">
        DHL
      </span>
    );
  }
  return <span className="text-xs text-slate-400">{carrier}</span>;
}
