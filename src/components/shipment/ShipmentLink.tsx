"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAccess } from "@/components/auth/AccessProvider";

type Props = { id: number; className?: string; title?: string; children: ReactNode };

/**
 * A link to a shipment's detail page — or just its text when this user can't open that page, so
 * nobody is sent to a "no access" screen.
 */
export default function ShipmentLink({ id, className, title, children }: Props) {
  const { canVisit } = useAccess();
  const href = `/shipment/view/${id}`;
  if (!canVisit(href)) {
    return (
      <span className={className?.replace(/\bhover:\S+/g, "")} title={title}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={className} title={title}>
      {children}
    </Link>
  );
}
