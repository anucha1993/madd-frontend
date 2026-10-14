"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Clock, FileText, Maximize2, Package, Plane, Scale, Sparkles } from "lucide-react";
import {
  DEFAULT_CUSTOMER_DISPLAY_SETTINGS,
  DEFAULT_DISPLAY_LOGO,
  openDisplayChannel,
  type DisplayMessage,
  type DisplayQuote,
  type DisplayState,
} from "@/lib/customerDisplay";

/**
 * The customer-facing 2nd screen. Opened from Create Shipment ("เปิดจอลูกค้า"), dragged to the
 * screen facing the customer, then full-screened. It only shows what Create Shipment sends over the
 * BroadcastChannel — no login, no API calls, no cost data ever reaches it.
 */

const STEPS = ["ผู้รับ", "พัสดุ", "เลือกบริการ", "ชำระเงิน", "เสร็จสิ้น"];

const money = (n: number) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });
const flagUrl = (iso2: string) => `https://flagcdn.com/w80/${iso2.toLowerCase()}.png`;

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
      if (e.data?.type === "state") setState(e.data.state);
    };
    // Ask Create Shipment for what's on screen right now.
    channel.postMessage({ type: "hello" } satisfies DisplayMessage);
    return () => channel.close();
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
  const theme = { "--primary": primary, "--accent": accent } as CSSProperties;
  const large = settings.brand.font_size === "large";

  const fullscreenButton = !fullscreen && (
    <button
      type="button"
      onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white backdrop-blur hover:bg-black/75"
    >
      <Maximize2 className="h-4 w-4" /> เต็มจอ
    </button>
  );

  if (stage === "idle") {
    return (
      <div style={theme} className={large ? "text-[1.25rem]" : "text-base"}>
        <IdleScreen state={state} slide={slide} images={images} logo={logo} now={now} />
        {fullscreenButton}
      </div>
    );
  }

  const step = stage === "booked" ? 5 : stage === "selected" ? 3 : stage === "quotes" ? 2 : state.packages?.length ? 1 : 0;

  return (
    <div style={theme} className={`flex min-h-screen flex-col bg-[#f4f5f7] text-[#1f2429] ${large ? "text-[1.25rem]" : "text-base"}`}>
      {/* Header: logo · progress · clock */}
      <header className="relative flex items-center gap-8 bg-white px-10 py-5 shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt={settings.brand.shop_name ?? ""} className="h-11 w-auto" />
        <ol className="flex flex-1 items-center justify-center gap-2">
          {STEPS.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={label} className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    done ? "text-white" : current ? "text-[var(--primary)] ring-2 ring-[var(--accent)]" : "bg-slate-100 text-slate-400"
                  }`}
                  style={done ? { background: accent } : current ? { background: "white" } : undefined}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className={`text-sm ${current ? "font-semibold text-[var(--primary)]" : done ? "text-slate-600" : "text-slate-400"}`}>{label}</span>
                {i < STEPS.length - 1 && <span className={`mx-1 h-0.5 w-10 rounded ${done ? "bg-[var(--accent)]" : "bg-slate-200"}`} />}
              </li>
            );
          })}
        </ol>
        <ClockBadge now={now} />
        <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: `linear-gradient(90deg, ${accent}, ${accent}00)` }} />
      </header>

      {stage === "booked" ? (
        <ThankYou state={state} />
      ) : (
        <main className="grid flex-1 grid-cols-12 gap-6 p-8">
          <div className="col-span-12 flex flex-col gap-6 xl:col-span-7">
            {state.recipient ? <RouteCard state={state} /> : <Placeholder text="กำลังกรอกข้อมูลผู้รับ…" />}
            {state.packages && state.packages.length > 0 && <PackagesCard state={state} />}
          </div>

          <div className="col-span-12 flex flex-col gap-6 xl:col-span-5">
            {state.selected ? (
              <Panel title="บริการที่เลือก">
                <QuoteRow quote={{ ...state.selected, selected: true }} showTransit={settings.sections.transit} />
                {state.selected.lines && state.selected.lines.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2 border-t border-dashed border-slate-200 pt-4 text-[0.95em] text-slate-600">
                    {state.selected.lines.map((l, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{l.name}</span>
                        <span className="tabular-nums">{money(l.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            ) : state.quotes && state.quotes.length > 0 ? (
              <Panel title="ตัวเลือกการจัดส่ง" aside={`${state.quotes.length} บริการ`}>
                <div className="flex flex-col gap-3">
                  {state.quotes.map((q, i) => (
                    <QuoteRow key={i} quote={q} showTransit={settings.sections.transit} cheapest={i === 0 && settings.quotes_sort === "price"} />
                  ))}
                </div>
              </Panel>
            ) : (
              <Placeholder text="กำลังเช็คราคาให้คุณ…" icon={<Sparkles className="h-6 w-6" />} />
            )}

            {state.addons && state.addons.length > 0 && (
              <Panel title="บริการเพิ่มเติม">
                <div className="flex flex-col gap-2.5">
                  {state.addons.map((a, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-slate-700">
                        {a.name}
                        {a.quantity > 1 && <span className="ml-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[0.8em] text-slate-500">× {a.quantity}</span>}
                      </span>
                      <span className="tabular-nums font-medium">{money(a.amount)}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {state.total && (
              <div className="relative overflow-hidden rounded-3xl p-7 text-white shadow-lg" style={{ background: primary }}>
                <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-20" style={{ background: accent }} />
                <p className="relative text-[0.95em] font-light tracking-wide text-white/75">ยอดชำระทั้งหมด</p>
                <p className="relative mt-1 flex items-baseline gap-2">
                  <span className="text-[3.2em] font-semibold leading-none tabular-nums">{money(state.total.amount)}</span>
                  <span className="text-[1.1em] font-medium" style={{ color: accent }}>
                    {state.total.currency === "THB" ? "บาท" : state.total.currency}
                  </span>
                </p>
              </div>
            )}
          </div>
        </main>
      )}
      {fullscreenButton}
    </div>
  );
}

function ClockBadge({ now, light }: { now: Date | null; light?: boolean }) {
  if (!now) return <span className="w-36" />;
  return (
    <div className={`w-36 text-right leading-tight ${light ? "text-white" : ""}`}>
      <p className="text-[1.6em] font-semibold tabular-nums">{now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</p>
      <p className={`text-xs ${light ? "text-white/70" : "text-slate-400"}`}>
        {now.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short" })}
      </p>
    </div>
  );
}

function IdleScreen({ state, slide, images, logo, now }: { state: DisplayState; slide: number; images: string[]; logo: string; now: Date | null }) {
  const { idle, brand } = state.settings;
  const primary = brand.primary_color || "#333B42";
  const accent = brand.accent_color || "#F5A623";

  if (images.length > 0) {
    return (
      <main className="relative flex h-screen items-center justify-center overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={slide % images.length} src={images[slide % images.length]} alt="" className="h-full w-full animate-[fadeIn_0.8s_ease] object-cover" />
        <div className="absolute left-8 top-8 rounded-2xl bg-white/95 px-5 py-3 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="h-10 w-auto" />
        </div>
        {(idle.title || idle.subtitle) && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-12 pb-12 pt-32 text-white">
            {idle.title && <p className="text-[2.6em] font-semibold">{idle.title}</p>}
            {idle.subtitle && <p className="mt-1 text-[1.2em] font-light text-white/85">{idle.subtitle}</p>}
          </div>
        )}
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
          {images.map((_, i) => (
            <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === slide % images.length ? 28 : 8, background: i === slide % images.length ? accent : "rgba(255,255,255,0.5)" }} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex h-screen flex-col items-center justify-center overflow-hidden text-white" style={{ background: `radial-gradient(circle at 30% 20%, ${primary}cc, ${primary} 60%)` }}>
      {/* soft brand shapes */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full opacity-10" style={{ background: accent }} />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[34rem] w-[34rem] rounded-full border-[3rem] opacity-10" style={{ borderColor: accent }} />
      <div className="absolute right-10 top-8">
        <ClockBadge now={now} light />
      </div>

      <div className="relative flex flex-col items-center text-center">
        <div className="rounded-[2rem] bg-white px-14 py-10 shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={brand.shop_name ?? ""} className="h-28 w-auto" />
        </div>
        <span className="mt-10 h-1 w-20 rounded-full" style={{ background: accent }} />
        {idle.title && <p className="mt-8 text-[3.4em] font-semibold tracking-tight">{idle.title}</p>}
        {idle.subtitle && <p className="mt-2 text-[1.4em] font-light text-white/80">{idle.subtitle}</p>}
      </div>
    </main>
  );
}

function RouteCard({ state }: { state: DisplayState }) {
  const r = state.recipient!;
  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="flex items-center gap-6 px-8 pb-6 pt-7">
        <Place code="TH" name="Thailand" caption="ต้นทาง" />
        <div className="relative flex flex-1 items-center">
          <span className="h-0.5 flex-1 border-t-2 border-dashed border-slate-200" />
          <span className="mx-3 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md" style={{ background: "var(--accent)" }}>
            <Plane className="h-6 w-6" />
          </span>
          <span className="h-0.5 flex-1 border-t-2 border-dashed border-slate-200" />
        </div>
        <Place code={r.countryCode} name={r.country} caption="ปลายทาง" />
      </div>
      <div className="border-t border-slate-100 bg-slate-50/70 px-8 py-6">
        <p className="text-[0.8em] font-medium uppercase tracking-wider text-slate-400">ผู้รับ</p>
        <p className="mt-1 text-[1.6em] font-semibold">{r.name || "-"}</p>
        {r.company && <p className="text-[1.05em] text-slate-600">{r.company}</p>}
        <div className="mt-2 space-y-0.5 text-slate-500">
          {r.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
        {state.contact && (state.contact.phone || state.contact.email) && (
          <p className="mt-2 text-slate-500">{[state.contact.phone, state.contact.email].filter(Boolean).join(" · ")}</p>
        )}
      </div>
    </section>
  );
}

function Place({ code, name, caption }: { code: string; name: string; caption: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {code ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flagUrl(code)} alt={code} className="h-10 w-14 rounded-md object-cover shadow-sm ring-1 ring-black/5" />
      ) : null}
      <div className="min-w-0">
        <p className="text-[0.75em] uppercase tracking-wider text-slate-400">{caption}</p>
        <p className="truncate text-[1.35em] font-semibold">{name || "-"}</p>
      </div>
    </div>
  );
}

function PackagesCard({ state }: { state: DisplayState }) {
  const w = state.weight;
  return (
    <section className="rounded-3xl bg-white p-7 shadow-sm">
      {w && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <Stat icon={<Package className="h-5 w-5" />} label="จำนวน" value={`${w.pieces}`} unit="ชิ้น" />
          <Stat icon={<Scale className="h-5 w-5" />} label="น้ำหนักรวม" value={`${w.total}`} unit={w.unit} />
          {w.billed != null ? (
            <Stat icon={<Scale className="h-5 w-5" />} label="น้ำหนักที่คิดเงิน" value={`${w.billed}`} unit={w.unit} highlight />
          ) : (
            <span />
          )}
        </div>
      )}
      <div className="flex flex-col divide-y divide-slate-100">
        {state.packages!.map((p, i) => (
          <div key={i} className="flex items-center gap-4 py-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              {p.kind === "document" ? <FileText className="h-5 w-5" /> : <Package className="h-5 w-5" />}
            </span>
            <div className="flex-1">
              <p className="font-medium">{p.kind === "document" ? "เอกสาร" : "กล่อง"}</p>
              {p.dims && <p className="text-[0.85em] text-slate-400">{p.dims}</p>}
            </div>
            <p className="tabular-nums font-medium">{p.weight} kg</p>
            <span className="w-14 rounded-full bg-slate-100 py-1 text-center text-[0.85em] font-medium text-slate-600">× {p.quantity}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ icon, label, value, unit, highlight }: { icon: ReactNode; label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${highlight ? "text-white" : "bg-slate-50"}`} style={highlight ? { background: "var(--primary)" } : undefined}>
      <p className={`flex items-center gap-1.5 text-[0.8em] ${highlight ? "text-white/70" : "text-slate-400"}`}>
        <span style={highlight ? { color: "var(--accent)" } : undefined}>{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-[1.7em] font-semibold tabular-nums leading-tight">
        {value} <span className="text-[0.55em] font-normal opacity-70">{unit}</span>
      </p>
    </div>
  );
}

