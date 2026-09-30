"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { useAccess } from "@/components/auth/AccessProvider";
import { listPickups } from "@/lib/pickups";

/**
 * "Courier never came" warning — on-call pickups past their close time with shipments still
 * uncollected (see Pickup::scopeOverdue). Renders nothing when there are none or the user
 * can't see pickups.
 */
export default function OverduePickupsBanner() {
  const { can } = useAccess();
  const allowed = can("pickup.view");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    listPickups({ overdue: true })
      .then((res) => !cancelled && setCount(res.total))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed || count === 0) return null;

  return (
    <Link
      href="/pickup/list?overdue=1"
      className="mb-4 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 hover:bg-red-100"
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <span>
        มี <strong>{count}</strong> Pickup ที่เลยเวลานัดแล้วแต่ Courier ยังรับของไม่ครบ — กดเพื่อดูและติดตาม
      </span>
    </Link>
  );
}
