import { apiClient } from "./apiClient";

// Order charge lines are listed in on a quote, per carrier (/config/charge-names → ลำดับการแสดง):
// an ordered list of codes, each optionally pinned to the top or bottom. Display only.
export type ChargeLinePin = "top" | "bottom" | null;
export type ChargeLineOrderItem = { code: string; pin: ChargeLinePin };
export type ChargeLineOrder = Record<string, ChargeLineOrderItem[]>;

export const getChargeLineOrder = () => apiClient.get<ChargeLineOrder>("/charge-line-order");

export const saveChargeLineOrder = (carrier: string, lines: ChargeLineOrderItem[]) =>
  apiClient.put<ChargeLineOrder>("/charge-line-order", { carrier, lines });

// Lines of our own (not carrier charge codes) that can sit on a quote.
export const OWN_LINE_CODES: { code: string; label: string }[] = [
  { code: "HEAVY_RATE", label: "Heavy Weight Rate" },
  { code: "WEIGHT_MARKUP", label: "Weight Markup" },
  { code: "TOTAL", label: "ยอดรวมทั้งหมด (Total — บรรทัด Mark-up)" },
];

/**
 * `lines` in the configured order: pinned-top codes, then the rest (listed codes in list order,
 * unlisted ones after them in their original order), then pinned-bottom codes.
 */
export function sortChargeLines<T extends { code?: string | null }>(lines: T[], order: ChargeLineOrderItem[] | undefined): T[] {
  if (!order?.length) return lines;
  const position = new Map(order.map((item, i) => [item.code, { i, pin: item.pin }]));
  const rank = (line: T, original: number): [number, number] => {
    const hit = position.get(String(line.code ?? ""));
    if (!hit) return [1, order.length + original];
    return [hit.pin === "top" ? 0 : hit.pin === "bottom" ? 2 : 1, hit.i];
  };
  return lines
    .map((line, i) => ({ line, r: rank(line, i) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1])
    .map((x) => x.line);
}