function Panel({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-7 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[0.8em] font-medium uppercase tracking-wider text-slate-400">{title}</h2>
        {aside && <span className="text-[0.8em] text-slate-400">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Placeholder({ text, icon }: { text: string; icon?: ReactNode }) {
  return (
    <section className="flex items-center gap-4 rounded-3xl border-2 border-dashed border-slate-200 p-8 text-slate-400">
      <span className="animate-pulse">{icon ?? <Clock className="h-6 w-6" />}</span>
      {text}
    </section>
  );
}

function QuoteRow({ quote, showTransit, cheapest }: { quote: DisplayQuote; showTransit: boolean; cheapest?: boolean }) {
  return (
    <div
      className={`relative flex items-center gap-4 rounded-2xl border-2 px-5 py-4 transition ${quote.selected ? "bg-[#fffaf0]" : "border-slate-100 bg-white"}`}
      style={quote.selected ? { borderColor: "var(--accent)" } : undefined}
    >
      <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-100">
        {quote.carrierLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={quote.carrierLogo} alt={quote.carrier} className="max-h-8 max-w-12 object-contain" />
        ) : (
          <span className="text-sm font-bold text-slate-500">{quote.carrier}</span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">
          {quote.carrier} <span className="font-normal text-slate-500">{quote.service}</span>
        </p>
        <div className="mt-1 flex items-center gap-2">
          {showTransit && quote.transitDays != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[0.8em] text-slate-600">
              <Clock className="h-3.5 w-3.5" /> ประมาณ {quote.transitDays} วันทำการ
            </span>
          )}
          {cheapest && !quote.selected && (
            <span className="rounded-full px-2.5 py-0.5 text-[0.8em] font-medium text-white" style={{ background: "var(--accent)" }}>
              ราคาดีที่สุด
            </span>
          )}
        </div>
      </div>
      <p className="text-right">
        <span className="text-[1.7em] font-semibold tabular-nums">{money(quote.price)}</span>
        <span className="ml-1 text-[0.8em] text-slate-400">{quote.currency === "THB" ? "บาท" : quote.currency}</span>
      </p>
      {quote.selected && (
        <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full text-white shadow" style={{ background: "var(--accent)" }}>
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      )}
    </div>
  );
}

function ThankYou({ state }: { state: DisplayState }) {
  const { settings } = state;
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-10 text-center">
      <span className="relative flex h-28 w-28 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full opacity-30" style={{ background: "var(--accent)" }} />
        <span className="relative flex h-28 w-28 items-center justify-center rounded-full text-white shadow-xl" style={{ background: "var(--accent)" }}>
          <Check className="h-14 w-14" strokeWidth={3} />
        </span>
      </span>
      <p className="text-[2.8em] font-semibold" style={{ color: "var(--primary)" }}>
        {settings.thank_you.message}
      </p>
      {settings.sections.tracking && state.booked?.tracking && (
        <div className="rounded-3xl bg-white px-12 py-7 shadow-sm">
          <p className="text-[0.9em] text-slate-400">เลข Tracking · {state.booked.carrier}</p>
          <p className="mt-1 font-mono text-[2.4em] font-semibold tracking-[0.15em]">{state.booked.tracking}</p>
        </div>
      )}
      {state.total && settings.sections.total && (
        <p className="text-[1.3em] text-slate-500">
          ยอดชำระ <span className="font-semibold text-slate-800">{money(state.total.amount)} บาท</span>
        </p>
      )}
    </main>
  );
}
