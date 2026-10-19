"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import {
  downloadRateBook,
  getRateBookRows,
  type RateBookCarrier,
  type RateBookColumn,
  type RateBookPackageType,
  type RateBookRow,
  type RateBookRowsResponse,
  type RateBookRun,
  type RateBookService,
} from "@/lib/rateBook";
import RateBookChart from "./RateBookChart";

// Same as the backend's RateBookRateCard: per-kg bands are listed kg by kg up to this weight.
const EXPAND_PER_KG_UP_TO = 70;
const GREY = "#D9D9D9";

type Line = { key: string; label: string | number; kg: number; mult: number; source: string; rate: boolean };

function bandRange(label: string): [number, number | null] {
  const m = label.match(/^([\d.,]+)(?:-([\d.,]+))?/);
  return m ? [Number(m[1].replace(/,/g, "")), m[2] ? Number(m[2].replace(/,/g, "")) : null] : [0, null];
}

/** Mirrors RateBookRateCard::lines(): step weights, per-kg bands kg by kg (≤ 70), then per-kg rate rows. */
function lines(rows: RateBookRow[]): Line[] {
  const out: Line[] = [];
  const seen = new Set<string>();
  rows.forEach((r) => {
    const source = `${r.band_label}|${r.weight}`;
    if (seen.has(source)) return;
    seen.add(source);
    if (!r.is_per_kg) {
      out.push({ key: source, label: r.weight, kg: r.weight, mult: 1, source, rate: false });
      return;
    }
    const [from, to] = bandRange(r.band_label);
    const first = Math.floor(from) + 1;
    const last = Math.min(to ?? EXPAND_PER_KG_UP_TO, EXPAND_PER_KG_UP_TO);
    for (let kg = first; kg <= last; kg++) out.push({ key: `${source}|${kg}`, label: kg, kg, mult: kg, source, rate: false });
    if (to == null || to > EXPAND_PER_KG_UP_TO) {
      const start = Math.max(first, EXPAND_PER_KG_UP_TO + 1);
      out.push({ key: `${source}|rate`, label: to == null ? `${start} and above` : `${start}-${Math.trunc(to)}`, kg: start, mult: 1, source, rate: true });
    }
  });
  return out;
}

type Column = { header: string; value: (row: RateBookRow, k: number) => number | null; bold?: boolean; percent?: boolean };
const times = (field: keyof RateBookRow) => (row: RateBookRow, k: number) => {
  const v = row[field];
  return v == null ? null : Number(v) * k;
};

// Calc-sheet columns, in the rate file's order (UPS "1".."9": D..P · DHL "1".."9": C..M). SELLING is
// the sell price exactly as /shipment/create sells it — VAT is already built into the account's Fixed
// Charges / Mark-up, so the VAT column stays empty and nothing is added on top.
const CALC_COLUMNS: Record<RateBookCarrier, (label: string) => Column[]> = {
  UPS: (label) => [
    { header: label, value: times("full") },
    { header: "DISC", value: (r) => (r.full ? (1 - Number(r.freight) / r.full) * 100 : null), percent: true },
    { header: "NET", value: times("freight") },
    { header: "FUEL", value: times("fuel") },
    { header: "VAT", value: () => null },
    { header: "SIGN", value: () => null },
    { header: "INS", value: () => null },
    { header: "EXTRA", value: times("other") },
    { header: "ADD", value: times("markup") },
    { header: "FREE", value: times("rounding") },
    { header: "SURGE", value: times("surge") },
    { header: "SELLING", value: times("sell"), bold: true },
  ],
  DHL: (label) => [
    { header: label, value: times("freight") },
    { header: "VAT", value: () => null },
    { header: "FUEL", value: times("fuel") },
    { header: "GG", value: times("gogreen") },
    { header: "MARK", value: (r, k) => ((Number(r.markup) || 0) + (Number(r.rounding) || 0)) * k },
    { header: "REMOTE", value: times("remote") },
    { header: "PEAK", value: times("peak") },
    { header: "", value: times("other") },
    { header: "SELLING", value: times("sell"), bold: true },
    { header: "COST", value: times("cost") },
  ],
};

