import { useCallback, useEffect, useState } from "react";
import { getChargeLineOrder, sortChargeLines, type ChargeLineOrder } from "@/lib/chargeLineOrder";

// One fetch shared by every screen in the session; /config/charge-names calls
// invalidateChargeLineOrder() after a save so the next screen picks the change up.
let cached: Promise<ChargeLineOrder> | null = null;
// Mounted hooks, told to reload when the order is saved (e.g. from the modal on /shipment/create).
const listeners = new Set<() => void>();

function load(): Promise<ChargeLineOrder> {
  cached ??= getChargeLineOrder().catch(() => {
    cached = null; // retry on the next screen instead of caching the failure
    return {};
  });
  return cached;
}

export function invalidateChargeLineOrder() {
  cached = null;
  listeners.forEach((reload) => reload());
}

/** sortLines("UPS", quote.chargeBreakdown) → the lines in the order set at /config/charge-names. */
export function useChargeLineOrder() {
  const [order, setOrder] = useState<ChargeLineOrder>({});

  useEffect(() => {
    let active = true;
    const reload = () => {
      load().then((o) => active && setOrder(o));
    };
    reload();
    listeners.add(reload);
    return () => {
      active = false;
      listeners.delete(reload);
    };
  }, []);

  return useCallback(
    <T extends { code?: string | null }>(carrier: string | null | undefined, lines: T[]): T[] =>
      sortChargeLines(lines, carrier ? order[carrier.toUpperCase()] : undefined),
    [order],
  );
}
