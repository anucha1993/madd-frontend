"use client";

import { useEffect, useState } from "react";
import { MailWarning } from "lucide-react";
import { useAccess } from "@/components/auth/AccessProvider";
import { listShipments } from "@/lib/shipments";

/**
 * Voided DHL waybills DHL hasn't confirmed cancelling yet (DHL has no cancel API — staff must
 * follow up until DHL replies). Renders nothing when there are none.
 */
export default function PendingCarrierCancelBanner({ onShow }: { onShow: () => void }) {
  const { can } = useAccess();
  const allowed = can("shipment.void");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    listShipments({ cancel: "pending" })
      .then((res) => !cancelled && setCount(res.total))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed || count === 0) return null;

  return (
    <button
      type="button"
      onClick={onShow}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 hover:bg-amber-100"
    >
      <MailWarning className="h-5 w-5 shrink-0" />
      <span>
        มี <strong>{count}</strong> Shipment DHL ที่ Void แล้วแต่ DHL ยังไม่ยืนยันการยกเลิก — กดเพื่อดูรายการและติดตาม
      </span>
    </button>
  );
}
