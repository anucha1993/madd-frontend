import { useCallback, useEffect, useState } from "react";
import { listChargeDisplayNames, type ChargeDisplayRule } from "@/lib/chargeCodes";

type Entry = { name: string | null; rule: ChargeDisplayRule | null };
type NameMap = Record<string, Entry>;
type ChargeLine = { code?: string | null; amount?: number | string | null };

// One fetch shared by every screen in the session; /config/charge-names calls
// invalidateChargeDisplayNames() after a save so the next screen picks the change up.
let cached: Promise<NameMap> | null = null;

function load(): Promise<NameMap> {
  cached ??= listChargeDisplayNames()
    .then((rows) =>
      Object.fromEntries(rows.map((r) => [`${r.provider.toUpperCase()}|${r.code}`, { name: r.display_name || null, rule: r.display_rule }]))
    )
    .catch(() => {
      cached = null; // retry on the next screen instead of caching the failure
      return {};
    });
  return cached;
}

export function invalidateChargeDisplayNames() {
  cached = null;
}

// Same test as ChargeCode::ruleMatches() on the backend.
function ruleMatches(amount: number, op: ChargeDisplayRule["op"], value: number) {
  switch (op) {
    case ">=": return amount >= value;
    case "<": return amount < value;
    case "<=": return amount <= value;
    case "=": return Math.abs(amount - value) < 0.005;
    case "!=": return Math.abs(amount - value) >= 0.005;
    default: return amount > value;
  }
}

// Staff's own name for a charge code (/config/charge-names), falling back to the carrier's
// description — e.g. chargeName("UPS", "BASE", "Base Freight") → "ค่าขนส่ง". Pass the quote's
// whole chargeBreakdown as `lines` so a conditional rule (IF {190} > 0 → ...) can see the
// other codes' amounts; a code missing from the quote counts as 0.
export function useChargeDisplayNames() {
  const [names, setNames] = useState<NameMap>({});

  useEffect(() => {
    let active = true;
    load().then((map) => active && setNames(map));
    return () => {
      active = false;
    };
  }, []);

  return useCallback(
    (provider: string | null | undefined, code: string | null | undefined, fallback: string, lines: ChargeLine[] = []) => {
      const entry = provider && code ? names[`${provider.toUpperCase()}|${code}`] : undefined;
      if (!entry) return fallback;
      const rule = entry.rule;
      if (rule?.code && rule.name) {
        const amount = lines.filter((l) => String(l.code ?? "") === rule.code).reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
        if (ruleMatches(amount, rule.op, Number(rule.value) || 0)) return rule.name;
      }
      return entry.name ?? fallback;
    },
    [names]
  );
}