const fmt = (v: number | null | undefined, decimals: number) =>
  v == null ? "" : v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const cellBorder = "border border-slate-400";

/**
 * On-screen Rate Book laid out like the business's rate files (madd/SAMPLE) — the same sheets as the
 * Excel: UPS "SAVE" + "DOC", DHL "SELLING" + "DOC" (SELLING incl. VAT), then one calc sheet per column.
 * Numbers are the system's (carrier API + the account's Fixed Charges / Mark-up).
 */
export default function RateBookTable({ runs }: { runs: RateBookRun[] }) {
  const completed = runs.filter((r) => r.status === "success" || r.status === "partial");
  // null = follow the newest completed run (a finished sync shows up without a reload).
  const [pickedRunId, setPickedRunId] = useState<number | null>(null);
  const runId = pickedRunId != null && completed.some((r) => r.id === pickedRunId) ? pickedRunId : (completed[0]?.id ?? null);
  const run = completed.find((r) => r.id === runId);
  const [carrier, setCarrier] = useState<RateBookCarrier>("UPS");
  // "card" | "doc" | "<service key>::<column key>" (calc sheet) | "chart"
  const [sheet, setSheet] = useState<string>("card");
  const [chartType, setChartType] = useState<RateBookPackageType>("box");
  // Which service the chart shows (UPS Saver / Eco …); null = the main one. The rate cards show
  // every service on one sheet, like the sample's "ALL" sheet.
  const [serviceKey, setServiceKey] = useState<string | null>(null);
  const [chartZone, setChartZone] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const requestKey = runId == null ? null : `${runId}|${carrier}`;
  const [result, setResult] = useState<{ key: string; data?: RateBookRowsResponse; error?: string } | null>(null);
  const current = result?.key === requestKey ? result : null;
  const data = current?.data ?? null;
  const error = current?.error ?? "";
  const loading = requestKey != null && current == null;

  useEffect(() => {
    if (runId == null || requestKey == null) return;
    let cancelled = false;
    getRateBookRows(runId, carrier)
      .then((res) => !cancelled && setResult({ key: requestKey, data: res }))
      .catch((e) => !cancelled && setResult({ key: requestKey, error: e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ" }));
    return () => {
      cancelled = true;
    };
  }, [runId, carrier, requestKey]);

  const columns = useMemo(() => data?.columns ?? [], [data]);
  const services: RateBookService[] = useMemo(
    () => (data?.services?.length ? data.services : [{ key: "main", label: carrier === "UPS" ? "Saver" : "Express Worldwide", main: true, codes: [] }]),
    [data, carrier],
  );
  // Each row's service: an extra service's rows carry its code, the rest are the main one's.
  const rowsByService = useMemo(() => {
    const extras = services.filter((s) => !s.main);
    const map = new Map<string, RateBookRow[]>(services.map((s) => [s.key, []]));
    for (const r of data?.rows ?? []) {
      const owner = extras.find((s) => r.service_code != null && s.codes.includes(r.service_code)) ?? services[0];
      map.get(owner.key)?.push(r);
    }
    return map;
  }, [data, services]);
  const typeRows = (svc: string, type: RateBookPackageType) => (rowsByService.get(svc) ?? []).filter((r) => r.package_type === type);
  const cellMap = useMemo(() => {
    const map = new Map<string, RateBookRow>();
    rowsByService.forEach((rows, svc) => rows.forEach((r) => map.set(`${svc}|${r.package_type}|${r.band_label}|${r.weight}|${r.zone}`, r)));
    return map;
  }, [rowsByService]);
  const service = services.find((s) => s.key === serviceKey) ?? services[0];
  const chartRows = { document: typeRows(service.key, "document"), box: typeRows(service.key, "box") };
  const extraServices = services.filter((s) => !s.main && (rowsByService.get(s.key)?.length ?? 0) > 0);

  if (completed.length === 0) {
    return <p className="px-5 py-6 text-center text-sm text-slate-400">ยังไม่มีข้อมูลเรท — กด Sync เพื่อสร้าง Rate Book ชุดแรก</p>;
  }

  const ups = carrier === "UPS";
  const year = (run?.finished_at ?? run?.started_at ?? "").slice(0, 4);
  // Calc sheets: the main service's ("1", "2" …), then each extra service's ("ECO 1" …) — as in the Excel.
  const calcSheets = [services[0], ...extraServices].flatMap((s) =>
    columns
      .filter((c) => s.main || (rowsByService.get(s.key) ?? []).some((r) => r.zone === c.key))
      .map((c) => ({ id: `${s.key}::${c.key}`, label: s.main ? c.key : `${s.label.toUpperCase()} ${c.key}`, service: s.key, column: c })),
  );
  const activeSheet = ["card", "doc", "chart"].includes(sheet) || calcSheets.some((t) => t.id === sheet) ? sheet : "card";
  const chartColumns = columns;
  const activeChartZone = chartZone != null && chartColumns.some((c) => c.key === chartZone) ? chartZone : (chartColumns[0]?.key ?? "");

  async function handleExport() {
    if (!run) return;
    setExporting(true);
    setExportError("");
    try {
      await downloadRateBook(run, carrier);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "ดาวน์โหลดไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  }

  const price = (svc: string, type: RateBookPackageType, line: Line, col: RateBookColumn, decimals: number) => {
    const row = cellMap.get(`${svc}|${type}|${line.source}|${col.key}`);
    if (!row) return { text: "", title: undefined as string | undefined, error: false };
    if (row.error) return { text: "ERROR", title: row.error, error: true };
    return { text: fmt(Number(row.sell) * line.mult, decimals), title: undefined, error: false };
  };

  // ---- UPS "SAVE" -------------------------------------------------------------------------------
  function renderUpsSave() {
    const main = services[0].key;
    const all = lines(typeRows(main, "box"));
    // Extra services (e.g. Eco) are sub-columns of this same table, next to the column each is
    // priced for — JP | Eco JP, 5 | Eco/US CA, 7 | Eco … — like the UPS SAMPLE SAVE sheet.
    const lineKey = (l: Line) => `${l.rate ? "r" : "k"}:${l.label}`;
    const subsOf = (key: string) =>
      extraServices.flatMap((s) => {
        const byKey = new Map(lines(typeRows(s.key, "box")).map((l) => [lineKey(l), l]));
        return (s.columns ?? []).filter((c) => c.under === key).map((c) => ({ svc: s.key, source: c.source, label: c.label, byKey }));
      });
    const groups = columns.map((c) => ({ column: c, subs: subsOf(c.key) }));
    const pages: { title: string | null; lines: Line[]; after?: string }[] = [
      { title: "UPS Regular Express Saver", lines: all.filter((l) => !l.rate && l.kg <= 10) },
      { title: null, lines: all.filter((l) => !l.rate && l.kg > 10 && l.kg <= 24), after: "See Next Page for  25 Kg up" },
      { title: services[0].label, lines: all.filter((l) => !l.rate && l.kg > 24 && l.kg <= 45) },
      { title: services[0].label, lines: all.filter((l) => !l.rate && l.kg > 45) },
      { title: services[0].label, lines: all.filter((l) => l.rate) },
    ];
    return (
      <>
        {pages
          .filter((p) => p.lines.length)
          .map((page, pi) => {
            // Sub-columns only where the extra service has prices (Eco: from 25 kg).
            const split = groups.some((g) => g.subs.some((sub) => page.lines.some((l) => sub.byKey.has(lineKey(l)))));
            return (
              <div key={pi} className="mb-8">
                <div className="mb-1 flex items-end text-lg font-bold text-slate-900">
                  <span className="flex-1 text-center">{page.title}</span>
                  <span className="pr-2">UPS</span>
                </div>
                <table className="w-full border-collapse text-center text-sm tabular-nums">
                  <thead>
                    <tr style={{ background: GREY }}>
                      <th rowSpan={split ? 2 : 1} className={`${cellBorder} w-20 px-1 py-1 text-[11px] leading-tight`}>
                        Weight /<br />
                        Zone
                      </th>
                      {groups.map(({ column: c, subs }) => (
                        <th
                          key={c.key}
                          colSpan={1 + subs.length}
                          rowSpan={split && subs.length ? 1 : split ? 2 : 1}
                          className={`${cellBorder} px-1 py-1.5 text-base font-bold leading-tight`}
                          title={c.country ?? undefined}
                        >
                          {c.extra ? c.label.split(" ").map((w, i) => <div key={i}>{w}</div>) : c.key}
                        </th>
                      ))}
                    </tr>
                    {split && (
                      <tr style={{ background: GREY }}>
                        {groups
                          .filter((g) => g.subs.length)
                          .map(({ column: c, subs }) => (
                            <Fragment key={c.key}>
                              <th className={`${cellBorder} px-1 py-0.5 text-[11px] font-semibold`}>{services[0].label}</th>
                              {subs.map((sub, k) => (
                                <th key={k} className={`${cellBorder} px-1 py-0.5 text-[11px] font-semibold`}>
                                  {sub.label}
                                </th>
                              ))}
                            </Fragment>
                          ))}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {page.lines.map((line, li) => {
                      const row = saveRow(main, line, li, groups, split, lineKey);
                      if (!line.rate && line.kg === 31) {
                        return (
                          <Fragment key={line.key}>
                            <tr>
                              <td colSpan={groups.reduce((n, g) => n + 1 + g.subs.length, 1)} className="px-2 py-1 text-left text-xs font-bold text-slate-800">
                                **for each box weighing 31 kgs and up , 1,200 THB is applied for AHC ( Additional Handling Charge )
                              </td>
                            </tr>
                            {row}
                          </Fragment>
                        );
                      }
                      return row;
                    })}
                  </tbody>
                </table>
                {page.after && <p className="mt-2 text-sm font-bold text-slate-800">{page.after}</p>}
              </div>
            );
          })}
        <p className="text-xs text-slate-600">*800 THB or 30 THB / Kg may be charged for Remoted Area Depending on Destination Postal code or city</p>
      </>
    );
  }

  type SaveGroup = { column: RateBookColumn; subs: { svc: string; source: string; label: string; byKey: Map<string, Line> }[] };

  function saveRow(svc: string, line: Line, li: number, groups: SaveGroup[], split: boolean, lineKey: (l: Line) => string) {
    const thick = !line.rate && line.kg === 5 ? "border-b-2 border-b-slate-800" : "";
    const cell = (key: string, p: ReturnType<typeof price>, shade: boolean, colSpan = 1) => (
      <td
        key={key}
        colSpan={colSpan}
        title={p.title}
        className={`${cellBorder} px-2 py-0.5 text-right ${p.error ? "text-red-500" : "text-slate-800"}`}
        style={shade ? { background: GREY } : undefined}
      >
        {p.text}
      </td>
    );
    return (
      <tr key={line.key + li} className={thick}>
        <td className={`${cellBorder} px-2 py-0.5 ${line.rate ? "font-semibold" : ""}`}>
          {typeof line.label === "number" ? line.label.toFixed(1) : line.label}
        </td>
        {groups.flatMap(({ column: c, subs }) => {
          const main = price(svc, "box", line, c, 0);
          // No sub-columns on this page: the main price spans its whole group, like the sample.
          if (!split) return [cell(c.key, main, c.extra, 1 + subs.length)];
          return [
            cell(c.key, main, c.extra),
            ...subs.map((sub, k) => {
              const subLine = sub.byKey.get(lineKey(line));
              const col = columns.find((x) => x.key === sub.source);
              const p = subLine && col ? price(sub.svc, "box", subLine, col, 0) : { text: "", title: undefined, error: false };
              return cell(`${c.key}-sub-${k}`, p, false);
            }),
          ];
        })}
      </tr>
    );
  }

  // ---- DHL "SELLING" ----------------------------------------------------------------------------
  function dhlHeader(bg: string) {
    return (
      <tr style={{ background: bg }}>
        <th className={`${cellBorder} w-24 px-1 py-1 text-xs leading-tight`}>
          Shipment
          <br />
          Weight(Kg)
        </th>
        {columns.map((c) => (
          <th key={c.key} className={`${cellBorder} px-1 py-1 text-xs leading-tight`} title={c.country ?? undefined}>
            {c.extra ? c.label : c.label.replace(/^Zone\s+/, "Zone ")}
          </th>
        ))}
      </tr>
    );
  }

  function shadeAlternate(i: number, c: RateBookColumn) {
    return i % 2 === 0 || c.extra ? { background: GREY } : undefined;
  }

  function renderDhlSelling() {
    return (
      <>
        {[services[0], ...extraServices].map((s) => (
          <Fragment key={s.key}>
            {!s.main && <p className="mb-1 mt-6 text-base font-bold text-slate-900">DHL {s.label}</p>}
            {dhlSellingTable(s.key)}
          </Fragment>
        ))}
        <p className="mt-2 text-xs font-bold text-slate-700">*For each box weighing 26 Kgs and up, 1,200 THB is applied for overweight charge.</p>
      </>
    );
  }

  function dhlSellingTable(svc: string) {
    return (
      <>
        <table className="w-full border-collapse text-sm tabular-nums">
          <thead className="sticky top-0 z-10">{dhlHeader("#CCCCCC")}</thead>
          <tbody>
            {lines(typeRows(svc, "box")).map((line) => (
              <tr key={line.key}>
                <td className={`${cellBorder} px-2 py-0.5 text-center`}>
                  {line.rate ? `${line.label} KG (ต่อ KG)` : typeof line.label === "number" ? line.label.toFixed(1) : line.label}
                </td>
                {columns.map((c, i) => {
                  const p = price(svc, "box", line, c, 2);
                  return (
                    <td key={c.key} title={p.title} className={`${cellBorder} px-2 py-0.5 text-right ${p.error ? "text-red-500" : ""}`} style={shadeAlternate(i, c)}>
                      {p.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  // ---- DOC (UPS / DHL) --------------------------------------------------------------------------
  function countryBlock(cols: RateBookColumn[], shade: boolean) {
    const height = Math.max(1, ...cols.map((c) => c.countries.length));
    return Array.from({ length: height }, (_, k) => (
      <tr key={`country-${k}`} className="text-xs" style={shade ? { background: GREY } : undefined}>
        {k === 0 && (
          <td rowSpan={height} className={`${cellBorder} px-2 text-center font-bold`}>
            COUNTRY
          </td>
        )}
        {cols.map((c) => (
          <td key={c.key} className={`${cellBorder} px-2 py-0.5`}>
            {c.countries[k] ?? ""}
          </td>
        ))}
      </tr>
    ));
  }

  function renderDoc() {
    const main = services[0].key;
    const docLines = lines(typeRows(main, "document"));
    // Extra services' documents follow the main ones, each under its own name row.
    const extraDocs = (cols: RateBookColumn[], heading: (label: string) => string, alternate: boolean) =>
      extraServices.map((s) => {
        const sl = lines(typeRows(s.key, "document"));
        if (!sl.length) return null;
        return (
          <Fragment key={s.key}>
            <tr>
              <td colSpan={cols.length + 1} className={`${cellBorder} px-2 py-0.5 font-bold`}>
                {heading(s.label)}
              </td>
            </tr>
            {sl.map((l) => docRow(s.key, l, cols, `${s.key}-doc`, alternate))}
          </Fragment>
        );
      });
    if (ups) {
      const zones = columns.filter((c) => !c.extra);
      return (
        <>
          <p className="mb-4 text-center text-2xl font-bold text-slate-900">UPS-DOCUMENT {year}</p>
          <table className="w-full border-collapse text-sm tabular-nums">
            <thead>
              <tr style={{ background: GREY }}>
                <th className={`${cellBorder} px-1 py-1 text-xs leading-tight`}>
                  Shipment
                  <br />
                  weight (kg)
                </th>
                {zones.map((c) => (
                  <th key={c.key} className={`${cellBorder} px-1 py-1 text-xs leading-tight`}>
                    Zone
                    <br />
                    {c.key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docLines.length > 0 && (
                <>
                  <tr>
                    <td colSpan={zones.length + 1} className={`${cellBorder} px-2 py-0.5 font-bold`}>
                      UPS Express Saver Envelope
                    </td>
                  </tr>
                  {docRow(main, docLines[0], zones, "env")}
                  <tr>
                    <td colSpan={zones.length + 1} className={`${cellBorder} px-2 py-0.5 font-bold`}>
                      UPS Express Saver Documents
                    </td>
                  </tr>
                </>
              )}
              {docLines.map((l) => docRow(main, l, zones, "doc"))}
              {extraDocs(zones, (label) => `UPS ${label} Documents`, false)}
              {countryBlock(zones, false)}
            </tbody>
          </table>
        </>
      );
    }
    return (
      <>
        <p className="mb-2 text-center text-lg font-bold text-slate-900">DHL - DOCUMENT RATE {year}</p>
        <table className="w-full border-collapse text-sm tabular-nums">
          <thead>{dhlHeader("#B7B7B7")}</thead>
          <tbody>
            {docLines.map((l) => docRow(main, l, columns, "doc", true))}
            {extraDocs(columns, (label) => `DHL ${label}`, true)}
            {countryBlock(columns, true)}
          </tbody>
        </table>
      </>
    );
  }

  function docRow(svc: string, line: Line, cols: RateBookColumn[], prefix: string, alternate = false) {
    return (
      <tr key={`${prefix}-${line.key}`}>
        <td className={`${cellBorder} px-2 py-0.5 text-center`}>{typeof line.label === "number" ? line.label.toFixed(1) : line.label}</td>
        {cols.map((c, i) => {
          const p = price(svc, "document", line, c, ups ? 0 : 2);
          return (
            <td
              key={c.key}
              title={p.title}
              className={`${cellBorder} px-2 py-0.5 text-right ${p.error ? "text-red-500" : ""}`}
              style={alternate ? shadeAlternate(i, c) : undefined}
            >
              {p.text}
            </td>
          );
        })}
      </tr>
    );
  }

  // ---- calc sheet per column ("1".."9", JP, AU …) -----------------------------------------------
  function renderCalc(column: RateBookColumn, svc: string) {
    const calc = CALC_COLUMNS[carrier](column.extra ? column.label : ups ? `Zone ${column.key}` : column.label);
    return (
      <>
        <p className="mb-3 text-xs text-slate-400">
          ราคาจากปลายทางตัวแทน {column.iso2} {column.country ?? ""} · ค่าใช้จ่ายแต่ละช่อง = หลัง Fixed Charges · {ups ? "ADD" : "MARK"} = Mark-up
          {ups && " · SIGN / INS ว่าง: ราคาขายของระบบไม่ได้รวมค่าบริการเสริม"}
        </p>
        {(["document", "box"] as const).map((type) => {
          const zoneRows = typeRows(svc, type).filter((r) => r.zone === column.key);
          if (!zoneRows.length) return null;
          return (
            <div key={type} className="mb-6">
              <p className={`mb-2 text-sm text-slate-800 ${type === "box" ? "font-bold" : ""}`}>
                {ups ? (type === "document" ? "UPS Express® Envelope and Documents" : "Non-Documents") : type === "document" ? "Documents" : "Non-documents"}
              </p>
              <table className="border-collapse text-right text-sm tabular-nums">
                <thead>
                  <tr style={{ background: ups ? "#FDB913" : "#FFCC00" }}>
                    <th className="px-3 py-1.5 text-left" colSpan={2}>
                      {ups ? "Shipment Weight (kg)" : "KG"}
                    </th>
                    {calc.map((c, i) => (
                      <th key={`${c.header}-${i}`} className="min-w-20 px-3 py-1.5">
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines(zoneRows).map((line) => {
                    const row = zoneRows.find((r) => `${r.band_label}|${r.weight}` === line.source);
                    return (
                      <tr key={line.key} className="border-b border-slate-100">
                        <td className="px-3 py-1 text-left text-slate-700">
                          {line.rate ? `${line.label} (ต่อ kg)` : typeof line.label === "number" && line.mult === 1 ? line.label.toFixed(1) : ""}
                        </td>
                        <td className="px-2 py-1 text-slate-500">{!line.rate && line.mult !== 1 ? line.kg : ""}</td>
                        {row?.error ? (
                          <td colSpan={calc.length} className="px-3 py-1 text-left text-red-500">
                            ERROR — {row.error}
                          </td>
                        ) : (
                          calc.map((c, i) => {
                            const v = row ? c.value(row, line.mult) : null;
                            return (
                              <td key={`${c.header}-${i}`} className={`px-3 py-1 ${c.bold ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                                {v == null ? "" : c.percent ? v.toFixed(1) : fmt(v, 2)}
                              </td>
                            );
                          })
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </>
    );
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold ${active ? "bg-brand-navy-dark text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"}`;
  const activeCalc = calcSheets.find((t) => t.id === activeSheet);

  return (
    <div className="p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["UPS", "DHL"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCarrier(c);
              setServiceKey(null);
            }}
            className={tabClass(carrier === c)}
          >
            {c}
          </button>
        ))}
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !run}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export Excel ({carrier})
        </button>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          ข้อมูลรอบ
          <select
            value={runId ?? ""}
            onChange={(e) => setPickedRunId(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-800"
          >
            {completed.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id} · {r.finished_at ? new Date(r.finished_at).toLocaleString() : "-"}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Sheet tabs, named like the rate files' sheets. */}
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-slate-200">
        {[
          { id: "card", label: ups ? "SAVE" : "SELLING" },
          { id: "doc", label: "DOC" },
          ...calcSheets.map((t) => ({ id: t.id, label: t.label })),
          { id: "chart", label: "กราฟ ต้นทุน vs ราคาขาย" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSheet(t.id)}
            className={`-mb-px min-w-10 border-b-2 px-3 py-1.5 text-sm font-semibold ${
              activeSheet === t.id ? "border-brand-amber text-brand-navy-dark" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {exportError && <p className="mb-2 text-sm text-red-600">{exportError}</p>}
      {activeSheet !== "chart" && (
        <p className="mb-3 text-xs text-slate-400">
          รูปแบบเดียวกับไฟล์ {ups ? "UPS" : "DHL"} SAMPLE · ราคาขายเดียวกับหน้า Create Shipment (API จริง + Fixed Charges + Mark-up) · THB
        </p>
      )}

      {loading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด...
        </p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !data?.rows.length ? (
        <p className="py-6 text-center text-sm text-slate-400">ไม่มีข้อมูล {carrier} ในรอบนี้</p>
      ) : activeSheet === "chart" ? (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {(
              [
                ["box", "Non-document"],
                ["document", "Document"],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setChartType(key)} className={tabClass(chartType === key)}>
                {label}
              </button>
            ))}
            {extraServices.length > 0 && (
              <>
                <span className="mx-1 h-6 w-px bg-slate-200" />
                {[services[0], ...extraServices].map((s) => (
                  <button key={s.key} type="button" onClick={() => setServiceKey(s.key)} className={tabClass(service.key === s.key)}>
                    {s.label}
                  </button>
                ))}
              </>
            )}
            <span className="mx-1 h-6 w-px bg-slate-200" />
            {chartColumns.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setChartZone(c.key)}
                title={c.country ?? c.iso2 ?? undefined}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  activeChartZone === c.key ? "bg-brand-amber text-brand-navy-dark" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {c.extra ? c.label : `Zone ${c.key}`} <span className="text-slate-500">{c.iso2}</span>
              </button>
            ))}
          </div>
          <RateBookChart rows={chartRows[chartType]} zone={activeChartZone} />
          <p className="mt-2 text-xs text-slate-400">ช่วงที่คิดราคาต่อ kg ไม่อยู่ในกราฟ (คนละหน่วย) — ดูได้ใน sheet ตาราง</p>
        </div>
      ) : (
        <div className="max-h-[40rem] overflow-auto">
          {activeSheet === "card" ? (ups ? renderUpsSave() : renderDhlSelling()) : activeSheet === "doc" ? renderDoc() : activeCalc ? renderCalc(activeCalc.column, activeCalc.service) : null}
        </div>
      )}
    </div>
  );
}
