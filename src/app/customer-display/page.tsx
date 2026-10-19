"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Check, FileText, Maximize2, Package, Plane, ReceiptText } from "lucide-react";
import {
  DEFAULT_CUSTOMER_DISPLAY_SETTINGS,
  DEFAULT_DISPLAY_LOGO,
  fetchRemoteDisplayState,
  openDisplayChannel,
  type DisplayMessage,
  type DisplayState,
  mediaUrl,
  withDefaults,
} from "@/lib/customerDisplay";

/**
 * The customer-facing 2nd screen, laid out like a POS customer display: the itemised bill on the
 * left; the amount due, the shipment's details and one ad banner on the right. Opened from Create
 * Shipment ("เปิดจอลูกค้า"); it only shows what Create Shipment sends over the BroadcastChannel (or,
 * on another computer, relays through the API — ?k=<key>) —
 * no login, no API calls, no cost data, and never an estimated delivery time.
 *
 * Everything is sized in em off a root size that follows the screen height, so the same layout
 * fills a 1080p counter screen or a small tablet without scrolling.
 */

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const currencyLabel = (c?: string) => c || "THB";
const flagUrl = (iso2: string) => `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`;

export default function CustomerDisplayPage() {
  const [state, setState] = useState<DisplayState>({ stage: "idle", settings: DEFAULT_CUSTOMER_DISPLAY_SETTINGS });
  const [slide, setSlide] = useState(0);
  const [dismissedBooking, setDismissedBooking] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const channel = openDisplayChannel();
    if (!channel) return;
    channel.onmessage = (e: MessageEvent<DisplayMessage>) => {
      if (e.data?.type === "state") setState({ ...e.data.state, settings: withDefaults(e.data.state.settings) });
    };
    // Ask Create Shipment for what's on screen right now.
    channel.postMessage({ type: "hello" } satisfies DisplayMessage);
    return () => channel.close();
  }, []);

  // On another computer (opened with ?k=…): poll the state Create Shipment relays through the API.
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("k");
    if (!key) return;
    let version = 0;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const live = await fetchRemoteDisplayState(key, version);
        if (live && !stopped) {
          version = live.v;
          setState({ ...live.state, settings: withDefaults(live.state.settings) });
        }
      } catch {
        // offline for a moment — keep showing the last state
      }
      if (!stopped) timer = setTimeout(poll, 1000);
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const clock = setInterval(tick, 15_000);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      clearTimeout(first);
      clearInterval(clock);
    };
  }, []);

  const { settings } = state;
  const images = settings.idle.images.filter(Boolean);

  // Promotion images take turns on the idle screen.
  useEffect(() => {
    if (images.length < 2) return;
    const timer = setInterval(() => setSlide((s) => s + 1), Math.max(3, settings.idle.image_seconds) * 1000);
    return () => clearInterval(timer);
  }, [images.length, settings.idle.image_seconds]);

  // After a booking, the thank-you screen goes back to idle on its own.
  const bookingKey = state.stage === "booked" ? `${state.booked?.tracking ?? ""}` : null;
  useEffect(() => {
    if (bookingKey === null) return;
    const timer = setTimeout(() => setDismissedBooking(bookingKey), Math.max(5, settings.thank_you.return_seconds) * 1000);
    return () => clearTimeout(timer);
  }, [bookingKey, settings.thank_you.return_seconds]);

  const stage = state.stage === "booked" && dismissedBooking === bookingKey ? "idle" : state.stage;
  const primary = settings.brand.primary_color || "#333B42";
  const accent = settings.brand.accent_color || "#F5A623";
  const logo = settings.idle.logo_url || DEFAULT_DISPLAY_LOGO;
  const banner = mediaUrl(settings.banner?.image_url);
  const style = {
    "--primary": primary,
    "--accent": accent,
    // Root size follows the screen height (≈17px on 1080p); "large" for a screen further away.
    fontSize: settings.brand.font_size === "large" ? "clamp(15px, 1.85vh, 30px)" : "clamp(13px, 1.55vh, 26px)",
  } as CSSProperties;

  const fullscreenButton = !fullscreen && (
    <button
      type="button"
      onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-sm text-white backdrop-blur hover:bg-black/70"
    >
      <Maximize2 className="h-4 w-4" /> Full screen
    </button>
  );

  if (stage === "idle") {
    return (
      <div style={style}>
        <IdleScreen state={state} slide={slide} images={images} logo={logo} now={now} />
        {fullscreenButton}
      </div>
    );
  }

  return (
    <div style={style} className="grid h-screen grid-cols-[1.08fr_1fr] gap-[1.4em] bg-[#eceef1] p-[1.4em] text-[#262b30]">
      <BillPane state={state} logo={logo} now={now} />
      <div className="flex min-h-0 flex-col gap-[1.4em]">
        <AmountCard state={state} stage={stage} />
        <div className="min-h-0 flex-1 overflow-hidden rounded-[1.25em] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
          {stage === "booked" ? <BookedPanel state={state} /> : <CustomerPanel state={state} />}
        </div>
        {banner && (
          <div className="overflow-hidden rounded-[1.25em] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner} alt="" className="block aspect-[16/3] w-full object-cover" />
          </div>
        )}
      </div>
      {fullscreenButton}
    </div>
  );
}

/* ---------------- left: the itemised bill ---------------- */

function BillPane({ state, logo, now }: { state: DisplayState; logo: string; now: Date | null }) {
  const { settings, selected, quotes, addons, total } = state;
  const addonTotal = (addons ?? []).reduce((sum, a) => sum + a.amount, 0);
  const lineCount = selected ? 1 + (addons?.length ?? 0) : 0;

  return (
    <section className="flex min-h-0 flex-col rounded-[1.25em] bg-white px-[2em] pb-[1.6em] pt-[1.5em] shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      <header className="flex items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={settings.brand.shop_name ?? ""} className="h-[3.6em] w-auto" />
        {now && (
          <div className="text-right leading-tight">
            <p className="text-[1.15em] font-semibold tabular-nums">{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
            <p className="text-[0.78em] text-slate-400">{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        )}
      </header>

      <div className="mt-[1.4em] flex items-end justify-between border-b-2 border-[#262b30] pb-[0.6em]">
        <h2 className="flex items-center gap-[0.5em] text-[1.25em] font-semibold">
          <ReceiptText className="h-[1.1em] w-[1.1em]" style={{ color: "var(--accent)" }} />
          Order Summary
        </h2>
        <span className="text-[0.78em] font-medium uppercase tracking-wider text-slate-400">
          {selected ? `${lineCount} item${lineCount > 1 ? "s" : ""} · THB` : "THB"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {selected ? (
          <>
            <BillRow
              title={`Shipping · ${selected.carrier}`}
              sub={[selected.service, state.weight?.billed != null ? `Billable weight ${state.weight.billed} ${state.weight.unit}` : null].filter(Boolean).join("  ·  ")}
              amount={selected.price}
              logo={selected.carrierLogo}
            />
            {selected.lines?.map((l, i) => (
              <div key={i} className="flex justify-between py-[0.3em] pl-[3.2em] text-[0.85em] text-slate-500">
                <span>{l.name}</span>
                <span className="tabular-nums">{money(l.amount)}</span>
              </div>
            ))}
            {addons?.map((a, i) => (
              <BillRow key={i} title={a.name} qty={a.quantity} amount={a.amount} />
            ))}
          </>
        ) : quotes && quotes.length > 0 ? (
          <>
            <p className="pt-[1em] text-[0.85em] text-slate-400">Shipping options</p>
            {quotes.map((q, i) => (
              <BillRow key={i} title={`${q.carrier} ${q.service}`} amount={q.price} logo={q.carrierLogo} carrier={q.carrier} />
            ))}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-[0.6em] text-slate-300">
            <ReceiptText className="h-[2.6em] w-[2.6em]" strokeWidth={1.4} />
            <p className="text-[1.05em]">Preparing your order…</p>
          </div>
        )}
      </div>

      {selected && settings.sections.total && (
        <div className="mt-[1em] rounded-[1em] bg-[#f5f6f8] px-[1.3em] py-[1em]">
          <SummaryRow label="Shipping" value={money(selected.price)} />
          {addonTotal > 0 && <SummaryRow label="Additional services" value={money(addonTotal)} />}
          {total && (
            <div className="mt-[0.6em] flex items-baseline justify-between border-t border-dashed border-slate-300 pt-[0.7em]" style={{ color: "var(--primary)" }}>
              <span className="flex items-center gap-[0.5em] text-[1.25em] font-semibold">
                <span className="h-[1em] w-[0.3em] rounded-full" style={{ background: "var(--accent)" }} />
                Total
              </span>
              <span className="text-[1.9em] font-bold tabular-nums leading-none">{money(total.amount)}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function BillRow({ title, sub, qty, amount, logo, carrier }: { title: string; sub?: string; qty?: number; amount: number; logo?: string | null; carrier?: string }) {
  return (
    <div className="flex items-center gap-[1em] border-b border-slate-100 py-[0.95em]">
      <span className="flex h-[2.4em] w-[2.4em] shrink-0 items-center justify-center rounded-[0.7em] bg-[#f5f6f8]">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={carrier ?? ""} className="max-h-[1.5em] max-w-[1.8em] object-contain" />
        ) : (
          <Package className="h-[1.2em] w-[1.2em] text-slate-400" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.05em] font-medium">{title}</p>
        {sub && <p className="mt-[0.1em] truncate text-[0.82em] text-slate-400">{sub}</p>}
      </div>
      {qty != null && qty > 1 && <span className="rounded-full bg-[#f5f6f8] px-[0.7em] py-[0.15em] text-[0.85em] font-medium text-slate-500">× {qty}</span>}
      <p className="w-[7em] shrink-0 text-right text-[1.05em] font-semibold tabular-nums">{money(amount)}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-[0.2em] text-[0.95em] text-slate-500">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/* ---------------- right: the amount due ---------------- */

function AmountCard({ state, stage }: { state: DisplayState; stage: string }) {
  const amount = state.total?.amount ?? state.selected?.price ?? null;
  const showAmount = amount != null && state.settings.sections.total;
  const caption = stage === "booked" ? "Paid" : showAmount ? "Amount due" : stage === "quotes" ? "Please choose a shipping service" : "Preparing your order";
  return (
    <div className="relative overflow-hidden rounded-[1.25em] px-[2em] py-[1.6em] text-white shadow-[0_8px_24px_rgba(16,24,40,0.18)]" style={{ background: "var(--primary)" }}>
      <div className="pointer-events-none absolute -bottom-[4em] -left-[3em] h-[9em] w-[9em] rounded-full opacity-10" style={{ background: "var(--accent)" }} />
      <div className="relative flex items-center justify-between">
        <p className="flex items-center gap-[0.5em] text-[1em] font-medium" style={{ color: "var(--accent)" }}>
          {stage === "booked" && <Check className="h-[1.1em] w-[1.1em]" strokeWidth={3} />}
          {caption}
        </p>
        {state.selected && (
          <span className="rounded-full bg-white/10 px-[0.9em] py-[0.25em] text-[0.82em] text-white/80">
            {state.selected.carrier} · {state.selected.service}
          </span>
        )}
      </div>
      {showAmount ? (
        <p className="relative mt-[0.5em] text-right leading-none">
          <span className="text-[4.2em] font-bold tabular-nums tracking-tight">{money(amount)}</span>
          <span className="ml-[0.4em] text-[1.3em] font-medium" style={{ color: "var(--accent)" }}>
            {currencyLabel(state.total?.currency ?? state.selected?.currency)}
          </span>
        </p>
      ) : (
        <p className="relative mt-[0.8em] text-right text-[2.2em] font-semibold text-white/90">{state.settings.brand.shop_name}</p>
      )}
    </div>
  );
}

/* ---------------- right: the customer's shipment ---------------- */

function CustomerPanel({ state }: { state: DisplayState }) {
  const { sender, recipient, contact, packages, weight } = state;
  if (!sender && !recipient && !packages?.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[0.6em] text-slate-300">
        <Plane className="h-[2.4em] w-[2.4em]" strokeWidth={1.4} />
        <p>Shipment details will appear here</p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col overflow-y-auto px-[1.8em] py-[1.4em]">
      {(sender || recipient) && (
        <div className="grid grid-cols-2 gap-[1.6em]">
          <Party label="Sender" party={sender} />
          <Party
            label="Recipient"
            party={recipient}
            extra={
              recipient && (
                <>
                  {recipient.country && (
                    <p className="mt-[0.35em] flex items-center gap-[0.45em] font-semibold">
                      {recipient.countryCode && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={flagUrl(recipient.countryCode)} alt="" className="h-[0.95em] w-[1.4em] rounded-[0.15em] object-cover ring-1 ring-black/10" />
                      )}
                      {recipient.country}
                    </p>
                  )}
                  {contact && (contact.phone || contact.email) && (
                    <p className="mt-[0.2em] text-[0.85em] text-slate-500">{[contact.phone, contact.email].filter(Boolean).join(" · ")}</p>
                  )}
                </>
              )
            }
          />
        </div>
      )}

      {packages && packages.length > 0 && (
        <div className="mt-[1.3em] border-t border-slate-100 pt-[1.1em]">
          <SectionLabel>Packages</SectionLabel>
          <div className="flex flex-wrap gap-[0.5em]">
            {packages.map((p, i) => (
              <span key={i} className="flex items-center gap-[0.45em] rounded-[0.6em] bg-[#f5f6f8] px-[0.75em] py-[0.35em] text-[0.88em] text-slate-600">
                {p.kind === "document" ? <FileText className="h-[1.05em] w-[1.05em] text-slate-400" /> : <Package className="h-[1.05em] w-[1.05em] text-slate-400" />}
                {p.kind === "document" ? "Document" : p.dims} · {p.weight} kg
                {p.quantity > 1 && <span className="font-semibold text-slate-700">× {p.quantity}</span>}
              </span>
            ))}
          </div>
          {weight && (
            <div className="mt-[0.9em] grid grid-cols-3 gap-[0.6em]">
              <Stat label="Pieces" value={`${weight.pieces}`} unit="pcs" />
              <Stat label="Total weight" value={`${weight.total}`} unit={weight.unit} />
              {weight.billed != null && <Stat label="Billable weight" value={`${weight.billed}`} unit={weight.unit} strong />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Party({ label, party, extra }: { label: string; party?: { name: string; company: string; lines: string[] }; extra?: ReactNode }) {
  if (!party) return <div />;
  return (
    <div className="min-w-0">
      <SectionLabel>{label}</SectionLabel>
      <p className="truncate text-[1.1em] font-semibold">{party.name || "-"}</p>
      {party.company && <p className="truncate text-slate-600">{party.company}</p>}
      {party.lines.map((l, i) => (
        <p key={i} className="text-[0.85em] leading-snug text-slate-500">
          {l}
        </p>
      ))}
      {extra}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-[0.4em] flex items-center gap-[0.45em] text-[0.75em] font-semibold uppercase tracking-[0.12em] text-slate-400">
      <span className="h-[0.5em] w-[0.5em] rounded-full" style={{ background: "var(--accent)" }} />
      {children}
    </p>
  );
}

function Stat({ label, value, unit, strong }: { label: string; value: string; unit: string; strong?: boolean }) {
  return (
    <div className={`rounded-[0.8em] px-[0.9em] py-[0.6em] ${strong ? "text-white" : "bg-[#f5f6f8]"}`} style={strong ? { background: "var(--primary)" } : undefined}>
      <p className={`text-[0.75em] ${strong ? "" : "text-slate-400"}`} style={strong ? { color: "var(--accent)" } : undefined}>
        {label}
      </p>
      <p className="text-[1.35em] font-semibold tabular-nums leading-tight">
        {value} <span className="text-[0.6em] font-normal opacity-70">{unit}</span>
      </p>
    </div>
  );
}

function BookedPanel({ state }: { state: DisplayState }) {
  const { settings, booked } = state;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[1em] px-[2em] text-center">
      <span className="flex h-[4.2em] w-[4.2em] items-center justify-center rounded-full text-white shadow-lg" style={{ background: "var(--accent)" }}>
        <Check className="h-[2.2em] w-[2.2em]" strokeWidth={3} />
      </span>
      <p className="text-[1.9em] font-semibold" style={{ color: "var(--primary)" }}>
        {settings.thank_you.message}
      </p>
      {settings.sections.tracking && booked?.tracking && (
        <div className="rounded-[1em] bg-[#f5f6f8] px-[1.8em] py-[0.9em]">
          <p className="text-[0.8em] text-slate-400">Tracking number · {booked.carrier}</p>
          <p className="mt-[0.2em] text-[1.8em] font-semibold tabular-nums tracking-[0.08em]">{booked.tracking}</p>
        </div>
      )}
    </div>
  );
}

/* ---------------- idle ---------------- */

function IdleScreen({ state, slide, images, logo, now }: { state: DisplayState; slide: number; images: string[]; logo: string; now: Date | null }) {
  const { idle, brand } = state.settings;
  const primary = brand.primary_color || "#333B42";
  const accent = brand.accent_color || "#F5A623";
  const clock = now && (
    <div className="text-right leading-tight text-white">
      <p className="text-[2em] font-semibold tabular-nums">{now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
      <p className="text-[0.85em] text-white/70">{now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>
    </div>
  );

  if (images.length > 0) {
    return (
      <main className="relative flex h-screen items-center justify-center overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={slide % images.length} src={images[slide % images.length]} alt="" className="h-full w-full animate-[fadeIn_0.8s_ease] object-cover" />
        <div className="absolute left-[2em] top-[2em] rounded-[1em] bg-white/95 px-[1.2em] py-[0.8em] shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="h-[2.4em] w-auto" />
        </div>
        {(idle.title || idle.subtitle) && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-[3em] pb-[2.5em] pt-[7em] text-white">
            {idle.title && <p className="text-[2.6em] font-semibold">{idle.title}</p>}
            {idle.subtitle && <p className="mt-[0.2em] text-[1.2em] font-light text-white/85">{idle.subtitle}</p>}
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="relative flex h-screen flex-col items-center justify-center overflow-hidden text-white" style={{ background: `radial-gradient(circle at 30% 20%, ${primary}cc, ${primary} 60%)` }}>
      <div className="pointer-events-none absolute -left-[8em] -top-[8em] h-[26em] w-[26em] rounded-full opacity-10" style={{ background: accent }} />
      <div className="pointer-events-none absolute -bottom-[10em] -right-[6em] h-[32em] w-[32em] rounded-full border-[3em] opacity-10" style={{ borderColor: accent }} />
      <div className="absolute right-[2.5em] top-[2em]">{clock}</div>
      <div className="relative flex flex-col items-center text-center">
        <div className="rounded-[2em] bg-white px-[3.5em] py-[2.4em] shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={brand.shop_name ?? ""} className="h-[7.5em] w-auto" />
        </div>
        <span className="mt-[2.4em] h-[0.25em] w-[4.5em] rounded-full" style={{ background: accent }} />
        {idle.title && <p className="mt-[1.6em] text-[3.2em] font-semibold tracking-tight">{idle.title}</p>}
        {idle.subtitle && <p className="mt-[0.4em] text-[1.35em] font-light text-white/80">{idle.subtitle}</p>}
      </div>
    </main>
  );
}
